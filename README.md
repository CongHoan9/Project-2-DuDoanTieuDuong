# A9 - Web App Dự đoán Bệnh Tiểu đường (Diabetes Prediction)

Ứng dụng dự đoán nguy cơ mắc tiểu đường dựa trên bộ dữ liệu **Pima Indians Diabetes Database**. Dự án đã được nâng cấp hoàn chỉnh với kiến trúc Client-Server hiện đại, áp dụng Machine Learning và hệ thống quản trị dữ liệu đám mây.

## Tính năng nổi bật

- **Phân loại nguy cơ y khoa**: Sử dụng mô hình Machine Learning (Random Forest) để phân tích 8 chỉ số lâm sàng, trả về xác suất mắc bệnh và lời khuyên sức khỏe tự động.
- **Hệ thống phân quyền (RBAC)**: Hỗ trợ 3 vai trò: Khách (Guest), Người dùng (User), và Quản trị viên (Admin).
- **Bảo mật dữ liệu (Row Level Security - RLS)**: Đảm bảo quyền riêng tư y tế, người dùng chỉ xem được lịch sử khám bệnh của chính mình.
- **Bảng điều khiển Admin**: Quản lý toàn bộ hồ sơ người dùng và Activity Log của hệ thống, hỗ trợ Real-time (cập nhật thời gian thực).
- **Trực quan hóa**: Hiển thị mức độ rủi ro bằng Risk Meter và biểu đồ đối chiếu Radar Chart.

---

## Kiến trúc hệ thống

Dự án đã chuyển đổi từ kiến trúc local (SQLite) sang kiến trúc Cloud kết hợp:

1. **Frontend**: Xây dựng bằng HTML/CSS/JavaScript thuần, giao tiếp trực tiếp với cơ sở dữ liệu thông qua thư viện `supabase-js`.
2. **Backend**: Viết bằng **FastAPI** (Python), chuyên trách phục vụ Inference Pipeline (xử lý tiền dữ liệu và chạy mô hình AI). Tối ưu tốc độ dự đoán < 100ms.
3. **Database & Auth**: Sử dụng **Supabase** (PostgreSQL) quản lý xác thực người dùng (Auth) và thực thi logic nghiệp vụ qua các Stored Procedures (RPC).
4. **Deployment**: Backend được cấu hình tự động triển khai trên nền tảng **Render.com**.

---

## Hệ thống Machine Learning

Quá trình xây dựng mô hình được lưu trong thư mục `notebooks/`:

- **Nguồn dữ liệu**: Pima Indians Diabetes Database (768 bản ghi, 8 features).
- **Tiền xử lý**: Sử dụng `SimpleImputer(strategy='median')` để xử lý các giá trị 0 phi lý (Glucose, BMI...) và `StandardScaler` để chuẩn hóa.
- **Thuật toán cốt lõi**: **Random Forest** (Tối ưu hóa bằng `GridSearchCV`). Đã vượt qua các thuật toán Logistic Regression và Decision Tree ở pha Baseline.
- **Hiệu suất (Test Set)**:
  - Accuracy: ~0.77
  - ROC-AUC: ~0.829
  - Xử lý mất cân bằng lớp với tham số `class_weight='balanced'`.

Các tệp mô hình (Artifacts) dùng cho Backend được lưu tại `backend/assets/`:
- `diabetes_model.pkl` (Mô hình chính)
- `scaler.pkl` (Bộ chuẩn hóa)
- `imputer_median.pkl` (Bộ điền khuyết)

---

## Cấu trúc thư mục

```text
Project-2-DuDoanTieuDuong/
├─ backend/
│  ├─ api/              # Chứa các endpoint của FastAPI
│  ├─ assets/           # Model (.pkl), scaler, imputer, stats
│  ├─ scripts/          # Script retrain model
│  ├─ main.py           # Entry point của FastAPI
│  ├─ supabase_schema.sql # Cấu trúc Database, RLS và các hàm RPC
│  └─ requirements.txt
├─ data/
│  └─ raw/
│     └─ diabetes.csv   # Dataset gốc
├─ frontend/
│  ├─ index.html
│  ├─ style.css
│  ├─ app.js
│  ├─ admin.js          # Logic xử lý cho bảng điều khiển Admin
│  └─ auth-rbac.js      # Logic xác thực và phân quyền
├─ notebooks/
│  ├─ 01_EDA_and_Understanding_Data.ipynb
│  └─ 03_Final_Model_Training_and_Save.ipynb
├─ presentation/        # Các tệp báo cáo đồ án
├─ render.yaml          # File cấu hình deploy lên Render
└─ README.md
```

---

## Hướng dẫn cài đặt và Chạy Local

### 1. Khởi chạy Backend (FastAPI)
Backend chỉ cần chạy để phục vụ API dự đoán (`/api/predict`):

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```
API sẽ chạy tại `http://127.0.0.1:8000`. Bạn có thể truy cập `http://127.0.0.1:8000/docs` để xem tài liệu Swagger UI.

### 2. Thiết lập Supabase
- Ứng dụng Frontend yêu cầu khóa kết nối Supabase. 
- Mọi logic thêm/sửa/xóa và lưu lịch sử đều được xử lý thông qua Supabase RPC, loại bỏ hoàn toàn sự phụ thuộc vào SQLite local.

---

## Quy trình nghiệp vụ (Luồng dữ liệu)

1. **User Input**: Người dùng nhập 8 chỉ số lâm sàng trên giao diện web.
2. **FastAPI Inference**: Frontend gửi dữ liệu qua `POST /api/predict`. Backend tiến hành Impute -> Scale -> Predict.
3. **Response**: Backend trả về xác suất mắc bệnh, điểm nguy cơ và lời khuyên.
4. **Save History**: Frontend nhận kết quả, tự động gọi hàm RPC `create_prediction` của Supabase để lưu trữ bản ghi vào Database.
5. **Real-time Sync**: Bất kỳ bản ghi lịch sử nào mới được lưu cũng sẽ ngay lập tức được đồng bộ hóa (Real-time) hiển thị lên Admin Dashboard.

---

## Định hướng phát triển tương lai

- Mở rộng quy mô tập dữ liệu huấn luyện, tăng cường độ đa dạng về giới tính và sắc tộc.
- Tích hợp thêm các dữ liệu phi cấu trúc (như hình ảnh siêu âm đáy mắt) vào hệ thống chẩn đoán.
- Cung cấp tính năng xuất file chẩn đoán dạng PDF và gửi email cảnh báo tự động.
