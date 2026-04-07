from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.database import SessionLocal
from app.models.check import CheckHistory
from app.schemas.prediction import PredictionOutput


# Gom input người dùng và output model thành payload đúng schema bảng lịch sử.
def _build_history_payload(input_data: dict[str, Any], result: PredictionOutput) -> dict[str, Any]:
    # Chuyển input + kết quả model về đúng các cột của bảng check_history.
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


# Lớp chịu trách nhiệm ghi/đọc lịch sử dự đoán từ SQLite.
class SqliteHistoryStore:
    name = "sqlite"

    def create_check(self, input_data: dict[str, Any], result: PredictionOutput) -> CheckHistory:
        # Mỗi lần dự đoán sẽ sinh ra 1 record mới trong SQLite.
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
        # Chỉ lấy một số bản ghi mới nhất để tránh trả về quá nhiều dữ liệu.
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


# Tạo hoặc tái sử dụng một SQLite history store duy nhất cho toàn app.
@lru_cache(maxsize=1)
def get_history_store() -> SqliteHistoryStore:
    # Cache store để toàn app tái sử dụng cùng một lớp truy cập lịch sử.
    return SqliteHistoryStore()
