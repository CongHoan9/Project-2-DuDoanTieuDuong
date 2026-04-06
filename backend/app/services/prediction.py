import json
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

from app.schemas.prediction import ClinicalAlert, MetricInsight, PredictionInput, PredictionOutput, RecommendedAction


BASE_DIR = Path(__file__).resolve().parent.parent.parent
ASSETS_DIR = BASE_DIR / "assets"
REFERENCE_STATS_FILE = ASSETS_DIR / "reference_stats.json"

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

ZERO_AS_MISSING = {"Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"}

FEATURE_LABELS = {
    "Pregnancies": "Số lần mang thai",
    "Glucose": "Đường huyết",
    "BloodPressure": "Huyết áp tâm trương",
    "SkinThickness": "Bề dày nếp gấp da",
    "Insulin": "Insulin",
    "BMI": "BMI",
    "DiabetesPedigreeFunction": "Tiền sử gia đình",
    "Age": "Tuổi",
}

FEATURE_UNITS = {
    "Pregnancies": "lần",
    "Glucose": "mg/dL",
    "BloodPressure": "mmHg",
    "SkinThickness": "mm",
    "Insulin": "mu U/mL",
    "BMI": "kg/m²",
    "DiabetesPedigreeFunction": "điểm",
    "Age": "tuổi",
}

REFERENCE_FALLBACK = {
    "Pregnancies": 3.0,
    "Glucose": 117.0,
    "BloodPressure": 72.0,
    "SkinThickness": 29.0,
    "Insulin": 125.0,
    "BMI": 32.4,
    "DiabetesPedigreeFunction": 0.3825,
    "Age": 29.0,
}

MODEL_BENCHMARK = {
    "dataset": "Pima Indians Diabetes Database",
    "model_type": "Tuned RandomForest + clinical calibration layer",
    "holdout_accuracy": 0.77,
    "holdout_roc_auc": 0.829,
    "cross_validation_roc_auc": 0.831,
    "best_params": {
        "class_weight": "balanced",
        "max_depth": 10,
        "min_samples_split": 5,
        "n_estimators": 100,
    },
    "source": "notebooks/03_Final_Model_Training_and_Save.ipynb",
}

REFERENCE_RANGES = [
    {
        "metric": "Glucose",
        "label": "Đường huyết lúc đói",
        "unit": "mg/dL",
        "optimal": "70 - 99",
        "watch": "100 - 125",
        "high": ">= 126",
        "note": "Mốc gợi ý tiền đái tháo đường và đái tháo đường cần xác nhận xét nghiệm.",
    },
    {
        "metric": "BMI",
        "label": "Chỉ số khối cơ thể",
        "unit": "kg/m²",
        "optimal": "18.5 - 24.9",
        "watch": "25 - 29.9",
        "high": ">= 30",
        "note": "BMI cao làm tăng nguy cơ đề kháng insulin và bệnh tim mạch.",
    },
    {
        "metric": "BloodPressure",
        "label": "Huyết áp tâm trương",
        "unit": "mmHg",
        "optimal": "< 80",
        "watch": "80 - 89",
        "high": ">= 90",
        "note": "Tăng huyết áp thường đi cùng hội chứng chuyển hóa.",
    },
    {
        "metric": "Age",
        "label": "Nhóm tuổi",
        "unit": "tuổi",
        "optimal": "< 35",
        "watch": "35 - 44",
        "high": ">= 45",
        "note": "Nguy cơ nền tăng dần theo tuổi, đặc biệt sau 45.",
    },
    {
        "metric": "DiabetesPedigreeFunction",
        "label": "Yếu tố gia đình",
        "unit": "điểm",
        "optimal": "< 0.4",
        "watch": "0.4 - 0.79",
        "high": ">= 0.8",
        "note": "Điểm càng cao càng cho thấy nguy cơ di truyền và môi trường gia đình đáng lưu ý.",
    },
]

CARE_PATHWAY = [
    {
        "title": "Xác nhận cận lâm sàng",
        "timeframe": "Trong 1 - 2 tuần",
        "detail": "Ưu tiên HbA1c, đường huyết lúc đói lặp lại và hồ sơ lipid nếu nguy cơ từ trung bình trở lên.",
    },
    {
        "title": "Đánh giá nội tiết",
        "timeframe": "Trong 7 ngày nếu glucose >= 126",
        "detail": "Hẹn khám Nội tiết hoặc bác sĩ gia đình để xác nhận chẩn đoán và đánh giá biến chứng sớm.",
    },
    {
        "title": "Can thiệp lối sống",
        "timeframe": "4 - 12 tuần",
        "detail": "Theo dõi cân nặng, khẩu phần tinh bột, hoạt động thể lực và huyết áp tại nhà.",
    },
]

