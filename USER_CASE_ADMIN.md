# USE CASE - ADMIN (Quản trị viên)

## Tổng quan

Admin là người dùng có quyền quản trị (role = "admin"). Họ có toàn quyền quản lý người dùng, xem lịch sử hệ thống, xóa tài khoản, cập nhật thông tin user.

---

## UC-A01: Đăng nhập Admin

### Mô tả
Admin có tài khoản được cấp quyền admin sẵn hoặc được nâng cấp quyền từ user. Admin đăng nhập để truy cập dashboard quản lý.

### Preconditions
- Tài khoản admin đã được tạo với `role = "admin"` trong `public.profiles`
- Tài khoản có email và mật khẩu

### Postconditions
- Admin đăng nhập thành công
- Giao diện chuyển sang dashboard admin với 3 tab: Management, Activity Log, [Admin Name]

### Main Flow
1. Admin truy cập URL ứng dụng
2. Auth modal mở (khách nhập email/password hoặc click "Đăng nhập")
3. Admin nhập:
   - Email: "admin@example.com"
   - Mật khẩu: "***"
4. Click "Đăng nhập"
5. Supabase xác thực thành công
6. `loadProfile()` được gọi:
   - Fetch từ `public.profiles` → role = "admin"
7. `renderNav()` cập nhật:
   - Kiểm tra `isAdmin()` → true
   - Render 3 tab: "Management" | "Activity Log" | "[Admin Name]"
8. `loadAdminUsers()` được gọi tự động:
   - RPC: `admin_search_profiles(search_text="", disease_filter=null)`
   - Tải danh sách tất cả user (không bao gồm admin khác)
9. Dashboard hiển thị tab Management đầu tiên:
   - Search field: "Tìm kiếm"
   - Filter: "Tình trạng" (Tất cả, Có nguy cơ, Bình thường)
   - Bảng user: Họ tên, Email, Tình trạng (has_diabetes), Ngày tạo
10. Toast: "Đăng nhập thành công"

---

## UC-A02: Tìm kiếm người dùng

### Mô tả
Admin muốn tìm kiếm người dùng cụ thể bằng tên hoặc email.

### Preconditions
- Admin đã đăng nhập (UC-A01)
- Ở tab Management

### Postconditions
- Bảng user được filter theo tìm kiếm
- Hiển thị kết quả phù hợp

### Main Flow
1. Admin ở tab Management
2. Admin nhập vào search field: "Nguyễn"
3. Input event trigger `debounce("adminSearch", loadAdminUsers, 300)`
4. Sau 300ms, `loadAdminUsers()` được gọi:
   ```javascript
   const search_text = $("adminUserSearch")?.value || "";  // "Nguyễn"
   const disease_filter = $("adminDiseaseFilter")?.value || null;
   ```
5. RPC call: `admin_search_profiles(search_text="Nguyễn", disease_filter=null)`
6. Backend query:
   ```sql
   SELECT * FROM public.profiles 
   WHERE role != 'admin' 
   AND (full_name ILIKE '%Nguyễn%' OR email ILIKE '%Nguyễn%')
   ORDER BY created_at DESC
   ```
7. Kết quả trả về, filter thêm `role != "admin"` (loại admin khác)
8. Bảng update hiển thị chỉ các user khớp: "Nguyễn Văn A", "Nguyễn Thị B"

### Alternative Flows

#### A1: Search kết hợp Disease Filter
- Admin chọn filter "Có nguy cơ"
- Search: "Nguyễn"
- RPC: `admin_search_profiles("Nguyễn", disease_filter="diabetes")`
- Kết quả: User có tên chứa "Nguyễn" VÀ has_diabetes = true

#### A2: Chỉ filter status, không search
- Search field trống
- Filter: "Bình thường"
- RPC: `admin_search_profiles("", disease_filter="normal")`
- Kết quả: Tất cả user có has_diabetes = false

#### A3: Search không có kết quả
- Bảng hiển thị: "Không có người dùng."

### Error Handling
- **RPC error**: "Lỗi tìm kiếm"
- **Network timeout**: Không cập nhật bảng

---

## UC-A03: Xem chi tiết người dùng

### Mô tả
Admin click vào 1 user trong bảng để xem thông tin chi tiết, lịch sử dự đoán, và thực hiện hành động như cập nhật profile hoặc xóa tài khoản.

### Preconditions
- Admin đang xem bảng user (UC-A02)
- Bảng có ít nhất 1 user

### Postconditions
- Modal chi tiết mở ra
- Hiển thị profile, lịch sử dự đoán, nhật ký hành động
- Admin có thể cập nhật hoặc xóa user

