# Tài liệu Chức năng Hệ thống (System Functions)

Tài liệu này tổng hợp toàn bộ các hàm và chức năng chính của cả Backend và Frontend trong hệ thống Dự đoán Tiểu đường.

## 1. BACKEND (Python - FastAPI)

### `app/api/routes.py`
- **`health_check`**: Kiểm tra trạng thái hoạt động của server (trả về OK nếu server chạy bình thường).
- **`supabase_public_config`**: Trả về cấu hình public của Supabase (URL, anon_key) cho frontend sử dụng.
- **`predict`**: Tiếp nhận dữ liệu khám bệnh, gọi mô hình AI để dự đoán khả năng mắc bệnh tiểu đường và trả về kết quả kèm phân tích.
- **`reference_stats`**: Trả về các chỉ số tham chiếu y khoa (ngưỡng bình thường của Glucose, BMI, Huyết áp...).
- **`model_info`**: Trả về thông tin của mô hình AI (độ chính xác, các đặc trưng quan trọng...).
- **`clinical_content`**: Trả về nội dung thư viện y khoa (chỉ số, lời khuyên, cảnh báo).
- **`admin_delete_user`**: API dành cho Admin để xóa toàn bộ dữ liệu và tài khoản của một người dùng.

### `app/services/admin.py`
- **`get_db_connection`**: Thiết lập và trả về kết nối trực tiếp đến database PostgreSQL.
- **`delete_user_and_data`**: Thực thi lệnh SQL xóa mọi dữ liệu liên quan đến user (lịch sử, profile) trong database.
- **`delete_user_from_auth`**: Gọi Supabase Admin API để xóa tài khoản người dùng khỏi hệ thống Auth.

### `app/services/prediction.py`
- **`predict_diabetes`**: Hàm xử lý logic chính của việc dự đoán, gọi model và tổng hợp các insight.
- **`_load_model_bundle`**: Tải mô hình AI (pipeline) và các meta data từ file đã train.
- **`_evaluate_metric`**: Đánh giá một chỉ số sức khỏe cụ thể so với khoảng tham chiếu bình thường.
- **`_probability_to_band`**: Chuyển đổi xác suất dự đoán (%) thành các mức độ rủi ro (Thấp, Trung bình, Cao).
- **`_build_metric_package`**: Phân tích tổng thể tất cả các chỉ số đầu vào và tạo ra các nhận xét chi tiết.
- **`_build_alerts`**: Dựa vào kết quả dự đoán để sinh ra các cảnh báo y tế (Alerts).
- **`_build_actions`**: Dựa vào kết quả dự đoán để đề xuất các hành động cải thiện sức khỏe (Actions).

---

## 2. FRONTEND (JavaScript)

### `common.js` (Tiện ích chung)
- **`api`**: Hàm tạo URL API đầy đủ từ endpoint tương đối.
- **`isAdmin`**: Kiểm tra xem user hiện tại có phải là admin hay không.
- **`isAuth`**: Kiểm tra xem user hiện tại đã đăng nhập hay chưa.
- **`buildApiUrl`**: Xây dựng URL API backend đầy đủ.
- **`getInputPayload`**: Lấy toàn bộ dữ liệu mà người dùng đã nhập trên form dự đoán.
- **`setInputPayload`**: Điền dữ liệu từ một object vào form dự đoán.
- **`fetchJson`**: Hàm tiện ích để gọi fetch API và tự động parse JSON.
- **`showToast`**: Hiển thị thông báo (toast) dạng text ngắn trên góc màn hình.

### `ui.js` (Xử lý giao diện chung)
- **`numericValue`**: Chuyển đổi giá trị sang dạng số, nếu lỗi trả về giá trị mặc định.
- **`setMetricNumber`**: Hiển thị một số liệu lên màn hình có định dạng.
- **`primeCountUp`**: Hiệu ứng số đếm tăng dần (animation) cho các chỉ số.
- **`activateTab`**: Xử lý chuyển đổi giữa các tab (hiển thị panel tương ứng).
- **`formatPercent`**: Định dạng số thành dạng phần trăm (VD: 85.5%).
- **`toneClass`**: Trả về class màu sắc (xanh, vàng, đỏ) dựa trên mức độ cảnh báo của chỉ số.
- **`riskTone`**: Trả về class màu sắc theo mức độ rủi ro của kết quả dự đoán tổng thể.
- **`updateRiskMeter`**: Cập nhật giao diện thanh đo mức độ rủi ro hình bán nguyệt (gauge chart).

