# USE CASE - KHÁCH (Người chưa đăng nhập)

## Tổng quan

Khách là người dùng chưa xác thực trong hệ thống. Họ có thể truy cập các phần công khai nhưng sẽ cần đăng nhập hoặc đăng ký để thực hiện dự đoán và lưu lịch sử.

---

## UC-G01: Xem giao diện chính

### Mô tả
Khách trang web khi lần đầu tiên và xem các thông tin công khai về hệ thống.

### Preconditions
- Ứng dụng đang chạy trên server
- Khách có truy cập internet

### Postconditions
- Giao diện hiển thị các tab: Dự đoán, Library, Login/Sign In
- Model metadata được tải từ `/api/model-profile`
- Reference stats được tải từ `/api/reference-stats`

### Main Flow
1. Khách mở trình duyệt và truy cập URL ứng dụng
2. Frontend tải `index.html` từ StaticFiles (backend)
3. `auth-rbac.js` khởi chạy, kiểm tra trạng thái đăng nhập:
   - `state.client.auth.getSession()` → trả về `null` (chưa đăng nhập)
4. `renderNav()` render 3 nút tab:
   - "Dự đoán" (predict)
   - "Library" (library)
   - "Login / Sign In" (account)
5. Backend `initialize_application()` load model lần đầu:
   - `_load_model_bundle()` được gọi với `@lru_cache`
   - Model, scaler, imputer được load vào memory
6. Frontend `app.js` khởi động, gửi các request:
   - `GET /api/model-profile` → nhận thông tin model
   - `GET /api/reference-stats` → nhận thống kê tham chiếu
7. Các card thông tin model hiển thị (ROC-AUC, version, v.v.)
8. Form "Nhập các chỉ số lâm sàng" hiển thị sẵn sàng

### Alternative Flows

#### A1: Khách đã bật cache trình duyệt
- Frontend assets (css, js) được tải từ cache
- Tốc độ tải nhanh hơn

#### A2: Supabase chưa kết nối
- Toast hiển thị: "Thiếu cấu hình Supabase."
- Dự đoán vẫn hoạt động, nhưng không thể lưu lịch sử

### Error Handling
- **Network error**: Hiển thị toast "Lỗi kết nối"
- **API error**: Hiển thị toast với message lỗi từ server
- **Model load failed**: Backend trả về 500 error

---

## UC-G02: Xem thông tin Library

### Mô tả
Khách xem các biểu đồ tham chiếu và phạm vi ngưỡng lâm sàng trong tab "Library".

### Preconditions
- Khách đã ở giao diện chính (UC-G01 hoàn thành)
- Reference stats đã được tải

### Postconditions
- Tab Library hiển thị 2 biểu đồ Chart.js
- Khách hiểu được các ngưỡng tham chiếu

### Main Flow
1. Khách click vào nút "Library"
2. `activateTab("library")` được gọi
   - `.tab-panel[data-tab-panel="library"]` được thêm class `is-active`
   - Các tab khác ẩn đi
3. Frontend hiển thị "Clinical Visual Atlas" gồm 2 phần:
   - **Phổ ngưỡng tham chiếu**: Bar chart so sánh vùng tốt, theo dõi, cảnh báo
   - **Đường ngưỡng lâm sàng**: Scatter chart các chỉ số từ dữ liệu training
4. Chart.js render biểu đồ từ dữ liệu `referenceStats`
5. Khách có thể hover để xem giá trị chi tiết

### Error Handling
- Nếu reference stats trống: Hiển thị "Dữ liệu tham chiếu không sẵn sàng"

---

## UC-G03: Thực hiện dự đoán (Khách có sẵn dữ liệu)

### Mô tả
Khách nhập các chỉ số lâm sàng nhưng chưa đăng nhập, click "Phân tích hồ sơ nguy cơ".

### Preconditions
- Khách ở tab "Dự đoán"
- Các input field đã được điền dữ liệu (hoặc giá trị mặc định)

### Postconditions
- Kết quả dự đoán hiển thị trong "Risk Meter", "Radar Chart", "Alerts"
- Không lưu lịch sử (vì chưa đăng nhập)
- Toast hiển thị: "Đăng nhập để lưu lịch sử"

