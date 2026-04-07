from datetime import datetime

from pydantic import BaseModel, Field

# định nghĩa các thuộc tính đầu vào và ràng buộc
class PredictionInput(BaseModel): 
    Pregnancies: int = Field(..., ge=0, le=20)                  # số lần mang thai
    Glucose: float = Field(..., ge=0, le=400)                   # nồng độ glucose trong máu
    BloodPressure: float = Field(..., ge=0, le=200)             # huyết áp
    SkinThickness: float = Field(..., ge=0, le=120)             # độ dày lớp mỡ dưới da
    Insulin: float = Field(..., ge=0, le=1200)                  # nồng độ insulin
    BMI: float = Field(..., ge=0, le=80)                        # chỉ số khối cơ thể
    DiabetesPedigreeFunction: float = Field(..., ge=0, le=5)    # hàm di truyền bệnh tiểu đường
    Age: int = Field(..., ge=0, le=120)                         # tuổi tác

# định nghĩa cảnh báo lâm sàng
class ClinicalAlert(BaseModel):
    level: str
    title: str
    detail: str

# định nghĩa hành động khuyến nghị
class RecommendedAction(BaseModel):
    timeframe: str
    action: str
    reason: str

# định nghĩa insight chi tiết về từng chỉ số
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

# định nghĩa output dự đoán với nhiều trường chi tiết hơn để phục vụ UI và giải thích.
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
