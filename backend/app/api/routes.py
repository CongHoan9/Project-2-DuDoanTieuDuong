from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.schemas.history import (
    CheckHistoryDetailResponse,
    CheckHistorySummaryResponse,
    build_history_detail_response,
)
from app.schemas.prediction import PredictionInput, PredictionOutput
from app.services.history import create_check, get_check_detail, get_recent_checks
from app.services.history_store import get_history_store
from app.services.prediction import (
    get_clinical_content,
    get_model_profile,
    get_reference_stats,
    predict_diabetes,
)


router = APIRouter(prefix="/api", tags=["diabetes"])
APP_VERSION = "2.3.0"


@router.get("/health")
def health_check():
    store = get_history_store()
    settings = get_settings()
    return {
        "status": "ok",
        "version": APP_VERSION,
        "history_backend": store.name,
        "database_backend": settings.database_backend,
        "model_load_policy": "preloaded-on-startup and reused from in-memory cache",
    }


@router.post("/predict", response_model=PredictionOutput)
async def predict(data: PredictionInput):
    result = predict_diabetes(data)
    create_check(data.model_dump(), result)
    return result


@router.get("/history", response_model=list[CheckHistorySummaryResponse])
def get_history(limit: int | None = None):
    return get_recent_checks(limit)


@router.get("/history/{check_id}", response_model=CheckHistoryDetailResponse)
def get_history_detail_by_id(check_id: int):
    record = get_check_detail(check_id)
    if record is None:
        raise HTTPException(status_code=404, detail="History record not found")
    return build_history_detail_response(record)


@router.get("/reference-stats")
def reference_stats():
    return get_reference_stats()


@router.get("/model-info")
def model_info():
    return get_model_profile()


@router.get("/clinical-content")
def clinical_content():
    return get_clinical_content()