### Main Flow
1. Khách click nút "Phân tích hồ sơ nguy cơ"
2. `predictionForm.addEventListener("submit")` được trigger
3. `getInputPayload()` đọc 8 giá trị từ form:
   - Pregnancies, Glucose, BloodPressure, SkinThickness, Insulin, BMI, DiabetesPedigreeFunction, Age
4. `renderQuickSignals(input)` hiển thị tín hiệu nhanh (metric preview)
5. Frontend gửi `POST /api/predict` với payload:
   ```json
   {
     "Pregnancies": 1,
     "Glucose": 125,
     "BloodPressure": 78,
     "SkinThickness": 30,
     "Insulin": 90,
     "BMI": 28.6,
     "DiabetesPedigreeFunction": 0.627,
     "Age": 42
   }
   ```
6. Backend xử lý trong `routes.py` - endpoint `/predict`:
   - Validate input (kiểm tra range, kiểu dữ liệu)
   - Gọi `predict_diabetes_with_clinical_interpretation(input)`
   - Trong hàm này:
     - Load model từ cache: `bundle = _load_model_bundle()` (lấy từ memory)
     - Impute dữ liệu thiếu (Glucose=0 → median)
     - Normalize bằng `scaler`
     - Predict xác suất: `model.predict_proba()` → lấy class 1
     - Áp dụng clinical calibration layer
     - Sinh alerts, recommendations, metric insights
   - Return `PredictionOutput`
7. Frontend nhận response và render:
   - **Risk Meter**: Hiển thị % xác suất, band nguy cơ (Low/Medium/High/Critical)
   - **Quick Signals**: Cảnh báo cho từng chỉ số
   - **Result Summary**: Tóm tắt kết luận chuyên khoa
   - **Alerts Panel**: Danh sách cờ cảnh báo
   - **Actions Panel**: Khuyến nghị tiếp theo
   - **Radar Chart**: So sánh với reference stats
   - **Metric Insights**: Giải thích từng chỉ số
8. `resultPanel` hiển thị (thêm class `is-active`)
9. Toast hiển thị: "Kết quả dự đoán (không được lưu vì chưa đăng nhập)"

### Alternative Flows

#### A1: Khách click "Phân tích" mà không đăng nhập
- Form submit handler kiểm tra `isAuth()`
- Nếu false → không gửi request
- Modal đăng nhập mở ra (UC-G04)
- Khách phải đăng nhập trước

#### A2: Input không hợp lệ
- Validation trong backend từ chối
- Toast hiển thị: "Lỗi: [chi tiết lỗi]"
- Dữ liệu cũ vẫn hiển thị

#### A3: Model error
- Backend trả về 500
- Toast: "Lỗi xử lý dự đoán"

### Error Handling
- **Invalid input range**: "Giá trị ngoài phạm vi cho phép"
- **Missing required field**: "Vui lòng điền đầy đủ thông tin"
- **Prediction timeout**: "Xử lý tính toán quá lâu, vui lòng thử lại"

---

## UC-G04: Đăng ký tài khoản

### Mô tả
Khách không có tài khoản, muốn tạo tài khoản mới để lưu lịch sử dự đoán.

### Preconditions
- Khách ở giao diện chính
- Khách chưa có tài khoản Supabase

### Postconditions
- Tài khoản được tạo trong Supabase Auth
- Profile record được tạo trong `public.profiles`
- Khách tự động đăng nhập
- Chuyển sang tab "Dự đoán"

### Main Flow
1. Khách click nút "Login / Sign In" (tab cuối cùng)
2. Auth modal mở ra (`authModal` div hiển thị)
3. Khách thấy form với các field:
   - Email
   - Mật khẩu
   - Nút "Đăng nhập"
   - Link "Chưa có tài khoản? Đăng ký"
4. Khách click "Chưa có tài khoản? Đăng ký"
5. `setAuthMode("signup")` được gọi:
   - Field "Họ tên" hiển thị
   - Button text thay đổi thành "Đăng ký"
   - Link thay đổi thành "Đã có tài khoản? Đăng nhập"
6. Khách điền thông tin:
   - Họ tên: "Nguyễn Văn A" (>= 2 ký tự)
   - Email: "user@example.com"
   - Mật khẩu: "***" (>= 6 ký tự)
7. Khách click "Đăng ký"
8. Form submit handler xử lý:
   - Validate họ tên >= 2 ký tự
   - Gọi `state.client.auth.signUp()`:
     ```javascript
     state.client.auth.signUp({
       email: "user@example.com",
       password: "***",
       options: {
         data: { full_name: "Nguyễn Văn A" }
       }
     })
     ```
