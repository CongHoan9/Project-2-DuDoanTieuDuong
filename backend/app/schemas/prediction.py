from datetime import datetime

from pydantic import BaseModel, Field


class PredictionInput(BaseModel):
    Pregnancies: int = Field(..., ge=0, le=20)
    Glucose: float = Field(..., ge=0, le=400)
    BloodPressure: float = Field(..., ge=0, le=200)
    SkinThickness: float = Field(..., ge=0, le=120)
    Insulin: float = Field(..., ge=0, le=1200)
    BMI: float = Field(..., ge=0, le=80)
    DiabetesPedigreeFunction: float = Field(..., ge=0, le=5)
    Age: int = Field(..., ge=0, le=120)


class ClinicalAlert(BaseModel):
    level: str
    title: str
    detail: str


class RecommendedAction(BaseModel):
    timeframe: str
    action: str
    reason: str


class MetricInsight(BaseModel):
    metric: str
    label: str
    value: float
    unit: str
    status: str
    severity: str
    reference: str
    clinical_note: str
    effect: str


class PredictionOutput(BaseModel):
    has_diabetes: str
    probability: float
    model_probability: float
    clinical_probability: float
    risk_band: str
    risk_score: int
    certainty: str
    summary: str
    advice: str
    clinical_interpretation: str
    key_drivers: list[str]
    alerts: list[ClinicalAlert]
    recommended_actions: list[RecommendedAction]
    metric_insights: list[MetricInsight]
    missing_data_flags: list[str]
    disclaimer: str
    generated_at: datetime
