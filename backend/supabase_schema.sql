-- ================================================================
-- SUPABASE SCHEMA — Cơ sở dữ liệu cho ứng dụng sàng lọc đái tháo đường
-- ================================================================
-- Bao gồm: bảng profiles + predictions, triggers, RPC functions,
-- RLS policies, và phân quyền.

-- Bật extension mã hóa (dùng cho gen_random_uuid nếu cần)
create extension if not exists pgcrypto;

-- ================================================================
-- BẢNG DỮ LIỆU
-- ================================================================

-- Bảng hồ sơ người dùng (1:1 với auth.users)
-- Tự động tạo khi đăng ký qua trigger handle_new_user()
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    phone text unique check (phone IS NULL OR (char_length(trim(phone)) = 10 AND phone ~ '^[0-9]+$')),
    full_name text not null check (char_length(trim(full_name)) between 2 and 120),
    role text not null default 'user' check (role in ('user', 'admin')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Bảng lưu kết quả dự đoán
-- Mỗi row = 1 lần user submit form phân tích
-- Lưu cả 8 chỉ số đầu vào + toàn bộ kết quả AI + payload gốc (JSONB)
create table if not exists public.predictions (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.profiles(id) on delete cascade,
    -- 8 chỉ số lâm sàng đầu vào
    pregnancies integer not null check (pregnancies >= 0),          -- Số lần mang thai
    glucose double precision not null check (glucose >= 0),          -- Đường huyết (mg/dL)
    blood_pressure double precision not null check (blood_pressure >= 0), -- Huyết áp tâm trương (mmHg)
    skin_thickness double precision not null check (skin_thickness >= 0), -- Độ dày lớp mỡ dưới da (mm)
    insulin double precision not null check (insulin >= 0),          -- Insulin (mu U/mL)
    bmi double precision not null check (bmi >= 0),                  -- BMI (kg/m²)
    diabetes_pedigree double precision not null check (diabetes_pedigree >= 0), -- Yếu tố gia đình
    age integer not null check (age >= 0),                           -- Tuổi
    -- Kết quả phân tích từ AI + hiệu chỉnh lâm sàng
    probability double precision not null check (probability between 0 and 1),          -- Xác suất cuối cùng
    model_probability double precision not null check (model_probability between 0 and 1), -- Xác suất từ model gốc
    clinical_probability double precision not null check (clinical_probability between 0 and 1), -- Xác suất sau hiệu chỉnh
    risk_score integer not null check (risk_score between 0 and 100), -- Điểm nguy cơ (0-100)
    risk_band text not null,       -- Mức nguy cơ (Thấp / Trung bình / Cao / Rất cao)
    certainty text not null,       -- Độ chắc chắn
    has_diabetes text not null,    -- Kết luận (Có nguy cơ / Không có nguy cơ)
    summary text not null,         -- Tóm tắt kết quả
    advice text not null,          -- Lời khuyên
    -- Payload gốc (lưu toàn bộ input + output để render lại detail)
    input_payload jsonb not null,
    prediction_payload jsonb not null,
    created_at timestamptz not null default now()
);

-- ================================================================
-- INDEXES — Tối ưu truy vấn
-- ================================================================

-- Tìm kiếm profile theo role
create index if not exists idx_profiles_role on public.profiles(role);
-- Tìm kiếm theo số điện thoại
create index if not exists idx_profiles_phone on public.profiles(phone);
-- Full-text search theo tên + email + phone (dùng cho admin search)
create index if not exists idx_profiles_name_email on public.profiles using gin (to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')));
-- Lấy lịch sử dự đoán theo user, sắp xếp mới nhất
create index if not exists idx_predictions_user_created on public.predictions(user_id, created_at desc);
-- Lọc theo kết luận bệnh
create index if not exists idx_predictions_disease on public.predictions(has_diabetes);

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Tự động cập nhật updated_at khi sửa profile
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- ================================================================
-- FUNCTIONS — Xử lý nghiệp vụ
-- ================================================================

-- Tự động tạo profile khi user mới đăng ký qua Supabase Auth.
-- Lấy full_name từ metadata, fallback về phần trước @ của email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    resolved_full_name text;
begin
    resolved_full_name := coalesce(
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'User'
    );

    if char_length(trim(resolved_full_name)) < 2 then
        resolved_full_name := 'User';
    end if;

    insert into public.profiles (id, email, phone, full_name, role)
    values (
        new.id,
        coalesce(new.email, ''),
        null,
        resolved_full_name,
        'user'
    )
    on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name;
    return new;
end;
$$;

-- Gắn trigger vào bảng auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Đảm bảo profile tồn tại cho user hiện tại (gọi từ frontend sau login).
-- Upsert: tạo mới nếu chưa có, cập nhật email nếu thay đổi.
create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
    current_auth_user auth.users%rowtype;
    resolved_full_name text;
    ensured_profile public.profiles;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    select * into current_auth_user
    from auth.users
    where id = auth.uid();

    if current_auth_user.id is null then
        raise exception 'Authenticated user not found';
    end if;

    resolved_full_name := coalesce(
        nullif(trim(current_auth_user.raw_user_meta_data->>'full_name'), ''),
        nullif(split_part(coalesce(current_auth_user.email, ''), '@', 1), ''),
        'User'
    );

    if char_length(trim(resolved_full_name)) < 2 then
        resolved_full_name := 'User';
    end if;

    insert into public.profiles (id, email, phone, full_name, role)
    values (
        current_auth_user.id,
        coalesce(current_auth_user.email, ''),
        null,
        resolved_full_name,
        'user'
    )
    on conflict (id) do update
    set email = excluded.email,
        phone = coalesce(public.profiles.phone, excluded.phone),
        full_name = case
            when public.profiles.full_name is null or char_length(trim(public.profiles.full_name)) < 2
                then excluded.full_name
            else public.profiles.full_name
        end
    returning * into ensured_profile;

    return ensured_profile;
end;
$$;

-- Kiểm tra user hiện tại có phải admin không.
-- Dùng bởi các function khác và RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    );
$$;

-- User tự cập nhật profile (tên, SĐT).
-- Không cho phép đổi role.
create or replace function public.update_my_profile(new_full_name text, new_phone text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
    updated_profile public.profiles;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;
    if new_full_name is null or char_length(trim(new_full_name)) < 2 then
        raise exception 'Full name must contain at least 2 characters';
    end if;

    update public.profiles
    set full_name = trim(new_full_name),
        phone = new_phone
    where id = auth.uid()
    returning * into updated_profile;

    return updated_profile;
end;
$$;

-- Admin cập nhật profile của bất kỳ user nào (tên, role, SĐT).
-- Chỉ admin mới được gọi.
create or replace function public.admin_update_profile(target_user_id uuid, new_full_name text, new_role text, new_phone text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
    updated_profile public.profiles;
begin
    if not public.is_admin() then
        raise exception 'Admin role required';
    end if;
    if new_role not in ('user', 'admin') then
        raise exception 'Invalid role';
    end if;
    if new_full_name is null or char_length(trim(new_full_name)) < 2 then
        raise exception 'Full name must contain at least 2 characters';
    end if;

    update public.profiles
    set full_name = trim(new_full_name),
        role = new_role,
        phone = new_phone
    where id = target_user_id
    returning * into updated_profile;

    return updated_profile;
end;
$$;

-- Lưu kết quả dự đoán mới.
-- Tách 8 chỉ số từ input_payload JSONB + kết quả từ prediction_payload.
-- Frontend gọi sau khi nhận response từ /api/predict.
create or replace function public.create_prediction(input_payload jsonb, prediction_payload jsonb)
returns public.predictions
language plpgsql
security definer
set search_path = public
as $$
declare
    created_prediction public.predictions;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    insert into public.predictions (
        user_id,
        pregnancies,
        glucose,
        blood_pressure,
        skin_thickness,
        insulin,
        bmi,
        diabetes_pedigree,
        age,
        probability,
        model_probability,
        clinical_probability,
        risk_score,
        risk_band,
        certainty,
        has_diabetes,
        summary,
        advice,
        input_payload,
        prediction_payload
    )
    values (
        auth.uid(),
        (input_payload->>'Pregnancies')::integer,
        (input_payload->>'Glucose')::double precision,
        (input_payload->>'BloodPressure')::double precision,
        (input_payload->>'SkinThickness')::double precision,
        (input_payload->>'Insulin')::double precision,
        (input_payload->>'BMI')::double precision,
        (input_payload->>'DiabetesPedigreeFunction')::double precision,
        (input_payload->>'Age')::integer,
        (prediction_payload->>'probability')::double precision,
        (prediction_payload->>'model_probability')::double precision,
        (prediction_payload->>'clinical_probability')::double precision,
        (prediction_payload->>'risk_score')::integer,
        prediction_payload->>'risk_band',
        prediction_payload->>'certainty',
        prediction_payload->>'has_diabetes',
        prediction_payload->>'summary',
        prediction_payload->>'advice',
        input_payload,
        prediction_payload
    )
    returning * into created_prediction;

    return created_prediction;
end;
$$;

-- Lấy lịch sử dự đoán.
-- User thường chỉ xem được lịch sử của mình.
-- Admin có thể xem lịch sử của bất kỳ user nào (truyền target_user_id).
create or replace function public.get_prediction_history(target_user_id uuid default null, row_limit integer default 50)
returns table (
    id bigint,
    user_id uuid,
    glucose double precision,
    bmi double precision,
    age integer,
    probability double precision,
    risk_band text,
    risk_score integer,
    has_diabetes text,
    created_at timestamptz,
    input_payload jsonb,
    prediction_payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
    resolved_user_id uuid := coalesce(target_user_id, auth.uid());
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;
    -- User thường không được xem lịch sử người khác
    if resolved_user_id <> auth.uid() and not public.is_admin() then
        raise exception 'Admin role required';
    end if;

    return query
    select
        p.id,
        p.user_id,
        p.glucose,
        p.bmi,
        p.age,
        p.probability,
        p.risk_band,
        p.risk_score,
        p.has_diabetes,
        p.created_at,
        p.input_payload,
        p.prediction_payload
    from public.predictions p
    where p.user_id = resolved_user_id
    order by p.created_at desc, p.id desc
    limit greatest(1, least(coalesce(row_limit, 50), 1000));
end;
$$;

-- Admin tìm kiếm danh sách user.
-- Hỗ trợ lọc theo tên/email/SĐT và theo tình trạng bệnh.
-- Kèm thông tin dự đoán gần nhất (lateral join).
create or replace function public.admin_search_profiles(search_text text default '', disease_filter text default null)
returns table (
    id uuid,
    email text,
    phone text,
    full_name text,
    role text,
    created_at timestamptz,
    latest_has_diabetes text,
    latest_probability double precision,
    latest_prediction_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'Admin role required';
    end if;

    return query
    select
        pr.id,
        pr.email,
        pr.phone,
        pr.full_name,
        pr.role,
        pr.created_at,
        latest.has_diabetes,
        latest.probability,
        latest.created_at
    from public.profiles pr
    left join lateral (
        select p.has_diabetes, p.probability, p.created_at
        from public.predictions p
        where p.user_id = pr.id
        order by p.created_at desc, p.id desc
        limit 1
    ) latest on true
    where (
        coalesce(search_text, '') = ''
        or pr.full_name ilike '%' || search_text || '%'
        or pr.email ilike '%' || search_text || '%'
        or pr.phone ilike '%' || search_text || '%'
    )
    and (
        disease_filter is null
        or disease_filter = ''
        or (disease_filter = 'diabetes' and coalesce(latest.probability, 0) >= 0.35)
        or (disease_filter = 'normal' and coalesce(latest.probability, 0) < 0.35)
    )
    order by pr.created_at desc;
end;
$$;

-- ================================================================
-- ROW LEVEL SECURITY (RLS) — Bảo mật cấp hàng
-- ================================================================

alter table public.profiles enable row level security;
alter table public.predictions enable row level security;

-- Profiles: user chỉ xem được profile mình, admin xem tất cả
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

-- Profiles: user chỉ sửa được profile mình, admin sửa tất cả
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Predictions: user chỉ xem được dự đoán mình, admin xem tất cả
drop policy if exists "predictions self select admin all" on public.predictions;
create policy "predictions self select admin all"
on public.predictions for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Predictions: user chỉ được tạo dự đoán cho mình
drop policy if exists "predictions insert own" on public.predictions;
create policy "predictions insert own"
on public.predictions for insert
to authenticated
with check (user_id = auth.uid());

-- ================================================================
-- PHÂN QUYỀN — Grant cho authenticated role
-- ================================================================

revoke all on public.profiles from anon;
revoke all on public.predictions from anon;
-- Cho phép user đọc + sửa profile, đọc + tạo prediction
grant select, update on public.profiles to authenticated;
grant select, insert on public.predictions to authenticated;
-- Cho phép gọi các RPC functions
grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text) to authenticated;
grant execute on function public.create_prediction(jsonb, jsonb) to authenticated;
grant execute on function public.get_prediction_history(uuid, integer) to authenticated;
grant execute on function public.admin_search_profiles(text, text) to authenticated;