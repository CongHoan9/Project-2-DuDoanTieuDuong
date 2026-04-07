# A9 - Web App Dự đoán Bệnh Tiểu đường (Diabetes Prediction)

Ứng dụng dự đoán nguy cơ mắc tiểu đường dựa trên bộ dữ liệu **Pima Indians Diabetes Database**.

Project hiện được tổ chức theo mô hình:

- `1 Render Web Service` duy nhất
- `FastAPI` serve cả frontend và API
- Frontend gọi API nội bộ qua `/api`
- Lịch sử kiểm tra lưu bằng `SQLite` local hoặc `Supabase` nếu cần lưu online

## 1) Mô tả bài toán

### 1.1 Bối cảnh
- Tiểu đường là bệnh mạn tính phổ biến, cần phát hiện sớm để giảm nguy cơ biến chứng.
- Nhóm xây dựng một hệ thống hỗ trợ sàng lọc nguy cơ ban đầu từ các chỉ số lâm sàng cơ bản.

### 1.2 Bài toán nghiệp vụ
- **Đầu vào:** thông tin bệnh nhân gồm 8 chỉ số lâm sàng.
- **Đầu ra:**
  - Dự đoán nhị phân: nguy cơ thấp / có nguy cơ cao.
  - Xác suất mắc bệnh trong khoảng `0 -> 1`.
  - Khuyến nghị sức khỏe ngắn gọn theo từng trường hợp.
- **Mục tiêu:** hỗ trợ đánh giá nhanh nguy cơ ban đầu, không thay thế chẩn đoán của bác sĩ.

## 2) Dữ liệu

### 2.1 Nguồn dữ liệu
- Bộ dữ liệu: **Pima Indians Diabetes Database**
- File sử dụng trong project: [`data/raw/diabetes.csv`](data/raw/diabetes.csv)

### 2.2 Biến đầu vào (features)
1. `Pregnancies`
2. `Glucose`
3. `BloodPressure`
4. `SkinThickness`
5. `Insulin`
6. `BMI`
7. `DiabetesPedigreeFunction`
8. `Age`

### 2.3 Biến mục tiêu (target)
- `Outcome`: `0` (không mắc), `1` (mắc tiểu đường)

### 2.4 Chất lượng dữ liệu
- Một số cột có giá trị `0` không hợp lý về mặt y khoa như:
  - `Glucose`
  - `BloodPressure`
  - `SkinThickness`
  - `Insulin`
  - `BMI`
- Các giá trị này được xem là missing ẩn.
- Hướng xử lý hiện tại trong pipeline suy luận:
  - thay thế missing bằng **median**
  - sau đó **scale** dữ liệu trước khi đưa vào model

## 3) Khai phá dữ liệu (EDA)

Notebook chính: [`notebooks/01_EDA_and_Understanding_Data.ipynb`](notebooks/01_EDA_and_Understanding_Data.ipynb)

### 3.1 Các bước EDA đã thực hiện
- Thống kê mô tả và phân phối dữ liệu
- Kiểm tra missing values ẩn dưới dạng `0`
- Histogram và boxplot để quan sát phân bố và outlier
- Kiểm tra tỷ lệ lớp `Outcome` để đánh giá mất cân bằng dữ liệu
- Correlation heatmap và pairplot để xem mối quan hệ giữa biến đầu vào và nhãn

### 3.2 Insight chính
- `Glucose` là biến có tương quan nổi bật nhất với `Outcome`
- `BMI`, `Age`, `Pregnancies` cũng có mức liên quan đáng kể
- Dữ liệu có xu hướng mất cân bằng lớp nên cần chiến lược huấn luyện phù hợp

## 4) Chọn feature

### 4.1 Chiến lược hiện tại
- Giữ toàn bộ 8 biến gốc của bộ dữ liệu để đảm bảo:
  - dễ giải thích
  - không mất thông tin y khoa quan trọng
  - phù hợp cho phiên bản báo cáo và demo ban đầu

### 4.2 Hướng mở rộng
- Feature engineering như:
  - nhóm tuổi
  - BMI category
  - chỉ số nguy cơ tổng hợp
- Đánh giá feature importance bằng:
  - permutation importance
  - SHAP
- Loại bỏ hoặc bổ sung feature theo hiệu năng và khả năng giải thích

## 5) Chọn mô hình

Notebook huấn luyện: [`notebooks/03_Final_Model_Training_and_Save.ipynb`](notebooks/03_Final_Model_Training_and_Save.ipynb)

