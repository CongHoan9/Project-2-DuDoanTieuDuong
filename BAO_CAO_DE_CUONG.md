# ĐỀ CƯƠNG CHI TIẾT - BÁO CÁO ĐỒ ÁN 2
**Dự án: Hệ thống hỗ trợ dự đoán nguy cơ mắc bệnh tiểu đường**  
**Trạng thái**: Dự cương chờ xác nhận

---

## I. GIỚI THIỆU TỔNG QUÁT

### 1.1 Tiêu đề dự án
**"Xây dựng ứng dụng Web hỗ trợ sàng lọc nguy cơ mắc bệnh tiểu đường dựa trên mô hình Machine Learning"**

### 1.2 Bối cảnh bài toán
- Tiểu đường là bệnh mạn tính phổ biến toàn cầu, gây ra các biến chứng nghiêm trọng về lâu dài
- Phát hiện sớm và can thiệp kịp thời có thể giảm đáng kể rủi ro biến chứng
- Cần xây dựng công cụ hỗ trợ y tế để sàng lọc nhanh và hiệu quả dựa trên các chỉ số lâm sàng cơ bản

### 1.3 Mục tiêu dự án
- **Mục tiêu chính**: Xây dựng hệ thống Web hỗ trợ dự đoán nguy cơ tiểu đường với giao diện thân thiện
- **Mục tiêu cụ thể**:
  - Xây dựng mô hình ML dự đoán nhị phân (có/không mắc bệnh)
  - Thiết kế API RESTful để phục vụ dự đoán
  - Phát triển giao diện Web với hỗ trợ đa vai trò (Khách, User, Admin)
  - Triển khai quản lý người dùng và lịch sử dự đoán
  - Triển khai trên nền tảng đám mây (Render + Supabase)

### 1.4 Tính ứng dụng thực tiễn
- Hỗ trợ các cơ sở y tế và bệnh viên sàng lọc ban đầu
- Không thay thế chẩn đoán của bác sĩ, chỉ cung cấp đánh giá nguy cơ
- Dữ liệu được lưu trữ bảo mật trên cloud, tuân thủ tiêu chuẩn bảo vệ dữ liệu

---

## II. PHÂN TÍCH BÀI TOÁN

### 2.1 Xác định bài toán
**Loại bài toán**: Phân loại nhị phân (Binary Classification)

**Mô tả**:
- **Input**: 8 chỉ số lâm sàng từ bộ dữ liệu Pima Indians
- **Output**: 
  - Dự đoán: Có nguy cơ mắc / Không có nguy cơ
  - Xác suất mắc bệnh (0-1)
  - Khuyến nghị sức khỏe được cá nhân hóa

### 2.2 Các chỉ số đầu vào (Features)
1. **Pregnancies**: Số lần mang thai
2. **Glucose**: Nồng độ glucose máu (mg/dL)
3. **BloodPressure**: Huyết áp tâm trương (mmHg)
4. **SkinThickness**: Độ dày da (mm)
5. **Insulin**: Nồng độ insulin (mu U/ml)
6. **BMI**: Chỉ số khối lượng cơ thể (kg/m²)
7. **DiabetesPedigreeFunction**: Hàm tiền sử gia đình mắc bệnh (0-1)
8. **Age**: Tuổi (năm)

### 2.3 Giả định và hạn chế
- **Giả định**: Các đặc trưng có mối tương quan với nguy cơ mắc bệnh
- **Hạn chế**:
  - Mô hình dùng cho sàng lọc ban đầu, không phải chẩn đoán chính thức
  - Dữ liệu tập huấn luyện từ bộ dữ liệu Pima (populations cụ thể)
  - Không xem xét các yếu tố lối sống, môi trường
  - Số giới tính không có trong mô hình

---

## III. PHÂN TÍCH VÀ XỬ LÝ DỮ LIỆU

