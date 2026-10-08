from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import BadRequest, Conflict, NotFound
from app.models import Contact, User
from app.schemas import ContactOut
from app.services.auth import find_user
from app.services.users import to_public


def to_out(contact: Contact) -> ContactOut:
    return ContactOut(
        id=contact.id, user=to_public(contact.contact_user), created_at=contact.created_at
    )


def list_contacts(db: Session, owner: User, query: str | None = None) -> list[Contact]:
    stmt = (
        select(Contact)
        .join(User, Contact.contact_user_id == User.id)
        .where(Contact.owner_id == owner.id)
        .options(joinedload(Contact.contact_user))
        .order_by(User.display_name)
    )
    if query:
        pattern = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                User.display_name.ilike(pattern),
                User.username.ilike(pattern),
                User.phone_number.ilike(pattern),
            )
        )
    return list(db.scalars(stmt))


def add_contact(db: Session, owner: User, identifier: str) -> Contact:
    user = find_user(db, identifier)
    if user is None or not user.display_name:
        raise NotFound("No Signal user found with that phone number or username")
    if user.id == owner.id:
        raise BadRequest("You can't add yourself as a contact")
    existing = db.scalar(
        select(Contact).where(Contact.owner_id == owner.id, Contact.contact_user_id == user.id)
    )
    if existing is not None:
        raise Conflict(f"{user.display_name} is already in your contacts")

    contact = Contact(owner_id=owner.id, contact_user_id=user.id, contact_user=user)
    db.add(contact)
    db.commit()
    return contact


def remove_contact(db: Session, owner: User, contact_id: int) -> None:
    contact = db.get(Contact, contact_id)
    if contact is None or contact.owner_id != owner.id:
        raise NotFound("Contact not found")
    db.delete(contact)
    db.commit()