### 5.1 Các mô hình đã thử
- Logistic Regression (`class_weight='balanced'`)
- Decision Tree
- Random Forest

### 5.2 Kết quả đánh giá tham chiếu
Theo notebook huấn luyện hiện tại:

- **Logistic Regression:** Accuracy ~0.73, ROC-AUC ~0.813
- **Decision Tree:** Accuracy ~0.71, ROC-AUC ~0.661
- **Random Forest:** Accuracy ~0.75, ROC-AUC ~0.811
- **Random Forest (sau GridSearch):** Accuracy ~0.77, ROC-AUC ~0.829

### 5.3 Mô hình đang triển khai
- Model phục vụ suy luận đang lưu tại [`backend/assets/diabetes_model.pkl`](backend/assets/diabetes_model.pkl)
- Các artifact hỗ trợ:
  - [`backend/assets/imputer_median.pkl`](backend/assets/imputer_median.pkl)
  - [`backend/assets/scaler.pkl`](backend/assets/scaler.pkl)
  - [`backend/assets/reference_stats.json`](backend/assets/reference_stats.json)

### 5.4 Pipeline suy luận hiện tại
1. Nhận input đúng thứ tự 8 feature
2. Impute median với `imputer_median.pkl`
3. Scale với `scaler.pkl`
4. Dự đoán xác suất bằng model đã train
5. Phân lớp theo ngưỡng hiện tại trong service
6. Sinh phần diễn giải và khuyến nghị ngắn gọn

## 6) Ý tưởng xây dựng hiện tại

### 6.1 Ý tưởng sản phẩm
- Web app đơn giản, dễ dùng cho người không chuyên kỹ thuật
- Trả về cả **xác suất**, **mức nguy cơ** và **khuyến nghị hành vi**
- Có **lịch sử kiểm tra** để theo dõi các lần dự đoán gần nhất
- Có phần trực quan hóa như radar chart và các card giải thích chỉ số

### 6.2 Ý tưởng kỹ thuật
- Backend tổ chức theo tầng:
  - API
  - services
  - schemas
  - models
  - database
- Frontend dùng HTML/CSS/JS thuần để dễ demo, dễ deploy
- Model artifacts lưu bằng file `.pkl`, có thể thay nhanh sau mỗi lần retrain
- Kiến trúc deploy hiện tại là **1 Render Web Service** duy nhất:
  - FastAPI serve frontend tại `/`
  - API đặt dưới `/api/*`
- Frontend **không kết nối database trực tiếp**
  - browser chỉ gọi API
  - backend chịu trách nhiệm chạy model và lưu lịch sử
  - cách này an toàn hơn vì không lộ secret và không đưa logic ML ra client

### 6.3 Lưu lịch sử
- Mặc định local: lưu bằng `SQLite`
- Khi deploy online: có thể dùng `Supabase` để lưu lịch sử bền vững hơn
- Code hiện tại hỗ trợ cả hai hướng

## 7) Cấu trúc thư mục

```text
Project-2-DuDoanTieuDuong/
├─ backend/
│  ├─ app/
│  │  ├─ api/              # route FastAPI
│  │  ├─ models/           # ORM models
│  │  ├─ schemas/          # Pydantic schemas
│  │  ├─ services/         # nghiệp vụ dự đoán + lịch sử
│  │  ├─ config.py         # đọc env và cấu hình
│  │  └─ database.py       # kết nối DB
│  ├─ assets/              # model.pkl, scaler, imputer, stats
│  ├─ scripts/
│  │  └─ train_diabetes_model.py
│  ├─ sql/
│  │  └─ supabase_history.sql
│  ├─ main.py              # entry FastAPI app
│  ├─ requirements.txt
│  ├─ create_tables.py     # script tạo bảng thủ công (tùy chọn)
│  └─ diabetes_checks.db   # SQLite local
├─ data/
│  └─ raw/
│     └─ diabetes.csv
├─ frontend/
│  ├─ index.html
│  ├─ style.css
│  ├─ app.js
│  └─ src/                 # ảnh và static assets
├─ notebooks/
│  ├─ 01_EDA_and_Understanding_Data.ipynb
│  └─ 03_Final_Model_Training_and_Save.ipynb
├─ presentation/
│  └─ 10123137_HoangCongHoan.docx
├─ processed/              # dữ liệu/trung gian nếu dùng trong quá trình xử lý
├─ render.yaml             # cấu hình deploy Render
└─ README.md
```

## 8) Quy trình nghiệp vụ