EDUCATION_MODULES = [
    {
        "title": "Dinh dưỡng chuyển hóa",
        "detail": "Tập trung khẩu phần giàu đạm nạc, rau xanh, chất xơ hòa tan và giảm đồ uống có đường.",
    },
    {
        "title": "Theo dõi huyết áp và vòng bụng",
        "detail": "Người có BMI cao hoặc huyết áp tăng nên theo dõi thêm vòng bụng và huyết áp tại nhà mỗi tuần.",
    },
    {
        "title": "Tầm soát định kỳ",
        "detail": "Nếu có tiền sử gia đình hoặc trên 45 tuổi, nên kiểm tra đường huyết và HbA1c định kỳ ngay cả khi triệu chứng chưa rõ.",
    },
]

METRIC_RULES = {
    "Pregnancies": {
        "missing_points": 0,
        "missing_reference": "",
        "missing_note": "",
        "missing_effect": "",
        "ranges": [
            {
                "max": 3,
                "status": "Mức nền thấp",
                "severity": "normal",
                "points": 0,
                "reference": "Số lần mang thai thấp ít làm thay đổi nguy cơ nếu các chỉ số khác tốt.",
                "clinical_note": "Chỉ số này có ý nghĩa trong bối cảnh dữ liệu nghiên cứu ban đầu.",
                "effect": "Đóng góp thấp vào tổng nguy cơ.",
            },
            {
                "max": 6,
                "status": "Mức vừa",
                "severity": "watch",
                "points": 2,
                "reference": "Nhiều lần mang thai có thể đi cùng thay đổi chuyển hóa kéo dài ở một số người.",
                "clinical_note": "Cần diễn giải cùng tuổi, BMI và đường huyết.",
                "effect": "Tăng nhẹ nguy cơ nền.",
                "driver": "cao hơn median tham chiếu của nhóm dữ liệu.",
            },
            {
                "max": None,
                "status": "Mức cao",
                "severity": "watch",
                "points": 4,
                "reference": "Số lần mang thai cao hơn thường cần nhìn cùng nguy cơ đái tháo đường thai kỳ trước đó nếu có.",
                "clinical_note": "Đây là yếu tố nền chứ không phải chẩn đoán độc lập.",
                "effect": "Tăng nguy cơ nền mức nhẹ đến vừa.",
                "driver": "ở mức cao so với median tham chiếu.",
            },
        ],
    },
    "Glucose": {
        "missing_points": 6,
        "missing_reference": "Nên có giá trị đường huyết hợp lệ để đánh giá chính xác.",
        "missing_note": "Mốc 0 thường là dữ liệu thiếu trong bộ Pima hơn là giá trị sinh lý thực.",
        "missing_effect": "Model sẽ nội suy theo median nên độ tin cậy giảm.",
        "ranges": [
            {
                "max": 70,
                "status": "Thấp bất thường",
                "severity": "high",
                "points": 10,
                "reference": "Khoảng thường gặp lúc đói: 70 - 99 mg/dL.",
                "clinical_note": "Đường huyết thấp cần đối chiếu bối cảnh lấy mẫu và triệu chứng.",
                "effect": "Không phải tín hiệu điển hình của đái tháo đường nhưng cần xác minh dữ liệu.",
                "driver": "thấp ngoài khoảng sinh lý mong đợi.",
            },
            {
                "max": 100,
                "status": "Bình thường",
                "severity": "normal",
                "points": 0,
                "reference": "Khoảng thường gặp lúc đói: 70 - 99 mg/dL.",
                "clinical_note": "Đây là vùng thuận lợi nhất cho sàng lọc nguy cơ đái tháo đường.",
                "effect": "Không làm tăng đáng kể nguy cơ chuyển hóa.",
            },
            {
                "max": 126,
                "status": "Tiền đái tháo đường",
                "severity": "watch",
                "points": 18,
                "reference": "100 - 125 mg/dL là vùng tiền đái tháo đường nếu lấy máu lúc đói.",
                "clinical_note": "Nên xác nhận bằng HbA1c hoặc lặp lại xét nghiệm khi có yếu tố nguy cơ.",
                "effect": "Tăng đáng kể xác suất đề kháng insulin và tiến triển thành đái tháo đường.",
                "driver": "đang nằm trong vùng tiền đái tháo đường.",
            },
            {
                "max": 200,
                "status": "Tăng cao",
                "severity": "high",
                "points": 30,
                "reference": ">= 126 mg/dL là ngưỡng cần xác nhận đái tháo đường bằng xét nghiệm chuẩn.",
                "clinical_note": "Đây là tín hiệu mạnh nhất trong mô hình nguy cơ hiện tại.",
                "effect": "Làm tăng mạnh nguy cơ cần đánh giá nội tiết sớm.",
                "driver": "đã vượt ngưỡng gợi ý đái tháo đường.",
            },
            {
                "max": None,
                "status": "Rất cao",
                "severity": "critical",
                "points": 36,
                "reference": "Giá trị rất cao cần đánh giá khẩn hơn, đặc biệt khi kèm triệu chứng.",
                "clinical_note": "Nên đối chiếu với xét nghiệm chuẩn và triệu chứng lâm sàng ngay.",
                "effect": "Nguy cơ chuyển hóa rất cao và cần khám sớm.",
                "driver": "rất cao và cần ưu tiên xác nhận lâm sàng.",
            },
        ],
    },
    "BloodPressure": {
        "missing_points": 3,
        "missing_reference": "Huyết áp tâm trương cần có số đo thực.",
        "missing_note": "Giá trị 0 thường là thiếu dữ liệu trong bộ huấn luyện chứ không phải chỉ số sinh lý.",
        "missing_effect": "Mất một đầu mối quan trọng của hội chứng chuyển hóa.",
        "ranges": [
            {
                "max": 60,
                "status": "Thấp",
                "severity": "watch",
                "points": 1,
                "reference": "Huyết áp tâm trương thường mong đợi dưới 80 mmHg.",
                "clinical_note": "Không phải dấu hiệu điển hình của đái tháo đường nhưng nên đọc cùng triệu chứng thực tế.",
                "effect": "Không làm tăng rõ nguy cơ chuyển hóa trong mô hình này.",
            },
            {
                "max": 80,
                "status": "Ổn định",
                "severity": "normal",
                "points": 0,
                "reference": "Mục tiêu thường dùng cho tâm trương: dưới 80 mmHg.",
                "clinical_note": "Huyết áp ổn định giúp giảm gánh nặng tim mạch đi kèm.",
                "effect": "Không làm tăng thêm nguy cơ đáng kể.",
            },
            {
                "max": 90,
                "status": "Cận cao",
                "severity": "watch",
                "points": 5,
                "reference": "80 - 89 mmHg là vùng cần theo dõi thêm nguy cơ tim mạch.",
                "clinical_note": "Tăng huyết áp nhẹ thường song hành với tình trạng đề kháng insulin.",
                "effect": "Làm tăng nguy cơ nền mức nhẹ đến vừa.",
                "driver": "cao hơn mục tiêu chuyển hóa khuyến nghị.",
            },
            {
                "max": 100,
                "status": "Tăng cao",
                "severity": "high",
                "points": 10,
                "reference": ">= 90 mmHg cần đánh giá nguy cơ tim mạch tích cực hơn.",
                "clinical_note": "Cần theo dõi cùng huyết áp tâm thu nếu có.",
                "effect": "Làm tăng nguy cơ phối hợp của hội chứng chuyển hóa.",
                "driver": "nằm trong vùng tăng huyết áp tâm trương.",
            },
            {
                "max": None,
                "status": "Rất cao",
                "severity": "critical",
                "points": 14,
                "reference": "Giá trị cao rõ rệt cần được kiểm tra lại và đánh giá tim mạch.",
                "clinical_note": "Đây là yếu tố đồng mắc làm tăng biến cố chuyển hóa và mạch máu.",
                "effect": "Tăng mạnh nguy cơ đồng mắc tim mạch.",
                "driver": "rất cao và cần theo dõi tim mạch sát hơn.",
            },
        ],
    },
    "SkinThickness": {
        "missing_points": 2,
        "missing_reference": "Nếp gấp da bằng 0 thường là dữ liệu khuyết.",
        "missing_note": "Chỉ số này chủ yếu bổ trợ cho ước lượng mỡ dưới da.",
        "missing_effect": "Ảnh hưởng nhỏ đến mô hình nhưng vẫn làm giảm độ đầy đủ dữ liệu.",
        "ranges": [
            {
                "max": 35,
                "status": "Trong vùng tham chiếu",
                "severity": "normal",
                "points": 0,
                "reference": "Nhiều mẫu tham chiếu nằm quanh 20 - 35 mm.",
                "clinical_note": "Chỉ số này đóng vai trò phụ so với glucose và BMI.",
                "effect": "Không tạo thêm cảnh báo lớn.",
            },
            {
                "max": 45,
                "status": "Tăng nhẹ",
                "severity": "watch",
                "points": 2,
                "reference": "Giá trị cao có thể phản ánh tăng mỡ dưới da.",
                "clinical_note": "Nên đọc cùng BMI để hiểu đúng ý nghĩa lâm sàng.",
                "effect": "Bổ sung thêm tín hiệu nguy cơ chuyển hóa.",
                "driver": "cao hơn median tham chiếu.",
            },
            {
                "max": None,
                "status": "Tăng rõ",
                "severity": "high",
                "points": 4,
                "reference": "Giá trị tăng rõ gợi ý tích lũy mỡ dưới da cao hơn trung vị tham chiếu.",
                "clinical_note": "Tín hiệu này có ý nghĩa khi đi cùng BMI tăng.",
                "effect": "Làm tăng thêm nguy cơ trong lớp mô mỡ ngoại vi.",
                "driver": "tăng rõ so với tham chiếu.",
            },
        ],
    },
    "Insulin": {
        "missing_points": 3,
        "missing_reference": "Insulin bằng 0 thường là dữ liệu thiếu trong bộ huấn luyện.",
        "missing_note": "Ý nghĩa insulin phụ thuộc thời điểm lấy mẫu nên cần diễn giải thận trọng.",
        "missing_effect": "Model phải nội suy nên giảm độ chắc chắn.",
        "ranges": [
            {
                "max": 25,
                "status": "Thấp",
                "severity": "watch",
                "points": 2,
                "reference": "Cần đọc theo bối cảnh xét nghiệm và nhịn đói.",
                "clinical_note": "Insulin thấp không tự động đồng nghĩa nguy cơ cao nhưng cần xem cùng glucose.",
                "effect": "Gợi ý dữ liệu cần giải thích thận trọng.",
            },
            {
                "max": 181,
                "status": "Trong vùng tham chiếu",
                "severity": "normal",
                "points": 0,
                "reference": "Nhiều mẫu tham chiếu của bộ dữ liệu nằm quanh vùng này.",
                "clinical_note": "Insulin không phải chỉ số quyết định chính trong ứng dụng hiện tại.",
                "effect": "Tác động mức thấp đến tổng nguy cơ.",
            },
            {
                "max": 251,
                "status": "Tăng",
                "severity": "watch",
                "points": 4,
                "reference": "Insulin tăng có thể đi cùng đề kháng insulin.",
                "clinical_note": "Nên đối chiếu với glucose và BMI để hiểu đúng ý nghĩa.",
                "effect": "Tăng thêm khả năng rối loạn chuyển hóa.",
                "driver": "cao hơn vùng tham chiếu thường gặp.",
            },
            {
                "max": None,
                "status": "Tăng rõ",
                "severity": "high",
                "points": 7,
                "reference": "Insulin tăng cao thường gợi ý tình trạng đề kháng insulin hoặc bối cảnh lấy mẫu đặc biệt.",
                "clinical_note": "Nên xác nhận cùng glucose, HbA1c và thăm khám chuyên khoa.",
                "effect": "Làm tăng nguy cơ chuyển hóa rõ hơn.",
                "driver": "tăng rõ và có thể liên quan đề kháng insulin.",
            },
        ],
    },
    "BMI": {
        "missing_points": 4,
        "missing_reference": "Cần BMI hợp lệ để đánh giá nguy cơ chuyển hóa.",
        "missing_note": "BMI bằng 0 thường là dữ liệu thiếu trong bộ dữ liệu huấn luyện.",
        "missing_effect": "Model sẽ thay bằng median nên mất thông tin quan trọng.",
        "ranges": [
            {
                "max": 18.5,
                "status": "Thiếu cân",
                "severity": "watch",
                "points": 2,
                "reference": "Khoảng tối ưu thường dùng: 18.5 - 24.9 kg/m².",
                "clinical_note": "Thiếu cân không điển hình cho hội chứng chuyển hóa nhưng cần đánh giá bối cảnh dinh dưỡng.",
                "effect": "Không làm tăng nguy cơ đái tháo đường kiểu điển hình bằng thừa cân hoặc béo phì.",
            },
            {
                "max": 25,
                "status": "Tối ưu",
                "severity": "normal",
                "points": 0,
                "reference": "Khoảng tối ưu thường dùng: 18.5 - 24.9 kg/m².",
                "clinical_note": "BMI ở vùng tốt giúp giảm nguy cơ đề kháng insulin.",
                "effect": "Không làm tăng đáng kể nguy cơ chuyển hóa.",
            },
            {
                "max": 30,
                "status": "Thừa cân",
                "severity": "watch",
                "points": 8,
                "reference": "25 - 29.9 kg/m² là vùng thừa cân.",
                "clinical_note": "Giảm 5 - 7% cân nặng đã có thể cải thiện nguy cơ chuyển hóa.",
                "effect": "Làm tăng nguy cơ đề kháng insulin mức sớm.",
                "driver": "thuộc nhóm thừa cân.",
            },
            {
                "max": 35,
                "status": "Béo phì độ I",
                "severity": "high",
                "points": 14,
                "reference": ">= 30 kg/m² là vùng béo phì.",
                "clinical_note": "Béo phì đi kèm tăng nguy cơ gan nhiễm mỡ, tăng huyết áp và đái tháo đường.",
                "effect": "Đẩy xác suất nguy cơ tăng rõ rệt.",
                "driver": "đang ở vùng béo phì độ I.",
            },
            {
                "max": None,
                "status": "Béo phì độ II+",
                "severity": "critical",
                "points": 18,
                "reference": ">= 35 kg/m² là vùng nguy cơ chuyển hóa rất cao.",
                "clinical_note": "Cần ưu tiên chương trình giảm cân có giám sát y tế nếu kéo dài.",
                "effect": "Làm tăng mạnh nguy cơ đi kèm nhiều bệnh đồng mắc.",
                "driver": "nằm trong vùng béo phì mức cao.",
            },
        ],
    },
    "DiabetesPedigreeFunction": {
        "missing_points": 0,
        "missing_reference": "",
        "missing_note": "",
        "missing_effect": "",
        "ranges": [
            {
                "max": 0.4,
                "status": "Nguy cơ gia đình thấp",
                "severity": "normal",
                "points": 0,
                "reference": "Điểm dưới 0.4 thường thấp hơn median nguy cơ gia đình của bộ dữ liệu.",
                "clinical_note": "Yếu tố gia đình thấp không loại trừ hoàn toàn nguy cơ chuyển hóa mắc phải.",
                "effect": "Đóng góp thấp vào nguy cơ nền.",
            },
            {
                "max": 0.8,
                "status": "Nguy cơ gia đình vừa",
                "severity": "watch",
                "points": 4,
                "reference": "0.4 - 0.79 gợi ý nên lưu ý tiền sử gia đình.",
                "clinical_note": "Nên tầm soát sớm hơn nếu đồng thời có BMI hoặc glucose tăng.",
                "effect": "Tăng nhẹ nguy cơ nền.",
                "driver": "cao hơn nền tham chiếu về yếu tố gia đình.",
            },
            {
                "max": 1.2,
                "status": "Nguy cơ gia đình cao",
                "severity": "high",
                "points": 7,
                "reference": ">= 0.8 là vùng nên tầm soát định kỳ sát hơn.",
                "clinical_note": "Yếu tố di truyền làm tăng nguy cơ ngay cả khi triệu chứng chưa rõ.",
                "effect": "Tăng nguy cơ nền rõ rệt.",
                "driver": "ở vùng nguy cơ gia đình cao.",
            },
            {
                "max": None,
                "status": "Nguy cơ gia đình rất cao",
                "severity": "critical",
                "points": 9,
                "reference": "Điểm rất cao cần ưu tiên tầm soát chủ động.",
                "clinical_note": "Nên trao đổi kỹ tiền sử gia đình và biến chứng chuyển hóa liên quan.",
                "effect": "Đẩy nguy cơ nền tăng mạnh.",
                "driver": "rất cao so với median tham chiếu.",
            },
        ],
    },
    "Age": {
        "missing_points": 0,
        "missing_reference": "",
        "missing_note": "",
        "missing_effect": "",
        "ranges": [
            {
                "max": 35,
                "status": "Nhóm tuổi thấp",
                "severity": "normal",
                "points": 0,
                "reference": "Nguy cơ nền thường thấp hơn trước 35 tuổi nếu không có yếu tố khác.",
                "clinical_note": "Vẫn cần xem cùng glucose, BMI và tiền sử gia đình.",
                "effect": "Đóng góp thấp vào nguy cơ nền.",
            },
            {
                "max": 45,
                "status": "Nguy cơ nền tăng dần",
                "severity": "watch",
                "points": 3,
                "reference": "35 - 44 tuổi là giai đoạn nên chủ động sàng lọc nếu có yếu tố kèm theo.",
                "clinical_note": "Nguy cơ lối sống bắt đầu bộc lộ rõ hơn theo tuổi.",
                "effect": "Tăng nhẹ xác suất nền.",
                "driver": "cao hơn median nhóm dữ liệu tham chiếu.",
            },
            {
                "max": 55,
                "status": "Nguy cơ nền đáng kể",
                "severity": "watch",
                "points": 6,
                "reference": ">= 45 tuổi là mốc nên sàng lọc chuyển hóa thường xuyên hơn.",
                "clinical_note": "Tuổi tăng làm tăng khả năng đồng mắc tăng huyết áp và rối loạn lipid.",
                "effect": "Tăng nguy cơ nền mức vừa.",
                "driver": "đã vượt mốc tuổi cần tầm soát chủ động.",
            },
            {
                "max": None,
                "status": "Nguy cơ nền cao",
                "severity": "high",
                "points": 9,
                "reference": "Nguy cơ chuyển hóa và tim mạch tăng đáng kể sau 55 tuổi.",
                "clinical_note": "Nên kết hợp tầm soát đường huyết, lipid và huyết áp định kỳ.",
                "effect": "Tăng rõ nguy cơ nền toàn thể.",
                "driver": "thuộc nhóm tuổi nguy cơ cao hơn.",
            },
        ],
    },
}

