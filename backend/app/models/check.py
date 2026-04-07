from sqlalchemy import JSON, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class CheckHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(Integer, primary_key=True, index=True)
    pregnancies = Column(Integer, nullable=False)
    glucose = Column(Float, nullable=False)
    blood_pressure = Column(Float, nullable=False)
    skin_thickness = Column(Float, nullable=False)
    insulin = Column(Float, nullable=False)
    bmi = Column(Float, nullable=False)
    diabetes_pedigree = Column(Float, nullable=False)
    age = Column(Integer, nullable=False)
    probability = Column(Float, nullable=False)
    model_probability = Column(Float, nullable=False)
    clinical_probability = Column(Float, nullable=False)
    risk_score = Column(Integer, nullable=False)
    risk_band = Column(String(50), nullable=False)
    certainty = Column(String(50), nullable=False)
    has_diabetes = Column(String(80), nullable=False)
    summary = Column(Text, nullable=False)
    advice = Column(Text, nullable=False)
    input_payload = Column(JSON, nullable=False)
    prediction_payload = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
