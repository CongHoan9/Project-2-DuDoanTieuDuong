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


# Kiểm tra trạng thái API và backend lưu lịch sử đang dùng.
@router.get("/health")
def health_check():
    # Dùng để kiểm tra app còn chạy và backend lưu lịch sử hiện tại là gì.
    store = get_history_store()
    return {
        "status": "ok",
        "version": APP_VERSION,
        "history_backend": store.name,
    }


# Nhận input dự đoán, chạy model và lưu kết quả vào lịch sử.
@router.post("/predict", response_model=PredictionOutput)
async def predict(data: PredictionInput):
    # Chạy suy luận từ input người dùng rồi lưu ngay kết quả vào lịch sử SQLite.
    result = predict_diabetes(data)
    create_check(data.model_dump(), result)
    return result


# Trả về các bản ghi lịch sử gần đây cho tab History.
@router.get("/history", response_model=list[CheckHistoryResponse])
def get_history(limit: int = 10):
    # Trả về các lần kiểm tra gần nhất để frontend hiển thị trong tab History.
    return get_recent_checks(limit)


# Trả về bộ số liệu tham chiếu phục vụ radar chart và library.
@router.get("/reference-stats")
def reference_stats():
    return get_reference_stats()


# Trả về metadata của model đang phục vụ suy luận.
@router.get("/model-info")
def model_info():
    return get_model_profile()


# Trả về nội dung lâm sàng để frontend dựng các phần giải thích.
@router.get("/clinical-content")
def clinical_content():
    return get_clinical_content()