MAX_CLINICAL_POINTS = 97


@lru_cache(maxsize=1)
def _load_model_bundle():
    return {
        "model": joblib.load(ASSETS_DIR / "diabetes_model.pkl"),
        "scaler": joblib.load(ASSETS_DIR / "scaler.pkl"),
        "imputer": joblib.load(ASSETS_DIR / "imputer_median.pkl"),
    }


@lru_cache(maxsize=1)
def get_reference_stats() -> dict[str, float]:
    if not REFERENCE_STATS_FILE.exists():
        return REFERENCE_FALLBACK

    with REFERENCE_STATS_FILE.open("r", encoding="utf-8") as file:
        raw_stats = json.load(file)

    return {feature: float(raw_stats.get(feature, REFERENCE_FALLBACK[feature])) for feature in FEATURE_ORDER}


def get_model_profile() -> dict:
    return {
        "name": "Diabetes Clinical Hybrid",
        "version": "2.0.0",
        "serving_strategy": "Probability từ model RandomForest được hiệu chỉnh thêm bằng ngưỡng lâm sàng.",
        "benchmark": MODEL_BENCHMARK,
        "features": [
            {"metric": feature, "label": FEATURE_LABELS[feature], "unit": FEATURE_UNITS[feature]}
            for feature in FEATURE_ORDER
        ],
        "notes": [
            "Các giá trị 0 ở Glucose, BloodPressure, SkinThickness, Insulin và BMI được xem là dữ liệu thiếu khi đưa vào model.",
            "Tầng hiệu chỉnh lâm sàng giúp giảm khả năng bị trấn an sai khi glucose hoặc BMI vượt ngưỡng rõ rệt.",
            "Kết quả trả về dùng để sàng lọc nguy cơ, không thay thế chẩn đoán hoặc y lệnh.",
        ],
    }


