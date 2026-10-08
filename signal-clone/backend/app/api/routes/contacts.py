from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models import User
from app.schemas import ContactCreate, ContactOut
from app.services import contacts as contact_service

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("")
def list_contacts(
    q: str | None = Query(default=None, max_length=64),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ContactOut]:
    return [contact_service.to_out(c) for c in contact_service.list_contacts(db, user, q)]


@router.post("", status_code=status.HTTP_201_CREATED)
def add_contact(
    payload: ContactCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ContactOut:
    return contact_service.to_out(contact_service.add_contact(db, user, payload.identifier))


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_contact(
    contact_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    contact_service.remove_contact(db, user, contact_id)
