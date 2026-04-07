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
    database_url: str


def _parse_origins(raw_value: str | None) -> list[str]:
    if not raw_value:
        return ["*"]

    origins = [item.strip() for item in raw_value.split(",") if item.strip()]
    return origins or ["*"]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    default_db_path = BACKEND_DIR / "diabetes_checks.db"

    return Settings(
        cors_allow_origins=_parse_origins(os.getenv("CORS_ALLOW_ORIGINS")),
        database_url=os.getenv("DATABASE_URL", f"sqlite:///{default_db_path.as_posix()}"),
    )
