import joblib
import numpy as np
import os
from pathlib import Path
from app.schemas.prediction import PredictionInput, PredictionOutput

# Đường dẫn tương đối từ backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ASSETS_DIR = BASE_DIR / "assets"

# Load các file pickle (chạy lần đầu sẽ báo lỗi nếu chưa có → train model trước)
model = joblib.load(ASSETS_DIR / "diabetes_model.pkl")
scaler = joblib.load(ASSETS_DIR / "scaler.pkl")
imputer = joblib.load(ASSETS_DIR / "imputer_median.pkl")

# Các cột theo đúng thứ tự khi train
FEATURE_ORDER = [
    "Pregnancies", "Glucose", "BloodPressure", "SkinThickness",
    "Insulin", "BMI", "DiabetesPedigreeFunction", "Age"
]

def predict_diabetes(data: PredictionInput) -> PredictionOutput:
    # Chuyển input thành dict → array
    input_dict = data.dict()
    input_array = np.array([[input_dict[col] for col in FEATURE_ORDER]])

    # Impute (nếu có 0 → NaN rồi fill median)
    input_array = imputer.transform(input_array)

    # Scale
    input_scaled = scaler.transform(input_array)

    # Predict
    prob = model.predict_proba(input_scaled)[0][1]  # xác suất class 1 (có tiểu đường)
    prediction = 1 if prob >= 0.5 else 0

    # Xác định kết quả
    has_diabetes = "Có nguy cơ cao" if prediction == 1 else "Nguy cơ thấp"

    # Lời khuyên đơn giản (có thể mở rộng dựa trên chỉ số cao)
    advice_parts = []
    if input_dict["Glucose"] > 126:
        advice_parts.append("Glucose cao → nên kiểm soát đường huyết, hạn chế đồ ngọt, tinh bột.")
    if input_dict["BMI"] > 25:
        advice_parts.append("BMI cao → nên giảm cân, tập thể dục đều đặn.")
    if input_dict["Age"] > 45:
        advice_parts.append("Tuổi cao → kiểm tra sức khỏe định kỳ.")
    advice = " ".join(advice_parts) or "Duy trì lối sống lành mạnh và kiểm tra sức khỏe thường xuyên."
    if prob > 0.7:
        advice += " Nguy cơ khá cao, bạn nên đi khám bác sĩ sớm để được tư vấn chi tiết."

    return PredictionOutput(
        has_diabetes=has_diabetes,
        probability=round(float(prob), 3),
        advice=advice
    )