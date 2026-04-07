from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.config import get_settings
from app.database import SessionLocal
from app.models.check import CheckHistory
from app.schemas.prediction import PredictionOutput


def _build_history_payload(input_data: dict[str, Any], result: PredictionOutput) -> dict[str, Any]:
    prediction_payload = result.model_dump(mode="json")

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
        "model_probability": result.model_probability,
        "clinical_probability": result.clinical_probability,
        "risk_score": result.risk_score,
        "risk_band": result.risk_band,
        "certainty": result.certainty,
        "has_diabetes": result.has_diabetes,
        "summary": result.summary,
        "advice": result.advice,
        "input_payload": input_data,
        "prediction_payload": prediction_payload,
    }


class DatabaseHistoryStore:
    def __init__(self) -> None:
        self.name = get_settings().database_backend

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
                .order_by(CheckHistory.created_at.desc(), CheckHistory.id.desc())
                .limit(safe_limit)
                .all()
            )
        finally:
            db.close()

    def get_check(self, check_id: int) -> CheckHistory | None:
        db = SessionLocal()
        try:
            return db.get(CheckHistory, check_id)
        finally:
            db.close()


@lru_cache(maxsize=1)
def get_history_store() -> DatabaseHistoryStore:
    return DatabaseHistoryStore()