### Main Flow
1. Admin ở tab Management
2. Admin click vào 1 hàng user: "Nguyễn Văn A"
3. Click handler gọi `showUserModal(profile)`:
   - Lưu profile vào `state.selectedProfile`
4. Modal admin user mở ra (`adminUserModal` hiển thị)
5. Modal hiển thị 3 tab:
   - **Tab Profile**: Thông tin cá nhân, form cập nhật
   - **Tab History**: Lịch sử dự đoán của user này
   - **Tab Activity**: Nhật ký hành động (login, predictions)
6. **Tab Profile** hiển thị:
   - Họ tên: "Nguyễn Văn A" (text input)
   - Email: "user@example.com" (text, readonly)
   - Điện thoại: "0987654321" (text input)
   - 2 nút hành động:
     - "Cập nhật": Lưu thay đổi profile
     - "Xóa tài khoản": Xóa user (UC-A04)
7. **Tab History** hiển thị:
   - Bảng lịch sử dự đoán của user
   - Cột: Thời gian, Kết luận, Risk Band, Glucose, BMI, Age
   - Tối đa 100 hàng
   - Search field để filter
   - Filter Outcome (Tất cả, Có nguy cơ, Bình thường)
   - Filter Risk Band
   - Sort: Mới nhất, Cũ nhất, Risk cao nhất, Risk thấp nhất
   - Mỗi hàng click để xem chi tiết dự đoán (UC-A05)
8. **Tab Activity** hiển thị:
   - Bảng nhật ký hệ thống cho user này
   - Cột: Timestamp, Type (AUTH/PREDICT), Detail
   - Lấy từ `_logs` (được populate từ profiles + predictions)
   - Hiển thị tối đa 100 bản ghi

### Alternative Flows

#### A1: User không có lịch sử
- Tab History: "Chưa có lịch sử."

#### A2: User không có nhật ký hành động
- Tab Activity: "Không có nhật ký cho người dùng này."

### Error Handling
- **Fetch history failed**: "Lỗi tải lịch sử"
- **Fetch logs failed**: "Lỗi tải nhật ký"

---

## UC-A04: Xóa tài khoản người dùng

### Mô tả
Admin xác nhận và xóa tài khoản của 1 user, bao gồm xóa dữ liệu từ `public.profiles`, `public.predictions`, và cố gắng xóa `auth.users`.

### Preconditions
- Admin đang xem modal chi tiết user (UC-A03)
- Ở tab Profile
- Admin muốn xóa user

### Postconditions
- User bị xóa hoàn toàn
- Modal đóng
- Bảng Management cập nhật (user biến mất)
- Toast: "Xóa tài khoản thành công"

### Main Flow
1. Admin ở modal chi tiết user
2. Admin click nút "Xóa tài khoản"
3. JavaScript confirm dialog mở:
   ```
   "Xóa tài khoản user@example.com? Hành động này không thể hoàn tác."
   ```
4. Admin click "OK" để xác nhận
5. Gửi `POST /api/admin/delete-user` với:
   ```json
   {
     "target_user_id": "uuid-user"
   }
   ```
   - Header: `Authorization: Bearer {access_token}`
6. Backend xử lý trong `routes.py`:
   - Kiểm tra JWT token valid và admin role
   - Gọi RPC hoặc trigger: `admin_delete_user(target_user_id)`
   - Trong stored procedure:
     ```sql
     -- 1. Xóa predictions
     DELETE FROM public.predictions WHERE user_id = target_user_id;
     
     -- 2. Xóa profile
     DELETE FROM public.profiles WHERE id = target_user_id;
     
     -- 3. Cố gắng xóa auth user (best effort, có thể fail nếu không có service role key)
     -- Nếu có SUPABASE_SERVICE_ROLE_KEY:
     --   DELETE FROM auth.users WHERE id = target_user_id;
     ```
7. Response trả về:
   ```json
   {
     "message": "Tài khoản và dữ liệu liên quan đã được xóa"
   }
   ```
8. Frontend xử lý:
   - Toast: "Xóa tài khoản thành công"
   - `closeModal("adminUserModal")`
   - `loadAdminUsers()` reload bảng
9. Bảng Management cập nhật, user không còn

### Alternative Flows

#### A1: Admin hủy xóa
- Click "Cancel" hoặc "No" trong dialog
- Không gửi request
- Modal vẫn mở

#### A2: Xóa auth.users fail
- Backend trả về partial success:
   ```json
   {
     "message": "Profile xóa thành công nhưng không thể xóa auth user"
   }
   ```
- Toast vẫn xác nhận thành công (user đã xóa khỏi app)

#### A3: Xóa profile fail
- Backend trả về error
- Toast: "Lỗi: [chi tiết]"
- Modal vẫn mở

