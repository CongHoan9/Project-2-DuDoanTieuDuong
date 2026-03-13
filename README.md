# A9 - Web App Dự đoán Bệnh Tiểu đường (Diabetes Prediction)

Ứng dụng dự đoán nguy cơ mắc tiểu đường dựa trên bộ dữ liệu **Pima Indians Diabetes Database**.

## 1) Mô tả bài toán

### 1.1 Bối cảnh
- Tiểu đường là bệnh mạn tính phổ biến, cần phát hiện sớm để giảm biến chứng.
- Nhóm xây dựng một hệ thống hỗ trợ sàng lọc nguy cơ ban đầu từ các chỉ số lâm sàng cơ bản.

### 1.2 Bài toán nghiệp vụ
- **Đầu vào:** thông tin bệnh nhân (8 chỉ số).
- **Đầu ra:**
  - Dự đoán nhị phân: nguy cơ thấp / có nguy cơ cao.
  - Xác suất mắc bệnh (0 → 1).
  - Khuyến nghị sức khỏe ngắn gọn theo từng trường hợp.
- **Mục tiêu:** hỗ trợ đánh giá nhanh, không thay thế chẩn đoán bác sĩ.

---

## 2) Dữ liệu

### 2.1 Nguồn dữ liệu
- Bộ dữ liệu: **Pima Indians Diabetes Database**.
- File sử dụng trong project: `data/raw/diabetes.csv`.

### 2.2 Biến đầu vào (features)
1. Pregnancies
2. Glucose
3. BloodPressure
4. SkinThickness
5. Insulin
6. BMI
7. DiabetesPedigreeFunction
8. Age

### 2.3 Biến mục tiêu (target)
- `Outcome`: 0 (không mắc), 1 (mắc tiểu đường).

### 2.4 Chất lượng dữ liệu
- Một số cột có giá trị `0` không hợp lý về mặt y khoa (`Glucose`, `BloodPressure`, `SkinThickness`, `Insulin`, `BMI`) được xem là missing ẩn.
- Hướng xử lý hiện tại trong pipeline: **impute theo median** và chuẩn hóa dữ liệu trước khi suy luận.

---

## 3) Khai phá dữ liệu (EDA)

Notebook chính: `notebooks/01_EDA_and_Understanding_Data.ipynb`.

### 3.1 Các bước EDA đã thực hiện
- Thống kê mô tả và phân phối dữ liệu.
- Kiểm tra missing values ẩn dưới dạng 0.
- Histogram + Boxplot để quan sát phân bố và outlier.
- Kiểm tra tỷ lệ lớp `Outcome` (mất cân bằng lớp).
- Correlation heatmap, pairplot để xem quan hệ giữa biến và nhãn.

### 3.2 Insight chính
- `Glucose` là biến có tương quan nổi bật nhất với `Outcome`.
- `BMI`, `Age`, `Pregnancies` cũng có mức liên quan đáng kể.
- Dữ liệu có xu hướng mất cân bằng lớp nên cần chiến lược xử lý khi huấn luyện.

---

## 4) Chọn feature

### 4.1 Chiến lược hiện tại
- Giữ toàn bộ 8 biến gốc của bộ dữ liệu để đảm bảo:
  - Dễ giải thích.
  - Không mất thông tin y khoa quan trọng.
  - Phù hợp triển khai nhanh cho phiên bản báo cáo đầu.

### 4.2 Hướng mở rộng
- Feature engineering (ví dụ: nhóm tuổi, BMI category).
- Kiểm định feature importance bằng permutation importance hoặc SHAP.
- Loại bỏ/bổ sung feature dựa trên hiệu năng và khả năng giải thích.

---

## 5) Chọn mô hình

Notebook huấn luyện: `notebooks/03_Final_Model_Training_and_Save.ipynb`.

### 5.1 Các mô hình đã thử
- Logistic Regression (class_weight='balanced')
- Decision Tree
- Random Forest

### 5.2 Kết quả đánh giá (test split hiện tại)
- **Logistic Regression:** Accuracy ~0.73, ROC-AUC ~0.813.
- **Decision Tree:** Accuracy ~0.71, ROC-AUC ~0.661.
- **Random Forest:** Accuracy ~0.75, ROC-AUC ~0.811.
- **Random Forest (sau GridSearch):** Accuracy ~0.77, ROC-AUC ~0.829.

### 5.3 Mô hình đang triển khai
- Dùng mô hình đã lưu tại `backend/assets/diabetes_model.pkl`.
- Pipeline suy luận:
  1. Nhận input theo đúng thứ tự feature.
  2. Impute median (`imputer_median.pkl`).
  3. Scale (`scaler.pkl`).
  4. Dự đoán xác suất và ngưỡng 0.5 để phân lớp.