def get_clinical_content() -> dict:
    return {
        "feature_labels": FEATURE_LABELS,
        "feature_units": FEATURE_UNITS,
        "reference_ranges": REFERENCE_RANGES,
        "care_pathway": CARE_PATHWAY,
        "education_modules": EDUCATION_MODULES,
        "specialties": ["Nội tiết - Đái tháo đường", "Dinh dưỡng lâm sàng", "Tim mạch - chuyển hóa"],
    }


def _format_value(metric: str, value: float) -> str:
    if metric in {"Pregnancies", "Age"}:
        return str(int(round(value)))
    if metric == "DiabetesPedigreeFunction":
        return f"{value:.3f}"
    return f"{value:.1f}"


def _build_driver(metric: str, value: float, reference: float, detail: str) -> str:
    return (
        f"{FEATURE_LABELS[metric]} {_format_value(metric, value)} {FEATURE_UNITS[metric]} "
        f"so với median tham chiếu {_format_value(metric, reference)} {FEATURE_UNITS[metric]}: {detail}"
    )


def _evaluate_metric(metric: str, value: float, reference: float) -> tuple[MetricInsight, int, str | None]:
    rules = METRIC_RULES[metric]

    if metric in ZERO_AS_MISSING and value == 0:
        return (
            MetricInsight(
                metric=metric,
                label=FEATURE_LABELS[metric],
                value=value,
                unit=FEATURE_UNITS[metric],
                status="Thiếu dữ liệu",
                severity="watch",
                reference=rules["missing_reference"],
                clinical_note=rules["missing_note"],
                effect=rules["missing_effect"],
            ),
            rules["missing_points"],
            None,
        )

    for range_rule in rules["ranges"]:
        max_value = range_rule["max"]
        if max_value is None or value < max_value:
            driver = None
            if range_rule.get("driver"):
                driver = _build_driver(metric, value, reference, range_rule["driver"])

            return (
                MetricInsight(
                    metric=metric,
                    label=FEATURE_LABELS[metric],
                    value=value,
                    unit=FEATURE_UNITS[metric],
                    status=range_rule["status"],
                    severity=range_rule["severity"],
                    reference=range_rule["reference"],
                    clinical_note=range_rule["clinical_note"],
                    effect=range_rule["effect"],
                ),
                range_rule["points"],
                driver,
            )

    raise ValueError(f"Could not evaluate metric {metric}")