### Error Handling
- **Invalid JWT**: "Phiên làm việc không hợp lệ"
- **Not admin**: "Không có quyền thực hiện hành động này"
- **User not found**: "Người dùng không tồn tại"
- **Delete failed**: "Lỗi xóa tài khoản"

---

## UC-A05: Xem chi tiết 1 dự đoán (Admin View)

### Mô tả
Admin xem chi tiết đầy đủ của 1 bản ghi dự đoán của user, bao gồm input data, kết quả, alerts, recommendations.

### Preconditions
- Admin đang xem Tab History của user (UC-A03, Tab History)
- Bảng History có ít nhất 1 bản ghi

### Postconditions
- Panel chi tiết hiển thị đầy đủ thông tin dự đoán

### Main Flow
1. Admin ở Tab History của user modal
2. Admin click 1 hàng dự đoán
3. Click handler gọi `adminSelectRecord(prediction_id)`
4. Chi tiết panel hiển thị bên phải (hoặc dưới bảng):
   - Input data 8 chỉ số
   - Kết quả AI: Model probability, Clinical probability, Risk band
   - Alerts: Danh sách cảnh báo
   - Recommendations: Khuyến nghị
   - Metric insights: Giải thích từng chỉ số
   - Radar chart: So sánh với reference
5. Admin có thể click hàng khác để chuyển sang dự đoán tiếp theo
6. Click nút "×" để đóng panel chi tiết

### Error Handling
- **Prediction data missing**: "Dữ liệu dự đoán không hoàn chỉnh"

---

## UC-A06: Cập nhật thông tin người dùng

### Mô tả
Admin cập nhật thông tin cá nhân của user: họ tên, số điện thoại, quyền hạn.

### Preconditions
- Admin đang xem Tab Profile của user modal (UC-A03)

### Postconditions
- Thông tin user được cập nhật
- Toast: "Đã cập nhật"
- Modal vẫn mở

### Main Flow
1. Admin ở modal chi tiết user, Tab Profile
2. Admin thấy form:
   - Họ tên: "Nguyễn Văn A" (editable)
   - Email: "user@example.com" (readonly)
   - Điện thoại: "0987654321" (editable)
3. Admin sửa họ tên: "Nguyễn Văn AB"
4. Admin click "Cập nhật"
5. Form handler kiểm tra:
   - Họ tên >= 2 ký tự → pass
6. Gọi RPC: `admin_update_profile(target_user_id, new_full_name, new_phone, new_role)`
   - Trong backend:
     ```sql
     UPDATE public.profiles 
     SET full_name = $1, phone = $2, role = 'user', updated_at = NOW()
     WHERE id = $3
     ```
7. Response thành công
8. Toast: "Đã cập nhật"
9. Modal vẫn mở
10. Admin có thể tiếp tục cập nhật user khác

### Error Handling
- **Họ tên < 2 ký tự**: "Họ tên ≥ 2 ký tự"
- **RPC error**: "Lỗi cập nhật"

---

## UC-A07: Xem Activity Log toàn hệ thống

### Mô tả
Admin xem nhật ký hành động toàn hệ thống: các account được tạo, dự đoán, login. Filter và tìm kiếm theo username, email, loại hành động, thời gian.

### Preconditions
- Admin đã đăng nhập (UC-A01)

### Postconditions
- Tab Activity Log hiển thị bảng nhật ký
- Có thể filter và tìm kiếm

### Main Flow
1. Admin click tab "Activity Log"
2. `loadLogs()` được gọi tự động (hoặc lần đầu):
   - Fetch tất cả profiles, predictions từ Supabase
   - Sinh log entries:
     ```
     - Mỗi profile tạo → log "auth" type "Tài khoản tạo"
     - Mỗi profile updated → log "auth" type "Hoạt động gần nhất"
     - Mỗi prediction → log "prediction" type "Dự đoán", level = critical/warn/ok
     ```
   - Sort by timestamp DESC (mới nhất trước)
3. Bảng Activity Log hiển thị:
   - Toolbar:
     - Search: "Tìm kiếm" (tên, email, chi tiết)
     - Filter Type: "Xác thực" hoặc "Dự đoán"
     - Filter Time: "Mọi lúc", "Hôm nay", "7 ngày", "30 ngày"
     - Count badge: "N bản ghi"
   - Bảng columns:
     - Timestamp (ISO 8601 format)
     - Type: "AUTH" hoặc "PREDICT" badge
     - User: Tên hoặc email
     - Detail: Chi tiết hành động
   - Row color dựa vào level:
     - critical: Đỏ
     - warn: Vàng
     - ok: Xanh
   - Tối đa 150 hàng được render
4. Admin nhập search: "user@example.com"
5. Bảng filter và cập nhật:
   - Kiểm tra user + email + detail chứa chuỗi search (case insensitive)
   - Cập nhật count badge

