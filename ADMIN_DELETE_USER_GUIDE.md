# Admin User Deletion Feature - Implementation Guide

## Tổng quan

Document này giải thích cách tính năng xóa người dùng của admin hoạt động và cách cấu hình nó.

## Mục tiêu

### Frontend (auth-rbac.js)
- Quản trị viên chọn tab "Quản lý".
- Chọn một người dùng từ danh sách để xem chi tiết.
- Trong tab hồ sơ, admin thấy nút "Xóa tài khoản"
- Admin xác nhận xóa
- Frontend gửi yêu cầu POST đến `/api/admin/delete-user` với token JWT

### Backend (FastAPI)
- Endpoint: `POST /api/admin/delete-user`
- Xác thực token JWT, kiểm tra role admin
- Xóa tất cả dữ liệu liên quan đến user đó trong public.profiles và public.predictions
- Nếu có SUPABASE_SERVICE_ROLE_KEY, gọi Supabase Admin API để xóa auth.users entry (best effort)
- Trả về kết quả thành công hoặc hiển thị thông báo lỗi

### Database (Supabase PostgreSQL)
- khi xóa profile, tất cả predictions liên quan sẽ tự động bị xóa do ON DELETE CASCADE
- auth.users có thể bị xóa thông qua:
  1. Backend sử dụng Service Role Key, khóa toàn quyền (Admin API)
  2. Bảng điều khiển trên Supabase bằng thao tác thủ công

## Yêu cầu hiện tại

### 1. Đặt SUPABASE_SERVICE_ROLE_KEY trong .env

Để hỗ trợ đầy đủ việc xóa xác thực thì thêm mã này vào `backend/.env`:

```
SUPABASE_SERVICE_ROLE_KEY=mã toàn quyền từ Supabase Dashboard
```

Cách lấy Service Role Key:
1. Đến trang Supabase Dashboard
2. Project Settings → API
3. Sao chéo mã "service_role" key (giữ nó SECRET, tuyệt đối không commit vào git)

### 2. Xác thục điện thoại

Bảng hồ sơ hien tai đã có cột `phone` với ràng buộc:
```sql
phone text unique check (phone IS NULL OR (char_length(trim(phone)) = 10 AND phone ~ '^[0-9]+$'))
```

- Số điẹn thoại có thể để trống (can be NULL)
- Số điện thoại nếu có phải là chuỗi 10 chữ số (0-9) và không chứa ký tự khác
- Số điện thoại phải là duy nhất trong hệ thống (unique)

## API Endpoint

### POST /api/admin/delete-user

**Request:**
```json
{
  "target_user_id": "12345678-1234-1234-1234-123456789012"
}
```

