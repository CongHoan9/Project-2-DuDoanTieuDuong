from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    cors_allow_origins: list[str]
    supabase_url: str
    supabase_public_key: str
    supabase_jwt_secret: str
    database_backend: str


def _parse_origins(raw_value: str | None) -> list[str]:
    if not raw_value:
        return ["*"]

    origins = [item.strip() for item in raw_value.split(",") if item.strip()]
    return origins or ["*"]


def _require_supabase_url() -> str:
    """Lấy Supabase URL từ env, hỗ trợ cả prefix của Next.js."""
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not url:
        raise RuntimeError("SUPABASE_URL is required. Check your .env file.")
    return url.strip()


def _require_supabase_public_key() -> str:
    key = (
        os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    )
    if not key:
        raise RuntimeError("SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required for browser auth.")
    return key.strip()


def _require_supabase_jwt_secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise RuntimeError("SUPABASE_JWT_SECRET is required to securely verify JWT tokens. Check your .env file.")
    return secret.strip()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    supabase_url = _require_supabase_url()
    supabase_public_key = _require_supabase_public_key()
    supabase_jwt_secret = _require_supabase_jwt_secret()
    return Settings(
        cors_allow_origins=_parse_origins(os.getenv("CORS_ALLOW_ORIGINS")),
        supabase_url=supabase_url,
        supabase_public_key=supabase_public_key,
        supabase_jwt_secret=supabase_jwt_secret,
        database_backend="supabase-rpc",
    )
