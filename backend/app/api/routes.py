import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.history import CheckHistoryResponse
from app.schemas.prediction import PredictionInput, PredictionOutput
from app.services.history import create_check, get_recent_checks
from app.services.prediction import predict_diabetes

router = APIRouter(prefix="/api", tags=["diabetes"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
REFERENCE_STATS_FILE = BASE_DIR / "assets" / "reference_stats.json"

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.post("/predict", response_model=PredictionOutput)
async def predict(data: PredictionInput, db: Session = Depends(get_db)):
    result = predict_diabetes(data)
    create_check(db, data.model_dump(), result)
    return result

@router.get("/history", response_model=list[CheckHistoryResponse])
def get_history(limit: int = 10, db: Session = Depends(get_db)):
    return get_recent_checks(db, limit)

@router.get("/reference-stats")
def get_reference_stats():
    try:
        with REFERENCE_STATS_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"error": "reference_stats.json not found"}