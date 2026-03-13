# A9 - Web App Dự đoán Bệnh Tiểu đường (Diabetes Prediction)

Ứng dụng dự đoán nguy cơ mắc tiểu đường dựa trên bộ dữ liệu **Pima Indians Diabetes Database**.

## Tính năng chính
- Dự đoán **có/không có nguy cơ** và trả về **xác suất**.
- Form nhập đầy đủ các chỉ số: Pregnancies, Glucose, BloodPressure, SkinThickness, Insulin, BMI, DiabetesPedigreeFunction, Age.
- Trả về **lời khuyên sức khỏe** theo mức độ nguy cơ.
- Lưu **lịch sử kiểm tra** vào SQLite.
- Hiển thị **Radar Chart** so sánh chỉ số người dùng với mức chuẩn (median từ tập huấn luyện).
- API FastAPI có các endpoint: `predict`, `history`, `reference-stats`, `health`.

## Công nghệ sử dụng
- **Backend:** FastAPI + SQLAlchemy + SQLite
- **ML model:** Logistic Regression / Decision Tree / Random Forest (đã huấn luyện và lưu trong `backend/assets/`)
- **Xử lý mất cân bằng lớp:** hỗ trợ qua pipeline huấn luyện (class weight hoặc SMOTE đơn giản trong notebook huấn luyện)
- **Frontend:** HTML/CSS/JavaScript thuần + Chart.js

## Cấu trúc thư mục
- `backend/`: API, service dự đoán, DB, model artifacts
- `frontend/`: giao diện form + kết quả + lịch sử + radar chart
- `data/raw/diabetes.csv`: dữ liệu đầu vào
- `notebooks/`: notebook EDA và huấn luyện

## Chạy ứng dụng
### 1) Backend
```bash
cd backend
python create_tables.py
uvicorn main:app --reload --port 8000
```
> Nếu máy bạn báo thiếu package, cài nhanh:
```bash
pip install fastapi uvicorn sqlalchemy python-dotenv joblib numpy pydantic
```


### 2) Frontend
Bạn có 3 cách chạy frontend (khuyến nghị cách A hoặc B):

**A. Dùng Python HTTP server**
```bash
cd frontend
python -m http.server 5500
```
Nếu Windows báo `Python was not found`, thử:
```bash
py -m http.server 5500
```

**B. Dùng Node.js (không cần Python)**
```bash
cd frontend
npx serve . -l 5500
```

**C. Mở trực tiếp file `frontend/index.html`**
- Vẫn có thể dùng được trong nhiều trình duyệt, nhưng cách A/B ổn định hơn.

Sau đó truy cập `http://127.0.0.1:5500`.

## API endpoints
- `GET /` - Welcome message
- `GET /api/health` - Kiểm tra trạng thái API
- `POST /api/predict` - Dự đoán nguy cơ tiểu đường
- `GET /api/history?limit=10` - Lấy lịch sử kiểm tra gần đây
- `GET /api/reference-stats` - Lấy median tham chiếu cho radar chart
