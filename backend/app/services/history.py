from sqlalchemy.orm import Session
from app.models.check import CheckHistory
from app.schemas.prediction import PredictionOutput  # để tái sử dụng

def create_check(db: Session, input_data: dict, result: PredictionOutput):
    db_check = CheckHistory(
        pregnancies=input_data["Pregnancies"],
        glucose=input_data["Glucose"],
        blood_pressure=input_data["BloodPressure"],
        skin_thickness=input_data["SkinThickness"],
        insulin=input_data["Insulin"],
        bmi=input_data["BMI"],
        diabetes_pedigree=input_data["DiabetesPedigreeFunction"],
        age=input_data["Age"],
        probability=result.probability,
        has_diabetes=result.has_diabetes,
        advice=result.advice
    )
    db.add(db_check)
    db.commit()
    db.refresh(db_check)
    return db_check

def get_recent_checks(db: Session, limit: int = 10):
    return db.query(CheckHistory).order_by(CheckHistory.created_at.desc()).limit(limit).all()