### 3.1 Nguồn dữ liệu
- **Tên bộ dữ liệu**: Pima Indians Diabetes Database
- **Số bản ghi**: 768 bản ghi
- **Số đặc trưng**: 8 features + 1 target
- **Cân bằng lớp**: Có độ mất cân bằng (~35% mắc, ~65% không mắc)

### 3.2 Phân tích chất lượng dữ liệu
**Vấn đề chính**: Giá trị 0 không hợp lý y khoa
- Glucose, BloodPressure, SkinThickness, Insulin không thể bằng 0
- Các giá trị này được coi là missing ẩn

### 3.3 Xử lý dữ liệu
- **Xử lý missing**: Thay thế bằng giá trị median của từng cột
- **Chuẩn hóa dữ liệu**: Sử dụng StandardScaler để chuẩn hóa features
- **Cân bằng lớp**: Sử dụng `class_weight='balanced'` trong Logistic Regression

### 3.4 Kết quả EDA
- **Phân bố dữ liệu**: Các features có phân bố không đều, có outliers
- **Tương quan mạnh nhất**: Glucose, BMI, Age có mối tương quan cao với Outcome
- **Kết luận**: Dữ liệu sạch và sẵn sàng cho huấn luyện sau xử lý

---

## IV. HỆ THỐNG MÔ HÌNH MACHINE LEARNING

### 4.1 Lựa chọn mô hình
**Các mô hình đã thử nghiệm**:
1. **Logistic Regression** (được chọn) ✓
   - Ưu điểm: Dễ giải thích, nhanh, hiệu quả với dữ liệu nhỏ
   - Kết quả: Accuracy ~0.73, ROC-AUC ~0.813

2. Decision Tree
   - Kết quả: Khá nhưng dễ overfit

3. Random Forest
   - Kết quả: Tốt nhưng phức tạp, không cần thiết cho bài toán này

### 4.2 Thông số mô hình
- **Thuật toán**: Logistic Regression
- **Hyperparameters**:
  - `class_weight='balanced'`: Xử lý mất cân bằng dữ liệu
  - `random_state=42`: Tái lập được kết quả
  - Solver mặc định: 'lbfgs'

### 4.3 Kết quả đánh giá
| Metric | Giá trị |
|--------|--------|
| Accuracy | ~0.73 |
| ROC-AUC | ~0.813 |
| Precision | ~0.71 |
| Recall | ~0.66 |
| F1-Score | ~0.68 |

### 4.4 Quy trình suy luận (Inference Pipeline)
```
Input Data → Validation → Imputation (median) 
→ Standardization → Model Prediction → Output (probability + class)
```

---

## V. KIẾN TRÚC HỆ THỐNG

### 5.1 Tổng quan kiến trúc
**Mô hình kiến trúc**: Client-Server với Cloud Backend
```
Frontend (HTML/CSS/JS) 
  ↓
FastAPI Backend (Python)
  ↓
Inference Service (Scikit-learn Model)
  ↓
Supabase (PostgreSQL + Auth + RLS)
  ↓
Cloud Storage (Render hosting)
```

### 5.2 Thành phần chính

#### 5.2.1 Frontend
- **Công nghệ**: HTML5, CSS3, JavaScript (Vanilla)
- **Thư viện**: Supabase JS Client (auth), Chart.js (visualize)
- **Giao diện**:
  - Trang công khai (Dự đoán, Tài liệu)
  - Trang người dùng (History, Account)
  - Trang Admin (Quản lý user, Activity Log)

#### 5.2.2 Backend API
- **Framework**: FastAPI (Python)
- **Endpoints chính**:
  - `POST /api/predict`: Dự đoán
  - `GET /api/model-profile`: Thông tin mô hình
  - `GET /api/reference-stats`: Thống kê tham chiếu
  - `GET /api/supabase-config`: Cấu hình Supabase
  - `GET /api/health`: Kiểm tra sức khỏe

#### 5.2.3 Cơ sở dữ liệu
- **Hệ DBMS**: PostgreSQL (Supabase)
- **Bảng chính**:
  - `auth.users`: Quản lý tài khoản (Supabase Auth)
  - `public.profiles`: Hồ sơ người dùng (name, role, email)
  - `public.predictions`: Lịch sử dự đoán