### `auth-rbac.js` (Xác thực, Phân quyền, Điều hướng)
- **`toast`**: Hiển thị thông báo (toast) cho phần xác thực và điều hướng.
- **`debounce`**: Hàm trì hoãn thực thi sự kiện (chống spam click/gõ phím liên tục).
- **`activateTab`**: Chuyển tab trên thanh điều hướng chính và lưu trạng thái vào localStorage.
- **`openAuth`**: Mở cửa sổ popup đăng nhập / đăng ký.
- **`closeModal`**: Đóng các cửa sổ popup (modal) trên màn hình.
- **`setAuthMode`**: Chuyển đổi giao diện popup giữa Đăng nhập và Đăng ký.
- **`ensurePanels`**: Tạo và tiêm (inject) các phần tử HTML của các tab panel vào DOM nếu chưa có.
- **`renderNav`**: Cập nhật thanh điều hướng phụ thuộc vào quyền (Guest, User, Admin).
- **`ensureMyProfile`**: Đảm bảo profile của user hiện tại đã tồn tại trong database (sync từ Auth).
- **`loadProfile`**: Tải thông tin cá nhân của user từ database.
- **`fillAccount`**: Điền thông tin profile vào form "Tài khoản".
- **`clearAllForms`**: Xóa rỗng toàn bộ các form trên trang khi đăng xuất hoặc reset.
- **`loadHistory`**: Tải lịch sử dự đoán của user từ Supabase.
- **`savePrediction`**: Lưu kết quả dự đoán mới vào database.
- **`subscribeUserRealtime`**: Đăng ký nhận sự kiện realtime để tự động cập nhật lịch sử khi có dự đoán mới.
- **`unsubscribeUserRealtime`**: Hủy đăng ký realtime.
- **`init`**: Khởi tạo module auth, kiểm tra phiên đăng nhập và tải dữ liệu tương ứng.
- **`bindEvents`**: Gắn các sự kiện click, submit form chung cho toàn trang.

### `guest.js` / `app.js` (Trang chủ & Giao diện khách)
- **`metricPreview`**: Xem trước (preview) kết quả đánh giá nhanh của một chỉ số khi đang nhập form.
- **`renderQuickSignals`**: Hiển thị các tín hiệu nhanh (màu sắc) bên cạnh form nhập liệu.
- **`renderResult`**: Hiển thị kết quả dự đoán tổng thể (xác suất, mức độ rủi ro).
- **`renderAlerts`**: Hiển thị danh sách các cảnh báo y tế dựa trên kết quả.
- **`renderActions`**: Hiển thị các hành động khuyến nghị tiếp theo.
- **`renderMetricInsights`**: Hiển thị phân tích chi tiết cho từng chỉ số (Glucose, BMI...).
- **`renderRadarChart`**: Vẽ biểu đồ radar so sánh các chỉ số của user với mức trung bình.
- **`deriveRangeProfile`**: Tính toán profile của các khoảng tham chiếu y khoa.
- **`renderLibraryVisuals`**: Hiển thị hình ảnh trực quan trong thư viện y khoa.
- **`renderReferenceGrid`**: Hiển thị bảng chỉ số tham chiếu y khoa trong Thư viện.
- **`renderEducation`**: Hiển thị nội dung giáo dục, kiến thức về bệnh tiểu đường.
- **`savePredictionState`**: Lưu trạng thái dự đoán hiện tại vào sessionStorage để không bị mất khi F5.
- **`restorePredictionState`**: Khôi phục kết quả dự đoán từ sessionStorage.

### `user.js` (Chức năng riêng cho User đã đăng nhập)
- **`historyNormalizeText`**: Chuẩn hóa văn bản trong bảng lịch sử.
- **`historyFormatDate`**: Định dạng ngày tháng hiển thị trong bảng lịch sử.
- **`ensureHistoryV2Layout`**: Tạo cấu trúc HTML cho tab lịch sử V2 (giao diện mới).
- **`renderHistoryV2Detail`**: Hiển thị chi tiết một lượt dự đoán trong lịch sử khi click vào dòng.
- **`getFilteredHistoryRows`**: Lọc danh sách lịch sử theo ngày tháng, tình trạng.
- **`closeHistoryDetail`**: Đóng bảng chi tiết lịch sử bên phải.

### `admin.js` (Chức năng dành riêng cho Admin)
- **`adminFmtNum`**: Định dạng hiển thị số liệu trong dashboard admin.
- **`adminRiskTone`**: Xác định màu sắc cảnh báo rủi ro trên bảng quản trị.
- **`loadAdminUsers`**: Tải danh sách tất cả người dùng trong hệ thống (kèm phân trang/lọc).
- **`loadLogs`**: Tải danh sách nhật ký hoạt động (log) của hệ thống.
- **`renderLogs`**: Hiển thị dữ liệu log lên bảng (với tính năng lọc theo text/loại/ngày).
- **`adminRenderHistoryTable`**: Hiển thị bảng lịch sử dự đoán của toàn bộ user.
- **`adminRenderUserLogs`**: Hiển thị nhật ký hoạt động của riêng một người dùng cụ thể.
- **`showUserModal`**: Mở cửa sổ popup xem chi tiết thông tin một người dùng và các thao tác (sửa/xóa).
- **`subscribeRealtime`**: Đăng ký sự kiện Supabase Realtime để admin thấy log và lịch sử được cập nhật ngay lập tức.
