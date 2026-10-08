from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app import models  # noqa: F401  (registers the tables on Base.metadata)
from app.api.routes import auth, contacts, conversations, health, messages, users
from app.core.config import get_settings
from app.core.errors import AppError, app_error_handler, validation_error_handler
from app.db import Base, SessionLocal, engine
from app.realtime import ws
from app.seed import seed


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    if get_settings().seed_on_startup:
        with SessionLocal() as db:
            if db.scalar(select(models.User.id).limit(1)) is None:
                seed(db)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)

    app.include_router(health.router)
    for module in (auth, users, contacts, conversations, messages):
        app.include_router(module.router, prefix="/api/v1")
    app.include_router(ws.router)

    media_dir = Path(settings.media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=media_dir), name="media")
    return app


app = create_app()