def _probability_to_band(probability: float) -> str:
    if probability < 0.2:
        return "Thấp"
    if probability < 0.4:
        return "Theo dõi sớm"
    if probability < 0.6:
        return "Trung bình"
    if probability < 0.8:
        return "Cao"
    return "Rất cao"


def _probability_to_certainty(probability: float) -> str:
    gap = abs(probability - 0.5)
    if gap < 0.08:
        return "Thấp"
    if gap < 0.18:
        return "Trung bình"
    return "Cao"


def _build_metric_package(input_dict: dict[str, float]) -> tuple[list[MetricInsight], int, list[str], list[str]]:
    reference_stats = get_reference_stats()
    insights = []
    drivers = []
    missing_data_flags = []
    total_points = 0

    for metric in FEATURE_ORDER:
        value = float(input_dict[metric])
        insight, points, driver = _evaluate_metric(metric, value, float(reference_stats[metric]))
        insights.append(insight)
        total_points += points
        if driver:
            drivers.append(driver)
        if metric in ZERO_AS_MISSING and value == 0:
            missing_data_flags.append(
                f"{FEATURE_LABELS[metric]} đang là 0 nên được xem như dữ liệu thiếu khi suy luận."
            )

    return insights, total_points, drivers, missing_data_flags


def _build_alerts(probability: float, input_dict: dict[str, float], missing_data_flags: list[str]) -> list[ClinicalAlert]:
    alerts = []

    if probability >= 0.75:
        alerts.append(
            ClinicalAlert(
                level="high",
                title="Nguy cơ tổng thể cao",
                detail="Mô hình đang xếp hồ sơ này vào nhóm nên được xác nhận cận lâm sàng sớm.",
            )
        )

    if input_dict["Glucose"] >= 126:
        alerts.append(
            ClinicalAlert(
                level="high",
                title="Đường huyết vượt ngưỡng xác nhận",
                detail="Đường huyết đang vượt mốc 126 mg/dL, nên làm HbA1c hoặc lặp lại xét nghiệm lúc đói.",
            )
        )

    if input_dict["BMI"] >= 30:
        alerts.append(
            ClinicalAlert(
                level="moderate",
                title="Béo phì làm tăng nguy cơ đề kháng insulin",
                detail="BMI đang ở vùng béo phì, đây là yếu tố làm tăng mạnh nguy cơ chuyển hóa và tim mạch.",
            )
        )

    if input_dict["BloodPressure"] >= 90:
        alerts.append(
            ClinicalAlert(
                level="moderate",
                title="Cần theo dõi huyết áp",
                detail="Huyết áp tâm trương tăng sẽ làm nặng thêm hồ sơ nguy cơ chuyển hóa tổng thể.",
            )
        )

    if missing_data_flags:
        alerts.append(
            ClinicalAlert(
                level="moderate",
                title="Có dữ liệu đang được nội suy",
                detail="Một số giá trị bằng 0 được model xem là dữ liệu thiếu, vì vậy kết quả nên được diễn giải thận trọng hơn.",
            )
        )

    if not alerts:
        alerts.append(
            ClinicalAlert(
                level="low",
                title="Không có cờ đỏ nổi bật",
                detail="Các chỉ số chính chưa xuất hiện tín hiệu lâm sàng quá bất thường trong lần nhập này.",
            )
        )

    return alerts