**Headers:**
```
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

**Response (Success):**
```json
{
  "success": true,
  "message": "User deleted successfully. Removed 5 predictions and 1 profile(s).",
  "deleted_user_id": "12345678-1234-1234-1234-123456789012",
  "details": {
    "predictions_deleted": 5,
    "profiles_deleted": 1
  }
}
```

**Response (Failed - Not Admin):**
```json
{
  "detail": "Admin role required"
}
```

**Response (Failed - Invalid Token):**
```json
{
  "detail": "Missing or invalid Authorization header"
}
```

## Luồng xử lý xóa người dùng được chia thành 3 bước chính:

### Step 1: Xác thực và kiểm tra quyền admin
- Backend giải mã mã JWT token (Giải mã cơ bản không cần xác minh chữ ký)
- Lấy user_id từ token
- Kiểm tra database: Is user.role = "admin"?
- Nếu không phải admin → Trả về 403 Forbidden

### Step 2: Xóa dữ liệu liên quan đến người dùng
- Xóa tất cả lịch sử dụ đoán của người dùng đó
- Xóa profile cho người dùng mục tiêu
- Public.predictions dã được tự động làm sạch do ON DELETE CASCADE

### Step 3: Xóa người dùng trong auth.users (Best Effort)
- Nếu SUPABASE_SERVICE_ROLE_KEY đã có trong .env và hợp lẹ:
  - Gọi API quản trị Supabase để xóa auth.users đó
  - Thao tác này loại bỏ người dùng khỏi hệ thống xác thực.
- Nếu chưa dược cấu hình, không hợp lệ, hoặc gọi API thất bại:
  - Thông báo rằng profile và dữ liệu đã bị xóa nhưng auth.users vẫn tồn tại
  - Cần thao tác thủ công trên Supabase Dashboard để xóa auth.users entry rất bất tiện

## Database Schema

### Cập nhật bảng `public.profiles` để thêm cột `phone`:

```sql
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    phone text unique check (phone IS NULL OR (char_length(trim(phone)) <= 10 AND char_length(trim(phone)) >= 7)),
    full_name text not null check (char_length(trim(full_name)) between 2 and 120),
    role text not null default 'user' check (role in ('user', 'admin')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_profiles_phone on public.profiles(phone);
```

## Cập nhật hàm RPC

### update_my_profile(new_full_name, new_phone)
- Nguòi dùng cập nhật tên đầy đủ và số điện thoại của mình
- Số điện thoại có thể để trống (null) hoặc phải là chuỗi 10 chữ số (0-9) và không chứa ký tự khác

### admin_update_profile(target_user_id, new_full_name, new_role, new_phone)
- Admin có thể thay đổi tên đầy đủ và số điện thoại của bất kỳ người dùng nào
- Tất cả các tham số đều có thể được sửa đổi thủ công tại Supabase Dashboard.

### admin_search_profiles(search_text, disease_filter)
- Cập nhật để có thể tìm kiếm theo số điện thoại
- Thêm trường số điện thoại trong kết quả return để hiển thị trên UI

## Các thành phần Frontend

### Trang quản lý người dùng (Management Tab)
- Hiển thị tất ca người dùng trong hệ thống.
- Có cập nhật: Full Name, Phone
- Tìm kiếm theo tên, email, hoặc số điện thoại, vv
- Click vào user để mở cửa sổ chi tiết người dùng (User Detail Modal)

### Cửa sổ chi tiết người dùng (User Detail Modal)
- Chọn một người dùng để xem chi tiết
- Trang "Thông tin" (Profile):
  - Hiện thị thông tin hồ sơ của người dùng (Full Name, Email, Phone, Role)
  - Có nút "Cập nhật" để admin chỉnh sửa thông tin người dùng
  - nút "Xóa tài khoản" (Sau khi xóa là không thể hoàn tác)
- Trang "Lịch sử" (History):
  - Hiển thị tất cả dự đoán của người dùng đó (thời gian, kết quả, vv)
  - thanh tìm kiếm với nhiều lựa chọn lọc (theo ngày, theo kết quả, vv)
- Trang "Nhật ký" (Log):
  - Hiển thị tất cả hoạt động của người dùng đó (dự đoán, cập nhật hồ sơ, vv)

## Kiểm tra và xác thực

### Xóa thủ nghiệm:
1. Đăng nhập với tài khoản admin
2. Tại trang quả lý, tìm kiếm và chọn một người dùng
3. Chọn một người dùng để mở cửa sổ chi tiết
4. Tại trang "Thông tin" (Profile), click nút "Xóa tài khoản"
5. Để ý thông báo thành công hoặc lỗi tại UI
6. Vào Supabase Dashboard:
   - Kiểm tra bảng `public.profiles` để xác nhận profile đã bị xóa
   - Kiểm tra bảng `public.predictions` để xác nhận tất cả dự đoán liên quan đã bị xóa
   - Kiểm tra Authentication → Users để xem auth.users entry đã bị xóa chưa

### Thử nghiệm số điện thoại:
1. Cập nhật số điện thoại: "0123456789" (10 digits) trả về "Cập nhật thành công"
2. Cập nhật số điện thoại: "012345" (6 digits) trả về lỗi "Invalid phone number format"
3. Cập nhật số điện thoại: "null" (clear field) trả về "Cập nhật thành công"

## Khắc phục lỗi thường gặp

### Error: "Admin role required"
- Người dùng không có role admin trong `public.profiles`
- Check JWT token có hợp lệ không
- Check profile.role = 'admin' trong database

### Error: "Invalid token"
- JWT token không hợp lệ hoặc đã hết hạn
- Kiểm tra token có đúng định dạng

### Error: "Auth deletion requires manual action"
- SUPABASE_SERVICE_ROLE_KEY Ko có trong .env hoặc không hợp lệ
- Cần phải xóa thủ công khỏi bảng điều khiển Supabase
  1. tới Authentication sau đó mở bẳng Users
  2. Tìm kiếm user_id của người dùng đã bị xóa profile
  3. Click vào user đó và chọn "Delete" để xóa hoàn toàn khỏi hệ thống xác thực

### Warning: "Auth deletion warning..."
- Lỗi khi gọi key quản trị admin Supabase (Service Role Key)
- Dữ liệu công khai đã bị xóa nhưng bảng xác thực người dùng (auth.users) vẫn tồn tại
- Vì khóa hết hạn hoặc do không cấu hình đúng cách
- Xóa thủ công trên Supabase

## Lưu ý về an toàn

- Không bao giời công khai khóa SUPABASE_SERVICE_ROLE_KEY
- Giữ mọi khóa quan trọng trong .env (gitignored)
- Backend sẽ sử dụng biến và được nạp khóa trong môi trường an toàn
- JWT token xác minh là cơ bản cần có (Không kiểm tra chữ ký)
- Để phát triển dự án hơn: Thêm tính năng xác thực chữ ký bằng khóa công khai Supabase

## Những cải tiến nên phát triển

1. Có thể xóa email và thông báo cho người dùng
2. Thêm thời gian hạn 7 ngày cho phép khôi phục
3. Xuất dữ liệu người dùng trước khi xóa
4. Thêm log các thao tác xóa của quản trị viên
5. Thực hiện xác minh chữ ký JWT để tăng bảo mật
6. Tính năng giới hạn tốc độ để ngăn chặn spam.