- **Row Level Security (RLS)**: Bảo vệ quyền truy cập dữ liệu
- **Stored Procedures (RPC)**:
  - `create_prediction()`: Tạo bản ghi dự đoán
  - `get_prediction_history()`: Lấy lịch sử
  - `admin_search_profiles()`: Tìm kiếm user (chỉ admin)
  - `admin_update_profile()`: Cập nhật profile user (chỉ admin)
  - `ensure_my_profile()`: Tự động tạo profile khi đăng nhập lần đầu

### 5.3 Luồng hoạt động chính

#### Luồng 1: Dự đoán (User đã đăng nhập)
```
1. User nhập 8 chỉ số → Form validation
2. Click "Phân tích" → POST /api/predict
3. Backend xử lý → Model inference
4. Trả về xác suất + khuyến nghị
5. Frontend phát event "diabetes:prediction-complete"
6. Supabase RPC create_prediction() lưu lịch sử
7. UI cập nhật History tab
```

#### Luồng 2: Dự đoán (Khách)
```
1. User nhập 8 chỉ số → Form validation
2. Nút "Phân tích" disable nếu chưa đăng nhập
3. Click "Đăng nhập trước" → Auth modal
4. Sau khi đăng nhập thành công → quay lại form
5. Tiếp tục luồng 1
```

#### Luồng 3: Admin quản lý user
```
1. Admin đăng nhập
2. Tab "Management" → Xem danh sách user
3. Tìm kiếm / Filter theo tình trạng
4. Click user → Xem profile + lịch sử dự đoán
5. Có thể update profile hoặc xóa tài khoản
```

### 5.4 Xác thực và Phân quyền (RBAC)
| Vai trò | Quyền hạn | Tính năng |
|---------|----------|----------|
| **Khách** (unauthenticated) | Public | Dự đoán (không lưu), Xem tài liệu |
| **User** (authenticated) | User | Dự đoán + lưu lịch sử, Xem profile, Xem lịch sử riêng |
| **Admin** | All | Tất cả quyền của User + Quản lý user, Xem log, Xóa tài khoản |

---

## VI. CÁC TÍNH NĂNG CHÍNH

### 6.1 Tính năng chung (Khách + User + Admin)
- ✓ **Dự đoán nguy cơ tiểu đường**
  - Form nhập 8 chỉ số lâm sàng
  - Hiển thị xác suất, nguy cơ (Risk Meter)
  - Cảnh báo và khuyến nghị sức khỏe
  
- ✓ **Xem thông tin mô hình**
  - Hiển thị phiên bản mô hình
  - Hiển thị ROC-AUC, Accuracy
  - Cập nhật lần cuối

- ✓ **Xem thống kê tham chiếu**
  - Min/Max/Mean/Std của từng feature
  - Giúp user so sánh giá trị của mình

### 6.2 Tính năng User
- ✓ **Đăng ký / Đăng nhập**
  - Sử dụng Supabase Auth
  - Email + Password
  - Hỗ trợ logout an toàn

- ✓ **Quản lý hồ sơ**
  - Xem/cập nhật tên, email
  - Xem ngày tạo tài khoản

- ✓ **Xem lịch sử dự đoán**
  - Liệt kê 50 bản ghi gần nhất
  - Filter theo ngày, tình trạng
  - Xem chi tiết từng dự đoán

### 6.3 Tính năng Admin
- ✓ **Quản lý người dùng**
  - Xem danh sách toàn bộ user
  - Tìm kiếm theo tên/email
  - Filter theo tình trạng (Có nguy cơ / Bình thường)
  - Cập nhật profile user khác
  - Xóa tài khoản + dữ liệu liên quan

- ✓ **Activity Log**
  - Xem lịch sử hoạt động hệ thống
  - Xem lịch sử dự đoán của từng user

---

## VII. CÔNG NGHỆ VÀ CÔNG CỤ

