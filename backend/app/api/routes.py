from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.prediction import PredictionInput, PredictionOutput
from app.schemas.history import CheckHistoryResponse  # sẽ tạo sau
from app.services.prediction import predict_diabetes
from app.services.history import create_check, get_recent_checks
from app.database import get_db

router = APIRouter(prefix="/api", tags=["diabetes"])

@router.post("/predict", response_model=PredictionOutput)
async def predict(data: PredictionInput, db: Session = Depends(get_db)):
    result = predict_diabetes(data)
    # Lưu vào lịch sử
    input_dict = data.dict()
    create_check(db, input_dict, result)
    return result

@router.get("/history", response_model=list[CheckHistoryResponse])
def get_history(limit: int = 10, db: Session = Depends(get_db)):
    checks = get_recent_checks(db, limit)
    return checks

@router.get("/reference-stats")
def get_reference_stats():
    import json
    with open("assets/reference_stats.json", "r") as f:
        return json.load(f)