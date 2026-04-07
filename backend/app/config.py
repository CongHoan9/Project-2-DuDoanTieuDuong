from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    cors_allow_origins: list[str]
    database_url: str
    database_backend: str


def _parse_origins(raw_value: str | None) -> list[str]:
    if not raw_value:
        return ["*"]

    origins = [item.strip() for item in raw_value.split(",") if item.strip()]
    return origins or ["*"]


def _normalize_database_url(raw_value: str) -> str:
    database_url = raw_value.strip()

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif database_url.startswith("postgresql://") and "+psycopg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    parsed = urlparse(database_url)
    if "supabase.co" not in parsed.netloc and "supabase.com" not in parsed.netloc:
        return database_url

    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.setdefault("sslmode", "require")
    return urlunparse(parsed._replace(query=urlencode(query)))


def _detect_database_backend(database_url: str) -> str:
    if "supabase.co" in database_url or "supabase.com" in database_url:
        return "supabase-postgres"
    if database_url.startswith("postgresql"):
        return "postgres"
    return "database"


def _require_database_url() -> str:
    raw_database_url = os.getenv("DATABASE_URL", "").strip()
    if not raw_database_url:
        raise RuntimeError(
            "DATABASE_URL is required. Set it to your Supabase Postgres connection string."
        )

    database_url = _normalize_database_url(raw_database_url)
    if database_url.startswith("sqlite"):
        raise RuntimeError(
            "SQLite fallback has been removed. Please use a Supabase/Postgres DATABASE_URL."
        )

    return database_url


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    database_url = _require_database_url()

    return Settings(
        cors_allow_origins=_parse_origins(os.getenv("CORS_ALLOW_ORIGINS")),
        database_url=database_url,
        database_backend=_detect_database_backend(database_url),
    )
