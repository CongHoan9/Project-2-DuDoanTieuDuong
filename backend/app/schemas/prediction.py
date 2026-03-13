from pydantic import BaseModel, Field
from typing import Literal

class PredictionInput(BaseModel):
    Pregnancies: int = Field(..., ge=0, description="Số lần mang thai")
    Glucose: float = Field(..., ge=0, description="Nồng độ glucose (mg/dL)")
    BloodPressure: float = Field(..., ge=0, description="Huyết áp tâm thu (mm Hg)")
    SkinThickness: float = Field(..., ge=0, description="Độ dày da (mm)")
    Insulin: float = Field(..., ge=0, description="Nồng độ insulin (mu U/ml)")
    BMI: float = Field(..., ge=0, description="Chỉ số khối cơ thể")
    DiabetesPedigreeFunction: float = Field(..., ge=0, description="Hàm phả hệ tiểu đường")
    Age: int = Field(..., ge=21, description="Tuổi (≥21)")

class PredictionOutput(BaseModel):
    has_diabetes: Literal["Có nguy cơ cao", "Nguy cơ thấp"]
    probability: float  # 0.0 -> 1.0
    advice: str
    # Sau này thêm radar_data nếu cần