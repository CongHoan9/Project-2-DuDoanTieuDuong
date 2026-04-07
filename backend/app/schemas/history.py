from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.prediction import PredictionInput, PredictionOutput


class CheckHistorySummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    glucose: float
    bmi: float
    age: int
    probability: float
    risk_band: str
    risk_score: int
    has_diabetes: str
    created_at: datetime


class CheckHistoryDetailResponse(BaseModel):
    id: int
    created_at: datetime
    input_data: PredictionInput
    prediction: PredictionOutput


def build_history_detail_response(record) -> CheckHistoryDetailResponse:
    return CheckHistoryDetailResponse(
        id=record.id,
        created_at=record.created_at,
        input_data=PredictionInput.model_validate(record.input_payload),
        prediction=PredictionOutput.model_validate(record.prediction_payload),
    )