def _build_actions(probability: float, input_dict: dict[str, float]) -> list[RecommendedAction]:
    actions = []

    if input_dict["Glucose"] >= 126 or probability >= 0.7:
        actions.append(
            RecommendedAction(
                timeframe="Trong 7 ngày",
                action="Khám Nội tiết hoặc bác sĩ gia đình",
                reason="Cần xác nhận nguy cơ bằng xét nghiệm chuẩn và đánh giá kế hoạch theo dõi.",
            )
        )
        actions.append(
            RecommendedAction(
                timeframe="Trong 1 - 2 tuần",
                action="Làm HbA1c và đường huyết lúc đói lặp lại",
                reason="Đây là bước xác nhận quan trọng khi glucose đang cao hoặc xác suất AI ở mức cao.",
            )
        )

    if 100 <= input_dict["Glucose"] < 126 or 0.35 <= probability < 0.7:
        actions.append(
            RecommendedAction(
                timeframe="Trong 2 - 4 tuần",
                action="Theo dõi chế độ ăn và kiểm tra lại glucose",
                reason="Vùng tiền đái tháo đường cần can thiệp sớm để tránh tiến triển.",
            )
        )

    if input_dict["BMI"] >= 30:
        actions.append(
            RecommendedAction(
                timeframe="Trong 4 - 6 tuần",
                action="Lập kế hoạch giảm cân có mục tiêu",
                reason="Giảm 5 - 7% cân nặng thường đã giúp cải thiện hồ sơ chuyển hóa.",
            )
        )

    if input_dict["BloodPressure"] >= 90:
        actions.append(
            RecommendedAction(
                timeframe="Trong 1 - 2 tuần",
                action="Theo dõi huyết áp tại nhà hoặc tái khám tim mạch",
                reason="Tăng huyết áp đồng mắc làm tăng biến cố tim mạch và nguy cơ chuyển hóa.",
            )
        )

    if input_dict["Age"] >= 45 or input_dict["DiabetesPedigreeFunction"] >= 0.8:
        actions.append(
            RecommendedAction(
                timeframe="Mỗi 3 - 6 tháng",
                action="Tầm soát chuyển hóa định kỳ",
                reason="Tuổi và yếu tố gia đình cao khiến nguy cơ nền kéo dài dù triệu chứng chưa rõ.",
            )
        )

    if not actions:
        actions.append(
            RecommendedAction(
                timeframe="Trong 6 - 12 tháng",
                action="Duy trì kiểm tra định kỳ",
                reason="Hiện chưa có cờ đỏ lớn, nhưng tầm soát định kỳ vẫn cần thiết để theo dõi xu hướng.",
            )
        )

    return actions[:4]