---

## 6) Ý tưởng xây dựng hiện tại

### 6.1 Ý tưởng sản phẩm
- Một web app đơn giản, dễ dùng cho người không chuyên kỹ thuật.
- Trả về cả **xác suất** lẫn **khuyến nghị hành vi** để tăng tính thực tiễn.
- Có **lịch sử kiểm tra** để theo dõi các lần dự đoán gần nhất.

### 6.2 Ý tưởng kỹ thuật
- Backend FastAPI tách riêng tầng API, service, schema, model DB.
- Frontend thuần HTML/CSS/JS để dễ triển khai và demo.
- Model artifacts lưu file `.pkl`, có thể thay thế nhanh sau mỗi lần retrain.

---

## 7) Cấu trúc thư mục

```text
Project-2-DuDoanTieuDuong/
├─ backend/
│  ├─ app/
│  │  ├─ api/          # route FastAPI
│  │  ├─ models/       # ORM models
│  │  ├─ schemas/      # Pydantic schemas
│  │  ├─ services/     # nghiệp vụ dự đoán + lịch sử
│  │  └─ database.py   # kết nối DB
│  ├─ assets/          # model.pkl, scaler, imputer, stats
│  ├─ main.py          # entry FastAPI app
│  ├─ create_tables.py # tạo bảng SQLite
│  └─ diabetes_checks.db
├─ data/
│  └─ raw/diabetes.csv
├─ frontend/
│  ├─ index.html
│  ├─ style.css
│  └─ app.js
├─ notebooks/
│  ├─ 01_EDA_and_Understanding_Data.ipynb
│  └─ 03_Final_Model_Training_and_Save.ipynb
└─ README.md
```

---

## 8) Quy trình nghiệp vụ (quan trọng nhất)

### 8.1 Quy trình end-to-end
1. **Người dùng nhập thông tin sức khỏe** trên form web.
2. **Frontend gọi API `/api/predict`** gửi dữ liệu JSON.
3. **Backend validate dữ liệu** bằng schema.
4. **Service dự đoán** chạy pipeline tiền xử lý + model.
5. **Sinh kết quả**: mức nguy cơ, xác suất, lời khuyên.
6. **Lưu lịch sử kiểm tra** vào SQLite.
7. **Frontend hiển thị kết quả** + radar chart so với median tham chiếu.
8. (Tuỳ chọn) **Frontend gọi `/api/history`** để hiển thị các lần gần nhất.

### 8.2 Mô tả vai trò theo thành phần
- **Frontend:** thu thập input, hiển thị trực quan kết quả.
- **API layer:** nhận request, điều phối service.
- **Prediction service:** xử lý inference.
- **History service + DB:** lưu và truy xuất lịch sử.
- **Model artifacts:** “bộ não” dự đoán, có thể version hóa.

### 8.3 Luồng dữ liệu chính
- `User Input` → `FastAPI /predict` → `Imputer` → `Scaler` → `Model`
→ `PredictionOutput + Advice` → `SQLite history` → `Frontend UI`.

---

## 9) Các bước cần thiết cho Báo cáo lần 1

### 9.1 Phần nội dung bắt buộc
1. **Giới thiệu đề tài**
   - Bối cảnh, mục tiêu, phạm vi bài toán.
2. **Mô tả dữ liệu**
   - Nguồn, thuộc tính, target, chất lượng dữ liệu.
3. **EDA & insight**
   - Biểu đồ chính, nhận xét quan trọng.
4. **Tiền xử lý dữ liệu**
   - Cách xử lý missing ẩn, chia train/test, scaling.
5. **Thử nghiệm mô hình**
   - So sánh Logistic/Tree/RandomForest.
6. **Đánh giá mô hình**
   - Accuracy, Precision, Recall, F1, ROC-AUC, confusion matrix.
7. **Kiến trúc hệ thống**
   - Frontend/Backend/DB/Model artifacts.
8. **Quy trình nghiệp vụ**
   - Luồng nhập liệu → dự đoán → lưu lịch sử → hiển thị.
9. **Kết luận giai đoạn 1 & kế hoạch tiếp theo**
   - Các hạn chế hiện tại và hướng cải tiến.

### 9.2 Checklist bàn giao báo cáo lần 1
- [ ] Slide tóm tắt bài toán + dữ liệu + EDA.
- [ ] Notebook EDA có thể chạy lại.
- [ ] Notebook training có bảng so sánh mô hình rõ ràng.
- [ ] Demo web app chạy được local.
- [ ] Mô tả nghiệp vụ và kiến trúc đã cập nhật vào README.
- [ ] Đề xuất roadmap cho báo cáo lần 2.

---

## 10) Công nghệ sử dụng
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