### 8.1 Quy trình end-to-end
1. Người dùng nhập thông tin sức khỏe trên form web
2. Frontend gọi API `POST /api/predict` và gửi dữ liệu JSON
3. Backend validate dữ liệu bằng schema
4. Prediction service chạy pipeline tiền xử lý và model inference
5. Hệ thống sinh:
   - xác suất
   - mức nguy cơ
   - diễn giải
   - khuyến nghị ngắn
6. Backend lưu lịch sử kiểm tra vào:
   - `SQLite` local, hoặc
   - `Supabase` nếu đã cấu hình
7. Frontend hiển thị:
   - risk meter
   - radar chart
   - card diễn giải theo từng chỉ số
   - cảnh báo và hành động gợi ý
8. Frontend gọi thêm `GET /api/history` để hiển thị các lần kiểm tra gần nhất

### 8.2 Vai trò theo thành phần
- **Frontend:** thu thập input, gửi request, hiển thị trực quan kết quả
- **API layer:** nhận request và điều phối service
- **Prediction service:** xử lý preprocessing + inference + giải thích kết quả
- **History service:** lưu và truy xuất lịch sử
- **Database/history store:** lưu dữ liệu kiểm tra
- **Model artifacts:** phần model và tiền xử lý dùng cho suy luận

### 8.3 Luồng dữ liệu chính
```text
User Input
-> Frontend
-> FastAPI /api/predict
-> Validate schema
-> Imputer
-> Scaler
-> Model
-> PredictionOutput + Advice
-> SQLite / Supabase history
-> Frontend UI
```

## 9) Kiến trúc hệ thống hiện tại

### 9.1 Kiến trúc triển khai
```text
Render Web Service
├─ FastAPI
│  ├─ serve frontend tại /
│  └─ serve API tại /api/*
├─ Model artifacts (.pkl)
└─ History store
   ├─ SQLite local
   └─ Supabase (tùy chọn)
```

### 9.2 Điểm đáng chú ý
- Không cần `ngrok`
- Không cần frontend static site tách riêng
- Không cần nhập URL API trên giao diện
- Frontend và API cùng domain nên ít lỗi `CORS`

## 10) Các bước cần thiết cho Báo cáo lần 1

### 10.1 Phần nội dung bắt buộc
1. **Giới thiệu đề tài**
   - bối cảnh
   - mục tiêu
   - phạm vi bài toán
2. **Mô tả dữ liệu**
   - nguồn
   - thuộc tính
   - target
   - chất lượng dữ liệu
3. **EDA và insight**
   - biểu đồ chính
   - nhận xét quan trọng
4. **Tiền xử lý dữ liệu**
   - missing ẩn
   - chia train/test
   - scaling
5. **Thử nghiệm mô hình**
   - so sánh Logistic / Tree / Random Forest
6. **Đánh giá mô hình**
   - Accuracy
   - Precision
   - Recall
   - F1-score
   - ROC-AUC
   - confusion matrix
7. **Kiến trúc hệ thống**
   - frontend
   - backend
   - DB/history store
   - model artifacts
8. **Quy trình nghiệp vụ**
   - luồng nhập liệu -> dự đoán -> lưu lịch sử -> hiển thị
9. **Kết luận giai đoạn 1 và kế hoạch tiếp theo**
   - hạn chế hiện tại
   - hướng cải tiến

### 10.2 Checklist bàn giao báo cáo lần 1
- [ ] Slide tóm tắt bài toán, dữ liệu, EDA
- [ ] Notebook EDA chạy lại được
- [ ] Notebook training có bảng so sánh mô hình rõ ràng
- [ ] Demo web app chạy được local
- [ ] README đã cập nhật mô tả nghiệp vụ và kiến trúc
- [ ] Có roadmap cho báo cáo lần 2

## 11) Công nghệ sử dụng

- **Backend:** FastAPI, SQLAlchemy, Python
- **Database local:** SQLite
- **History online tùy chọn:** Supabase
- **ML model:** Logistic Regression, Decision Tree, Random Forest
- **Frontend:** HTML, CSS, JavaScript thuần, Chart.js
- **Deployment:** Render Web Service

## 12) Chạy ứng dụng local

### 12.1 Cách chạy hiện tại
Với phiên bản code hiện tại, chỉ cần chạy backend là đủ vì FastAPI đã serve luôn frontend.

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Sau đó truy cập:

- `http://127.0.0.1:8000` để mở web app
- `http://127.0.0.1:8000/docs` để xem Swagger

### 12.2 Lưu ý về database local
- Nếu chưa cấu hình Supabase, app vẫn chạy bằng `SQLite`
- `backend/main.py` hiện đã tự tạo bảng local khi ứng dụng khởi động

