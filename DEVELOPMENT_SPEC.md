# Diabetes Prediction Webapp - Development Spec

## Muc tieu nghiep vu

Ung dung ho tro sang loc nguy co dai thao duong bang 8 chi so dau vao Pima:

- `Pregnancies`
- `Glucose`
- `BloodPressure`
- `SkinThickness`
- `Insulin`
- `BMI`
- `DiabetesPedigreeFunction`
- `Age`

Ket qua chi dung cho sang loc va giai thich nguy co, khong thay the chan doan y khoa.

## Kien truc hien tai

- Frontend tinh: `frontend/index.html`, `frontend/app.js`, `frontend/auth-rbac.js`, `frontend/ui.js`.
- Backend FastAPI: `backend/main.py`.
- API nghiep vu: `backend/app/api/routes.py`.
- Model inference: `backend/app/services/prediction.py`.
- Auth/RBAC va lich su theo user: Supabase Auth + bang `public.profiles` va `public.predictions`, schema tai `backend/supabase_schema.sql`.

## Luong chay chinh

1. Trinh duyet tai frontend tu FastAPI static mount.
2. `app.js` tai metadata model, noi dung lam sang va reference stats qua `/api`.
3. `auth-rbac.js` tai public Supabase config qua `/api/supabase-config`.
4. User dang nhap bang Supabase Auth.
5. Sau dang nhap, frontend goi `ensure_my_profile()` roi doc `profiles` de lay `role`.
6. Khi submit form:
   - `app.js` goi `/api/predict` de chay model.
   - Backend chi tra ket qua inference, khong ghi lich su.
   - `auth-rbac.js`, neu user da dang nhap, goi RPC `create_prediction()` de luu ban ghi vao `public.predictions`.
7. User thuong xem lich su cua minh qua RPC `get_prediction_history()`.
8. Admin xem danh sach user qua RPC `admin_search_profiles()` va xem lich su tung user qua `get_prediction_history(target_user_id)`.

## Quyen va vai tro

- `user`: duoc dang nhap, du doan, xem/cap nhat profile cua minh, xem lich su cua minh.
- `admin`: co tat ca quyen cua `user`, xem/cap nhat profile user khac, xem lich su user khac.
- Role nam trong `public.profiles.role`, chi nhan `user` hoac `admin`.
- User dau tien muon thanh admin can cap nhat bang SQL trong Supabase:

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

## Supabase SQL bat buoc

Moi lan thay doi schema, chay toan bo file:

```text
backend/supabase_schema.sql
```

File nay tao:

- Bang `profiles`, `predictions`.
- Trigger `on_auth_user_created`.
- RPC `ensure_my_profile`, `update_my_profile`, `admin_update_profile`.
- RPC `create_prediction`, `get_prediction_history`, `admin_search_profiles`.
- RLS policies va grants cho role `authenticated`.

## Loi dang nhap thuong gap

### Dang nhap dung email/pass nhung UI khong vao duoc

Nguyen nhan hay gap:

- User co trong Supabase Auth nhung khong co dong trong `public.profiles`.
- Trigger tao profile fail do `full_name` qua ngan.
- Chua chay schema moi nen thieu RPC `ensure_my_profile`.
- Frontend nhan sai public key vi `.env` thieu `SUPABASE_ANON_KEY` hoac `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Cach kiem tra:

```sql
select id, email, raw_user_meta_data, created_at
from auth.users
order by created_at desc;

select id, email, full_name, role, created_at
from public.profiles
order by created_at desc;
```

Neu user thieu profile, sau khi chay schema moi, dang nhap lai tren UI de frontend goi `ensure_my_profile()`.

### RPC bao `function does not exist`

Chua chay lai `backend/supabase_schema.sql` tren Supabase SQL editor.

### RPC bao `Not authenticated`

Token Supabase tren browser khong hop le hoac user chua dang nhap. Kiem tra console Network request den Supabase co header `Authorization: Bearer ...` hay khong.

### RPC bao `Admin role required`

Tai khoan dang dung chua co `role = 'admin'` trong `public.profiles`.

## Loi SQL/nghiep vu da biet

- Khong loc admin theo chuoi tieng Viet trong `has_diabetes`; dung `probability >= 0.35` de tranh loi encoding.
- Khong de profile rong hoac ten 1 ky tu lam fail trigger; fallback ve `User`.
- Khong de loi doc profile lam mat trang thai dang nhap; frontend co fallback tu Supabase session.
- `public.predictions` la nguon lich su duy nhat. Khong tao lai `prediction_history`, `history_store.py`, `models/check.py`, hoac endpoint `/api/history`.

## Bien moi truong bat buoc

Dat trong `backend/.env`:

```env
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=...
CORS_ALLOW_ORIGINS=*
```

Ghi chu:

- `SUPABASE_ANON_KEY` hoac `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` duoc tra ve browser qua `/api/supabase-config`.

## Quy tac nghiep vu da chot

- Backend `/api/predict` chi thuc hien validate input va inference, khong ghi database.
- Frontend chi cho submit du doan khi da co Supabase session.
- Sau khi `/api/predict` thanh cong, `app.js` phat event `diabetes:prediction-complete` kem dung `input` va `prediction` vua nhan.
- `auth-rbac.js` lang nghe event nay va goi `create_prediction(input_payload, prediction_payload)` de luu lich su.
- Khong luu lich su bang `setTimeout` hoac doc lai `sessionStorage` sau submit, vi co the luu nham ket qua cu.
- Truoc khi doc profile hoac luu prediction, frontend goi `ensure_my_profile()` de tu phuc hoi profile neu Auth user da ton tai.
- Khi dang xuat, UI phai xoa bang history dang hien thi va quay ve trang thai yeu cau dang nhap.
- Full name khi update phai co it nhat 2 ky tu o client va SQL.
- Admin filter tinh trang benh dua tren `latest_probability >= 0.35`, khong dua tren chuoi tieng Viet trong `has_diabetes`.

## Quy tac UI

- Khong dung animation, transition, count-up, requestAnimationFrame, IntersectionObserver, hoac SSE cho UI hien tai.
- Cac chi so tren dashboard duoc set truc tiep ngay khi co data.
- Toast co the tu an sau mot khoang thoi gian, nhung khong co hieu ung chuyen dong.
- `public.predictions` la nguon lich su duy nhat; UI history chi doc qua Supabase RPC.

## Checklist truoc khi sua code

1. Chay backend:

```powershell
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

2. Mo `http://127.0.0.1:8000`.
3. Kiem tra `/api/health`.
4. Kiem tra `/api/supabase-config` co `url` va `anon_key`.
5. Dang nhap user thuong, submit du doan, dam bao chi co mot request `create_prediction` cho moi lan submit thanh cong.
6. Xem tab History cua user, du lieu phai den tu `get_prediction_history`.
7. Dang xuat, bang History phai quay ve trang thai yeu cau dang nhap.
8. Dang nhap admin, mo User Management, loc user, xem detail va lich su tung user.
9. Xem DevTools Console va Network, khong de loi RPC hoac 401/403 chua giai thich.

## Huong phat trien tiep theo

- Tao endpoint backend co auth token neu muon backend ghi `public.predictions` thay frontend RPC.
- Sua encoding tieng Viet trong cac file Python/HTML/JS dang bi mojibake.
- Them migration version thay vi chay schema nguyen cuc khi du an lon hon.
