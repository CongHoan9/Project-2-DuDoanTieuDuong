from pathlib import Path

import joblib
import numpy as np

from app.schemas.prediction import PredictionInput, PredictionOutput


# 📁 Base path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ASSETS_DIR = BASE_DIR / "assets"


# 🤖 Load model (chỉ load 1 lần)
model = joblib.load(ASSETS_DIR / "diabetes_model.pkl")
scaler = joblib.load(ASSETS_DIR / "scaler.pkl")
imputer = joblib.load(ASSETS_DIR / "imputer_median.pkl")


# 📊 Feature order
FEATURE_ORDER = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
]


def predict_diabetes(data: PredictionInput) -> PredictionOutput:
    # 👉 convert sang dict
    input_dict = data.model_dump()

    # 👉 đúng thứ tự feature
    input_array = np.array([[input_dict[col] for col in FEATURE_ORDER]])

    # 👉 xử lý dữ liệu
    input_array = imputer.transform(input_array)
    input_scaled = scaler.transform(input_array)

    # 👉 predict
    probability = float(model.predict_proba(input_scaled)[0][1])
    prediction = 1 if probability >= 0.5 else 0

    has_diabetes = "Có nguy cơ cao" if prediction == 1 else "Nguy cơ thấp"

    # 🧠 generate advice
    advice_parts = []

    if input_dict["Glucose"] > 126:
        advice_parts.append("Glucose cao: nên giảm đồ ngọt và kiểm soát đường huyết.")

    if input_dict["BMI"] > 25:
        advice_parts.append("BMI cao: nên ăn uống hợp lý và tăng vận động.")

    if input_dict["BloodPressure"] > 80:
        advice_parts.append("Huyết áp cao: hạn chế muối và theo dõi thường xuyên.")

    if input_dict["Age"] > 45:
        advice_parts.append("Trên 45 tuổi: nên khám sức khỏe định kỳ.")

    advice = " ".join(advice_parts) or "Chỉ số ổn. Tiếp tục duy trì lối sống lành mạnh."

    if probability > 0.7:
        advice += " Nguy cơ cao, nên đi khám sớm."

    return PredictionOutput(
        has_diabetes=has_diabetes,
        probability=round(probability, 3),
        advice=advice,
    )