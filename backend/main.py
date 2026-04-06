from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import get_settings
from app.database import Base, engine
from app.models import check as _check_models


settings = get_settings()
BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"
APP_VERSION = "2.2.0"

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Diabetes Clinical Risk API",
    description="Single Render web service for the diabetes dashboard, API endpoints, and optional Supabase history.",
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials="*" not in settings.cors_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {
            "message": "Diabetes Clinical Risk API",
            "docs": "/docs",
            "version": APP_VERSION,
            "frontend_status": "missing",
        }