def _compose_text(probability: float, risk_band: str, key_drivers: list[str]) -> tuple[str, str, str]:
    if probability >= 0.7:
        summary = "Hồ sơ đang nằm trong nhóm nguy cơ cao và nên được xác nhận sớm bằng xét nghiệm chuẩn."
    elif probability >= 0.4:
        summary = "Hồ sơ đang có tín hiệu nguy cơ chuyển hóa trung bình đến cao, phù hợp để theo dõi chủ động."
    else:
        summary = "Hồ sơ hiện ở nhóm nguy cơ thấp hơn, nhưng vẫn cần theo dõi xu hướng sức khỏe định kỳ."

    advice = "Ưu tiên hành động trên các chỉ số nổi bật trước, đặc biệt là glucose, BMI và huyết áp nếu đang vượt ngưỡng."
    driver_text = " ".join(key_drivers[:2]) if key_drivers else "Các chỉ số chính hiện chưa vượt nhiều so với vùng tham chiếu."
    interpretation = (
        f"Mức nguy cơ {risk_band.lower()} được tạo từ xác suất RandomForest kết hợp hiệu chỉnh lâm sàng. {driver_text}"
    )
    return summary, advice, interpretation


def predict_diabetes(data: PredictionInput) -> PredictionOutput:
    input_dict = data.model_dump()
    bundle = _load_model_bundle()

    raw_input = []
    for feature in FEATURE_ORDER:
        value = input_dict[feature]
        raw_input.append(np.nan if feature in ZERO_AS_MISSING and value == 0 else value)

    input_array = np.array([raw_input], dtype=float)
    imputed = bundle["imputer"].transform(input_array)
    scaled = bundle["scaler"].transform(imputed)
    model_probability = float(bundle["model"].predict_proba(scaled)[0][1])

    metric_insights, total_points, drivers, missing_data_flags = _build_metric_package(input_dict)
    clinical_probability = min(total_points / MAX_CLINICAL_POINTS, 1.0)

    probability = (model_probability * 0.72) + (clinical_probability * 0.28)
    if input_dict["Glucose"] >= 126 and input_dict["BMI"] >= 30:
        probability += 0.04
    if input_dict["Glucose"] < 100 and input_dict["BMI"] < 25 and input_dict["Age"] < 35:
        probability -= 0.05
    probability = max(0.01, min(probability, 0.99))

    risk_band = _probability_to_band(probability)
    certainty = _probability_to_certainty(probability)
    risk_score = int(round(probability * 100))

    if probability >= 0.6 or input_dict["Glucose"] >= 126:
        has_diabetes = "Có nguy cơ cao"
    elif probability >= 0.35:
        has_diabetes = "Cần đánh giá thêm"
    else:
        has_diabetes = "Nguy cơ thấp"

    key_drivers = drivers[:3]
    summary, advice, interpretation = _compose_text(probability, risk_band, key_drivers)
    alerts = _build_alerts(probability, input_dict, missing_data_flags)
    actions = _build_actions(probability, input_dict)

    return PredictionOutput(
        has_diabetes=has_diabetes,
        probability=round(probability, 3),
        model_probability=round(model_probability, 3),
        clinical_probability=round(clinical_probability, 3),
        risk_band=risk_band,
        risk_score=risk_score,
        certainty=certainty,
        summary=summary,
        advice=advice,
        clinical_interpretation=interpretation,
        key_drivers=key_drivers,
        alerts=alerts,
        recommended_actions=actions,
        metric_insights=metric_insights,
        missing_data_flags=missing_data_flags,
        disclaimer="Kết quả chỉ hỗ trợ sàng lọc nguy cơ và không thay thế chẩn đoán hoặc chỉ định điều trị của bác sĩ.",
        generated_at=datetime.now(timezone.utc),
    )