### 7.1 Frontend
| Thành phần | Công nghệ |
|-----------|-----------|
| Ngôn ngữ | JavaScript (ES6+) |
| Markup | HTML5 |
| Styling | CSS3 |
| Auth | Supabase JS Client |
| Database | Supabase PostgreSQL (via RPC) |
| Visualization | Chart.js / Vanilla Canvas |

### 7.2 Backend
| Thành phần | Công nghệ |
|-----------|-----------|
| Framework | FastAPI 0.111+ |
| Web Server | Uvicorn 0.30+ |
| ML Framework | Scikit-learn 1.5+ |
| Data Processing | Pandas 2.2+, NumPy 1.26+ |
| Validation | Pydantic 2.7+ |
| Config | Python-dotenv |
| Database Driver | Psycopg2-binary |

### 7.3 Infrastructure & Deployment
| Thành phần | Công nghệ |
|-----------|-----------|
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Hosting | Render.com |
| Version Control | Git / GitHub |
| IaC (config) | render.yaml, .env |

---

## VIII. LỢI THẾ CỦA DỰ ÁN

### 8.1 Lợi thế kỹ thuật
- **Kiến trúc hiện đại**: Client-Server tách biệt, API RESTful rõ ràng
- **Bảo mật**: 
  - Xác thực qua Supabase Auth (JWT tokens)
  - Row Level Security (RLS) trên database
  - Phân quyền RBAC (Admin/User/Guest)
  - Không lưu mật khẩu trong ứng dụng
  
- **Khả năng mở rộng**:
  - Model dễ cập nhật (lưu dưới dạng joblib)
  - Infrastructure serverless (Render + Supabase)
  - RPC procedures có thể mở rộng tính năng dễ dàng

- **Hiệu suất**:
  - Model được preload lên memory (không tải lại mỗi request)
  - Inference nhanh (<100ms)
  - Frontend cache assets (CSS, JS)

### 8.2 Lợi thế khi triển khai trên Render + Supabase
- **Render hosting**:
  - Tự động deploy từ Git repository
  - HTTPS/SSL free
  - Scaling tự động khi cần
  - Environment variables quản lý an toàn
  - Hỗ trợ build từ file `render.yaml`

- **Supabase database**:
  - PostgreSQL fully managed
  - Auth built-in (không cần xây dựng từ đầu)
  - RLS policy bảo vệ tự động
  - Backup tự động
  - API GraphQL/REST tự sinh
  - Real-time capabilities khi cần
  - Pricing miễn phí cho tier cơ bản

- **Tích hợp hiệu quả**:
  - API Backend gọi Supabase qua psycopg2
  - Frontend gọi Supabase RPC trực tiếp (client-side)
  - Giảm tải backend server
  - Bảo mật được kiểm soát qua RLS policy

### 8.3 Lợi thế về trải nghiệm người dùng
- **Giao diện thân thiện**:
  - Tối ưu cho mobile + desktop
  - Loading nhanh
  - Khuyến nghị được cá nhân hóa
  
- **Tính năng hữu ích**:
  - Lịch sử dự đoán được giữ lại
  - Có thể so sánh kết quả qua thời gian
  - Admin có cái nhìn toàn diện hệ thống

### 8.4 Lợi thế về dữ liệu & Bảo mật
- **Bảo vệ dữ liệu cá nhân**:
  - User chỉ xem được dữ liệu của chính mình
  - Admin có quyền quản lý nhưng tuân thủ RLS
  - Không lưu dữ liệu nhạy cảm trên client

- **Compliance**:
  - Tách authentication ra service riêng (Supabase)
  - Database transactions đảm bảo tính nhất quán
  - Audit trail có thể được theo dõi (activity log)

---

## IX. YÊU CẦU VÀ HẠN CHẾ

### 9.1 Yêu cầu không chức năng
- **Performance**: Inference < 200ms, API response < 500ms
- **Availability**: Uptime > 99% (phụ thuộc Render + Supabase)
- **Security**: Bảo mật auth, RLS, HTTPS
- **Usability**: Giao diện tối ưu di động, desktop