### 12.3 Script tạo bảng thủ công
Nếu muốn chủ động khởi tạo bảng trước, có thể chạy:

```bash
cd backend
python create_tables.py
```

Script này là **tùy chọn**, không còn là bước bắt buộc để app chạy.

### 12.4 Cài nhanh package tối thiểu
Nếu máy báo thiếu package:

```bash
pip install fastapi uvicorn sqlalchemy python-dotenv joblib numpy pandas scikit-learn pydantic
```

## 13) API endpoints

- `GET /` - serve giao diện web
- `GET /docs` - Swagger docs
- `GET /api/health` - kiểm tra trạng thái API
- `POST /api/predict` - dự đoán nguy cơ tiểu đường
- `GET /api/history?limit=10` - lấy lịch sử kiểm tra gần đây
- `GET /api/reference-stats` - lấy số liệu tham chiếu cho radar chart
- `GET /api/model-info` - lấy metadata của model đang dùng
- `GET /api/clinical-content` - lấy nội dung lâm sàng dùng cho frontend

## 14) Train lại model

Nếu muốn retrain local:

```powershell
cd backend
pip install -r requirements.txt
python scripts\train_diabetes_model.py
```

Sau khi train, các file artifact sẽ được cập nhật:

- `backend/assets/diabetes_model.pkl`
- `backend/assets/imputer_median.pkl`
- `backend/assets/scaler.pkl`
- `backend/assets/reference_stats.json`

Sau đó có thể push code và redeploy Render service.

## 15) Deploy lên Render

### 15.1 Mô hình deploy khuyến nghị
- Dùng **1 Render Web Service** duy nhất
- Không dùng `ngrok`
- Không tách frontend static site riêng

### 15.2 File cấu hình
Project đã có sẵn [`render.yaml`](render.yaml)

Thông số chính:
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/api/health`

### 15.3 Các bước deploy
1. Push project lên GitHub
2. Vào Render và chọn tạo service từ `render.yaml`
3. Deploy web service Python
4. Nếu cần lưu lịch sử online thì cấu hình thêm Supabase

Sau khi deploy:

- Giao diện: `https://diabetes-prediction-app-xgrp.onrender.com`
- Health check: `https://diabetes-prediction-app-xgrp.onrender.com/api/health`
- Docs: `https://diabetes-prediction-app-xgrp.onrender.com/docs`

## 16) Lưu lịch sử online với Supabase

### 16.1 Khi nào cần Supabase
- Nếu chỉ demo local hoặc test nhanh: `SQLite` là đủ
- Nếu deploy online và muốn giữ lịch sử ổn định hơn: dùng `Supabase`

### 16.2 File SQL
Chạy file:

- [`backend/sql/supabase_history.sql`](backend/sql/supabase_history.sql)

để tạo bảng `prediction_history` trên Supabase.

### 16.3 Environment variables cần dùng
Có thể khai báo trong `backend/.env` hoặc Render env vars:

```env
CORS_ALLOW_ORIGINS=*
HISTORY_BACKEND=supabase
SUPABASE_URL=https://URL_CUA_SUPABASE_PROJECT
SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_CUA_SUPABASE
SUPABASE_TABLE=prediction_history
```

### 16.4 Ghi chú quan trọng
- Frontend không gọi Supabase trực tiếp
- Secret key chỉ nằm ở backend / Render env vars
- Đây là lý do vẫn cần API thay vì để browser kết nối thẳng database

## 17) Kết luận giai đoạn 1 và hướng phát triển

### 17.1 Những gì đã hoàn thành
- Hiểu dữ liệu và làm EDA
- So sánh nhiều mô hình cơ bản
- Chọn mô hình phù hợp để triển khai
- Xây dựng web app có thể chạy local và deploy
- Có lịch sử kiểm tra và trực quan hóa kết quả

### 17.2 Hạn chế hiện tại
- Dữ liệu tương đối nhỏ
- Chưa có xác thực người dùng
- Chưa có dashboard quản trị riêng
- Chưa có giải thích mô hình nâng cao như SHAP
- Chưa tối ưu cho production scale lớn

### 17.3 Hướng phát triển tiếp theo
- Bổ sung feature engineering
- Đánh giá model bằng nhiều metric và k-fold đầy đủ hơn
- Tối ưu UI/UX cho mobile
- Thêm xác thực người dùng và phân quyền
- Lưu lịch sử bền vững hơn và thống kê theo người dùng
- Bổ sung phần explainability nâng cao