### Alternative Flows

#### A1: Filter theo loại hành động
- Chọn "Xác thực" → chỉ hiển thị logs type "auth"

#### A2: Filter theo khoảng thời gian
- Chọn "7 ngày" → chỉ hiển thị 7 ngày qua
- Tính: `now - timestamp <= 7 days`

#### A3: Kết hợp nhiều filter
- Search: "Nguyễn"
- Type: "Dự đoán"
- Time: "30 ngày"
- Kết quả: Dự đoán của Nguyễn trong 30 ngày qua

#### A4: Không có dữ liệu
- Bảng: "Không có bản ghi."

### Error Handling
- **Fetch logs error**: "Lỗi tải nhật ký"
- **Large dataset timeout**: Render 150 hàng đầu tiên

---

## UC-A08: Cập nhật thông tin tài khoản Admin

### Mô tả
Admin cập nhật thông tin cá nhân của chính mình: họ tên, số điện thoại, mật khẩu.

### Preconditions
- Admin đã đăng nhập (UC-A01)

### Postconditions
- Thông tin admin được cập nhật
- Toast: "Đã cập nhật"

### Main Flow
1. Admin click tab "[Admin Name]" (cuối cùng)
2. Tương tự UC-U05 (User cập nhật account)
3. Form được điền với thông tin admin hiện tại
4. Admin sửa và click "Cập nhật"
5. Gọi RPC: `update_my_profile(new_full_name, new_phone)`
6. Response thành công
7. `loadProfile()` reload thông tin
8. `renderNav()` cập nhật tên admin nếu thay đổi
9. Toast: "Đã cập nhật"

---

## UC-A09: Đăng xuất Admin

### Mô tả
Admin đăng xuất khỏi hệ thống.

### Preconditions
- Admin đang đăng nhập

### Postconditions
- Session xóa
- Quay về giao diện khách
- Tất cả form xóa trống

### Main Flow
1. Tương tự UC-U07 (User đăng xuất)
2. Admin click "Đăng xuất" ở tab Account
3. `clearAllForms()` → xóa trống tất cả input
4. `state.session = null; state.profile = null`
5. `renderNav()` → quay về 3 tab khách
6. Toast: "Đã đăng xuất"

---

## Tóm tắt Use Case Admin

| Use Case | Trigger | Kết quả |
|----------|---------|--------|
| UC-A01 | Đăng nhập admin | Dashboard admin, 3 tab (Management, Activity Log, [Name]) |
| UC-A02 | Nhập search, chọn filter | Bảng user cập nhật theo điều kiện |
| UC-A03 | Click 1 user | Modal chi tiết mở (Profile, History, Activity) |
| UC-A04 | Click "Xóa tài khoản" | Confirm → user bị xóa, bảng cập nhật |
| UC-A05 | Click 1 dự đoán trong History | Panel chi tiết hiển thị |
| UC-A06 | Sửa form + "Cập nhật" | Profile user được lưu, toast xác nhận |
| UC-A07 | Click "Activity Log" | Bảng nhật ký hệ thống với filter/search |
| UC-A08 | Cập nhật Account admin | Thông tin admin được lưu |
| UC-A09 | Click "Đăng xuất" | Xóa state, quay về khách |

---

## Lưu ý kỹ thuật

### Admin Authorization
- Backend kiểm tra JWT token: `state.session.access_token`
- Decoding JWT → verify user role = "admin"
- RLS policies: Chỉ admin mới truy cập các endpoints quản lý

### User Search & Filter
- Backend RPC: `admin_search_profiles(search_text, disease_filter)`
- Filter params:
  - `search_text`: Tìm trong full_name, email
  - `disease_filter`: "diabetes" hoặc "normal" (lookup latest prediction)
- Exclude admins: `WHERE role != 'admin'`

### Activity Log Generation
- Dữ liệu từ 2 bảng: profiles + predictions
- Profile events: create_at, updated_at
- Prediction events: created_at, có level (critical/warn/ok) dựa vào probability
- Client-side filter: Tìm kiếm, type, time range

### Deletion Strategy
- `admin_delete_user` RPC:
  1. Xóa predictions (cascade từ profiles)
  2. Xóa profile
  3. Cố gắng xóa auth.users (nếu có service role key)
- Best effort: Nếu auth.users fail → không block app, user bị xóa khỏi app

### Performance
- History load: Tối đa 100 hàng per user
- Activity Log: Tối đa 150 hàng render (với 200 fetch từ backend)
- Search: Debounce 300ms
- No pagination: Scroll limit fixed

### Security
- All RPC calls have RLS policies
- Admin role check in backend
- JWT token required for delete endpoint
- Email readonly in admin/user forms
- Password field never sent back, only for update
