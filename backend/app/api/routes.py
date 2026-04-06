from fastapi import APIRouter

from app.schemas.history import CheckHistoryResponse
from app.schemas.prediction import PredictionInput, PredictionOutput
from app.services.history import create_check, get_recent_checks
from app.services.history_store import get_history_store
from app.services.prediction import (
    get_clinical_content,
    get_model_profile,
    get_reference_stats,
    predict_diabetes,
)


router = APIRouter(prefix="/api", tags=["diabetes"])
APP_VERSION = "2.2.0"


@router.get("/health")
def health_check():
    store = get_history_store()
    return {
        "status": "ok",
        "version": APP_VERSION,
        "history_backend": store.name,
        "history_fallback": getattr(store, "fallback_name", None),
    }


@router.post("/predict", response_model=PredictionOutput)
async def predict(data: PredictionInput):
    result = predict_diabetes(data)
    create_check(data.model_dump(), result)
    return result


@router.get("/history", response_model=list[CheckHistoryResponse])
def get_history(limit: int = 10):
    return get_recent_checks(limit)


@router.get("/reference-stats")
def reference_stats():
    return get_reference_stats()


@router.get("/model-info")
def model_info():
    return get_model_profile()


@router.get("/clinical-content")
def clinical_content():
    return get_clinical_content()
