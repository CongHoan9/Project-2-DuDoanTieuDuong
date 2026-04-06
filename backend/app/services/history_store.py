from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from functools import lru_cache
from typing import Any, Protocol

from app.config import get_settings
from app.database import SessionLocal
from app.models.check import CheckHistory
from app.schemas.prediction import PredictionOutput


logger = logging.getLogger(__name__)


class HistoryStore(Protocol):
    name: str

    def create_check(self, input_data: dict[str, Any], result: PredictionOutput) -> Any:
        ...

    def get_recent_checks(self, limit: int = 10) -> list[Any]:
        ...


def _build_history_payload(input_data: dict[str, Any], result: PredictionOutput) -> dict[str, Any]:
    return {
        "pregnancies": input_data["Pregnancies"],
        "glucose": input_data["Glucose"],
        "blood_pressure": input_data["BloodPressure"],
        "skin_thickness": input_data["SkinThickness"],
        "insulin": input_data["Insulin"],
        "bmi": input_data["BMI"],
        "diabetes_pedigree": input_data["DiabetesPedigreeFunction"],
        "age": input_data["Age"],
        "probability": result.probability,
        "has_diabetes": result.has_diabetes,
        "advice": result.advice,
    }


class SqliteHistoryStore:
    name = "sqlite"

    def create_check(self, input_data: dict[str, Any], result: PredictionOutput) -> CheckHistory:
        db = SessionLocal()
        try:
            record = CheckHistory(**_build_history_payload(input_data, result))
            db.add(record)
            db.commit()
            db.refresh(record)
            return record
        finally:
            db.close()

    def get_recent_checks(self, limit: int = 10) -> list[CheckHistory]:
        db = SessionLocal()
        try:
            safe_limit = max(1, min(limit, 100))
            return (
                db.query(CheckHistory)
                .order_by(CheckHistory.created_at.desc())
                .limit(safe_limit)
                .all()
            )
        finally:
            db.close()


class SupabaseHistoryStore:
    name = "supabase"

    def __init__(self, url: str, api_key: str, table: str):
        base_url = url.rstrip("/")
        table_name = table.strip("/")
        self.endpoint = f"{base_url}/rest/v1/{table_name}"
        self.api_key = api_key

    def _request(
        self,
        method: str,
        query: str = "",
        payload: dict[str, Any] | None = None,
        prefer: str | None = "return=representation",
    ) -> list[dict[str, Any]]:
        request_url = self.endpoint if not query else f"{self.endpoint}?{query}"
        headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }

        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload).encode("utf-8")

        if prefer:
            headers["Prefer"] = prefer

        request = urllib.request.Request(request_url, data=data, headers=headers, method=method)

        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                raw_body = response.read().decode("utf-8").strip()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace").strip()
            raise RuntimeError(f"Supabase returned {exc.code}: {detail or exc.reason}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Supabase is unreachable: {exc.reason}") from exc

        if not raw_body:
            return []

        data = json.loads(raw_body)
        if isinstance(data, list):
            return data
        return [data]

    def create_check(self, input_data: dict[str, Any], result: PredictionOutput) -> dict[str, Any]:
        payload = _build_history_payload(input_data, result)
        rows = self._request("POST", payload=payload)
        return rows[0] if rows else payload

    def get_recent_checks(self, limit: int = 10) -> list[dict[str, Any]]:
        safe_limit = max(1, min(limit, 100))
        query = urllib.parse.urlencode(
            {
                "select": "*",
                "order": "created_at.desc",
                "limit": str(safe_limit),
            }
        )
        return self._request("GET", query=query, prefer=None)


class ResilientHistoryStore:
    def __init__(self, primary: HistoryStore | None, fallback: HistoryStore):
        self.primary = primary
        self.fallback = fallback
        self.name = primary.name if primary else fallback.name
        self.fallback_name = fallback.name if primary else None

    def create_check(self, input_data: dict[str, Any], result: PredictionOutput) -> Any:
        if self.primary:
            try:
                return self.primary.create_check(input_data, result)
            except Exception:
                logger.exception("Primary history store failed during create_check; using sqlite fallback.")
        return self.fallback.create_check(input_data, result)

    def get_recent_checks(self, limit: int = 10) -> list[Any]:
        if self.primary:
            try:
                return self.primary.get_recent_checks(limit)
            except Exception:
                logger.exception("Primary history store failed during get_recent_checks; using sqlite fallback.")
        return self.fallback.get_recent_checks(limit)


@lru_cache(maxsize=1)
def get_history_store() -> ResilientHistoryStore | SqliteHistoryStore:
    settings = get_settings()
    sqlite_store = SqliteHistoryStore()

    if settings.history_backend == "sqlite":
        return sqlite_store

    wants_supabase = settings.history_backend == "supabase" or (
        settings.history_backend == "auto" and settings.supabase_url and settings.supabase_key
    )

    if wants_supabase and settings.supabase_url and settings.supabase_key:
        supabase_store = SupabaseHistoryStore(
            url=settings.supabase_url,
            api_key=settings.supabase_key,
            table=settings.supabase_table,
        )
        return ResilientHistoryStore(primary=supabase_store, fallback=sqlite_store)

    if settings.history_backend == "supabase":
        logger.warning(
            "HISTORY_BACKEND is set to supabase but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. "
            "Falling back to sqlite."
        )

    return sqlite_store