9. Supabase Auth xử lý:
   - Tạo record trong `auth.users`
   - Nếu email verification bắt buộc: gửi email xác thực
   - Hoặc tạo session ngay
10. Backend trigger: Supabase RLS trigger trên `public.profiles`
    - `ensure_my_profile()` RPC được gọi
    - Tạo profile record:
      ```sql
      INSERT INTO public.profiles (id, email, full_name, phone, role, created_at, updated_at)
      VALUES (user_id, "user@example.com", "Nguyễn Văn A", NULL, "user", NOW(), NOW())
      ```
11. Frontend nhận session mới
12. `loadProfile()` được gọi:
    - Fetch thông tin profile từ `public.profiles`
    - Cập nhật `state.profile` trong memory
13. `clearAllForms()` được gọi - xóa hết các input field
14. `renderNav()` cập nhật:
    - Xóa tab "Login / Sign In"
    - Thêm 3 tab mới: "Dự đoán", "Library", "History", "Tên Người Dùng"
15. Modal đóng (`authModal` ẩn đi)
16. Toast hiển thị: "Đăng ký thành công"
17. Tab tự động chuyển sang "Dự đoán"

### Alternative Flows

#### A1: Email đã tồn tại
- Supabase trả về error: "User already exists"
- Toast: "Email này đã được đăng ký"
- Form vẫn mở, khách có thể thử email khác hoặc click "Đã có tài khoản? Đăng nhập"

#### A2: Mật khẩu quá yếu
- Supabase error: "Password should be at least 6 characters"
- Toast: "Mật khẩu phải từ 6 ký tự trở lên"

#### A3: Email không hợp lệ
- Frontend validation: nếu email không match regex
- Toast: "Email không hợp lệ"

#### A4: Họ tên < 2 ký tự
- Toast: "Họ tên ≥ 2 ký tự"
- Form vẫn mở

#### A5: Email verification required
- Supabase gửi email xác thực
- Toast: "Vui lòng xác nhận email"
- Khách phải click link trong email

### Error Handling
- **Network error**: "Lỗi mạng, vui lòng thử lại"
- **Supabase down**: "Dịch vụ xác thực không khả dụng"
- **Session not created**: "Lỗi tạo phiên, vui lòng đăng nhập lại"

---

## UC-G05: Đăng nhập

### Mô tả
Khách có tài khoản và muốn đăng nhập để truy cập lịch sử dự đoán.

### Preconditions
- Khách đã có tài khoản (hoàn thành UC-G04)
- Khách ở giao diện chính, chưa đăng nhập

### Postconditions
- Khách đăng nhập thành công
- Profile được tải
- Chuyển sang tab "Dự đoán"
- Lịch sử dự đoán có sẵn để xem

### Main Flow
1. Khách click nút "Login / Sign In" 
2. Auth modal mở ra
3. Form đăng nhập hiển thị (sẵn ở mode "signin"):
   - Email
   - Mật khẩu
   - Nút "Đăng nhập"
   - Link "Chưa có tài khoản? Đăng ký"
4. Khách điền thông tin:
   - Email: "user@example.com"
   - Mật khẩu: "***"
5. Khách click "Đăng nhập"
6. Form handler gọi:
   ```javascript
   state.client.auth.signInWithPassword({
     email: "user@example.com",
     password: "***"
   })
   ```
7. Supabase Auth xác thực:
   - Kiểm tra email và mật khẩu
   - Tạo session JWT
   - Trả về access token, refresh token
8. Frontend nhận session
9. `loadProfile()` được gọi:
   - Fetch từ `/rpc/call/get_profile` hoặc SELECT từ `public.profiles`
   - Cập nhật `state.profile`
10. `clearAllForms()` - xóa hết input field
11. `renderNav()` cập nhật giao diện:
    - Tab mới: "Dự đoán", "Library", "History", "Tên Người Dùng"
12. `fillAccount()` điền thông tin profile vào tab Account
13. `loadHistory()` tải dữ liệu lịch sử 50 bản ghi gần nhất:
    - Gọi RPC `get_prediction_history(user_id, row_limit=50)`
    - Hiển thị danh sách trong tab History
14. Modal đóng
15. Toast: "Đăng nhập thành công"
16. Tab chuyển sang "Dự đoán"

