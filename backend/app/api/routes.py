from fastapi import APIRouter

from app.config import get_settings
from app.schemas.prediction import PredictionInput, PredictionOutput
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
    settings = get_settings()
    return {
        "status": "ok",
        "version": APP_VERSION,
        "history_backend": "supabase.public.predictions",
        "database_backend": settings.database_backend,
        "model_load_policy": "preloaded-on-startup and reused from in-memory cache",
    }


@router.get("/supabase-config")
def supabase_public_config():
    settings = get_settings()
    return {
        "url": settings.supabase_url,
        "anon_key": settings.supabase_public_key,
    }


@router.post("/predict", response_model=PredictionOutput)
async def predict(data: PredictionInput):
    return predict_diabetes(data)


@router.get("/reference-stats")
def reference_stats():
    return get_reference_stats()


@router.get("/model-info")
def model_info():
    return get_model_profile()


@router.get("/clinical-content")
def clinical_content():
    return get_clinical_content()