### 9.2 Hạn chế
- Mô hình dùng cho sàng lọc ban đầu, không phải chẩn đoán
- Dữ liệu lịch sử chỉ lưu 50 bản ghi gần nhất (có thể mở rộng)
- Frontend không hỗ trợ offline mode
- Cần kết nối internet để sử dụng

---

## X. KẾ HOẠCH TRIỂN KHAI VÀ KIỂM THỬ

### 10.1 Các giai đoạn triển khai
**Phase 1**: Xây dựng Backend + Model (✓ Hoàn thành)
- FastAPI server
- Inference pipeline
- Supabase schema + RPC

**Phase 2**: Phát triển Frontend (✓ Hoàn thành)
- Giao diện khách
- Auth modal
- Dashboard người dùng
- Dashboard admin

**Phase 3**: Triển khai & Test (Hiện tại)
- Deploy lên Render
- Kiểm thử toàn hệ thống
- Tinh chỉnh performance

### 10.2 Kế hoạch kiểm thử
- **Unit test**: Các function ML, utility functions
- **Integration test**: API endpoints, Supabase RPC calls
- **E2E test**: Luồng dự đoán, đăng nhập, quản lý user
- **Performance test**: Load test, inference time
- **Security test**: Auth flow, RLS policy, XSS prevention

### 10.3 Tiêu chí chấp nhận (Acceptance Criteria)
- ✓ Dự đoán chính xác >= 73%
- ✓ Tất cả API endpoints hoạt động
- ✓ Xác thực RBAC hoạt động đúng
- ✓ Dữ liệu user được bảo vệ qua RLS
- ✓ Giao diện responsive trên mobile/desktop
- ✓ Triển khai thành công trên Render + Supabase

---

## XI. KHOÁ HỌC & KINH NGHIỆM ĐẠIT ĐƯỢC

### 11.1 Kỹ năng Machine Learning
- Quy trình EDA, xử lý dữ liệu
- Lựa chọn và đánh giá mô hình
- Feature scaling, class balancing
- Model deployment

### 11.2 Kỹ năng Web Development
- Backend API design (RESTful)
- Frontend UI/UX optimization
- Authentication & Authorization (RBAC)
- Real-time data binding

### 11.3 Kỹ năng DevOps & Deployment
- Containerization concepts
- Cloud deployment (Render, Supabase)
- Environment management
- Database administration

### 11.4 Soft skills
- Quản lý dự án, phân công công việc
- Ghi chép tài liệu, spec
- Testing & quality assurance

---

## XII. TÀI LIỆU & THAM KHẢO

### 12.1 Bộ dữ liệu
- Pima Indians Diabetes Database (Kaggle)
- Chứa 768 bản ghi, 8 features

### 12.2 Papers & Resources
- Scikit-learn Documentation
- FastAPI Official Guide
- Supabase Documentation
- Render Deployment Guide

### 12.3 Thư viện & Tools
- Python 3.10+
- Jupyter Notebook (analysis)
- Git & GitHub (version control)
- VS Code (development)

---

## TÓMO TẮT TIẾN ĐỘ

| Thành phần | Trạng thái | %Hoàn thành |
|-----------|----------|-----------|
| Phân tích bài toán | ✓ | 100% |
| Xử lý dữ liệu | ✓ | 100% |
| Xây dựng mô hình ML | ✓ | 100% |
| Backend API | ✓ | 100% |
| Frontend UI | ✓ | 100% |
| Database & Auth | ✓ | 100% |
| Triển khai Render | ✓ | 100% |
| Kiểm thử toàn hệ thống | 🔄 | 90% |
| Báo cáo final | ⏳ | 0% |

---

**Ghi chú**: Đề cương này dự định để **trình bày cho giáo viên xác nhận** trước khi viết báo cáo chi tiết. Các phần được đánh dấu (✓) là đã hoàn thành trong dự án.