### Alternative Flows

#### A1: Email không đúng
- Supabase error: "Invalid credentials"
- Toast: "Email hoặc mật khẩu không đúng"

#### A2: Mật khẩu sai
- Supabase error: "Invalid credentials"
- Toast: "Email hoặc mật khẩu không đúng"

#### A3: Tài khoản bị khóa/xóa
- Supabase error: "User not found"
- Toast: "Tài khoản này không tồn tại"

#### A4: Khách muốn chuyển sang đăng ký
- Click link "Chưa có tài khoản? Đăng ký"
- Form chuyển mode (UC-G04)

### Error Handling
- **No internet**: "Lỗi kết nối, vui lòng kiểm tra mạng"
- **Supabase error**: Hiển thị message từ Supabase
- **Session creation failed**: "Không thể tạo phiên, vui lòng thử lại"

---

## UC-G06: Xem chi tiết dự đoán (Khách đã đăng nhập)

### Mô tả
Sau khi đăng nhập, khách xem lịch sử dự đoán trước đó trong tab "History".

### Preconditions
- Khách đã đăng nhập (hoàn thành UC-G05)
- Khách đã có ít nhất 1 bản ghi dự đoán trước đó

### Postconditions
- Tab History hiển thị bảng dữ liệu
- Khách có thể click để xem chi tiết từng bản ghi

### Main Flow
1. Khách ở tab "Dự đoán" sau khi đăng nhập
2. Khách click tab "History"
3. `loadHistory()` được gọi:
   - Gọi RPC: `get_prediction_history(user_id, row_limit=50)`
4. Backend trả về dữ liệu:
   ```json
   [
     {
       "id": "uuid-1",
       "created_at": "2026-05-13T10:30:00Z",
       "has_diabetes": "Có nguy cơ cao",
       "probability": 0.85,
       "risk_band": "High",
       "glucose": 145,
       "bmi": 28.6,
       "age": 42,
       "input_payload": {...},
       "prediction_payload": {...}
     },
     ...
   ]
   ```
5. Frontend render bảng trong History tab:
   - Cột: Thời gian, Kết luận, Risk Band, Glucose, BMI, Age
   - Mỗi hàng có thể click để xem chi tiết
6. Khách click vào 1 hàng
7. Modal chi tiết mở ra (nếu có feature history detail)
8. Hiển thị:
   - Thời gian dự đoán
   - Input data: 8 chỉ số
   - Kết luận AI
   - Alerts, recommendations, insights
   - Radar chart so sánh

### Error Handling
- **No history**: "Chưa có dữ liệu."
- **Fetch error**: "Lỗi tải lịch sử"

---

## Tóm tắt Use Case Khách

| Use Case | Trigger | Kết quả |
|----------|---------|--------|
| UC-G01 | Mở ứng dụng | Giao diện chính, model loaded |
| UC-G02 | Click "Library" | Xem biểu đồ tham chiếu |
| UC-G03 | Click "Phân tích" (khách không đăng nhập) | Chuyển hướng đến UC-G04 hoặc UC-G05 |
| UC-G04 | Click "Đăng ký" | Tạo tài khoản mới, tự động đăng nhập |
| UC-G05 | Click "Đăng nhập" | Xác thực, tải profile, lịch sử |
| UC-G06 | Click "History" | Xem danh sách dự đoán trước đó |

---

## Lưu ý kỹ thuật

### Model Loading Strategy
- **Startup**: Model load 1 lần duy nhất tại `initialize_application()`
- **Per-request**: Sử dụng `@lru_cache(maxsize=1)` trong `_load_model_bundle()`
- **Memory**: Model, scaler, imputer giữ trong memory suốt thời gian app chạy
- **Performance**: Mỗi dự đoán chỉ mất thời gian inference (~milliseconds), không reload model

### Supabase Integration
- **Auth**: Supabase Auth handle xác thực, JWT token
- **Database**: PostgreSQL backend, RLS policies bảo mật
- **RPC**: Custom SQL procedures cho complex queries (get_prediction_history, etc.)

### Form Clearing
- Khi đăng xuất: `clearAllForms()` xóa tất cả input
- Khi đăng ký/đăng nhập thành công: `clearAllForms()` xóa input
- Mục đích: Đảm bảo privacy, không lộ dữ liệu người trước
