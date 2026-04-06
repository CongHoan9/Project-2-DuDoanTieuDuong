# Diabetes Prediction Webapp

Cach don gian nhat va on nhat cho project nay:

- 1 Render Web Service duy nhat
- FastAPI serve ca frontend va API
- Khong can ngrok
- Khong can frontend static site rieng

Kien truc sau khi doi:

`Render Web Service (FastAPI + frontend) -> /api -> model -> Supabase free (neu can luu lich su online)`

## Ban chi can sua gi

Neu muon app chay ngay tren Render:

1. Khong can sua URL backend
2. Khong can sua URL frontend
3. Chi can thay 2 bien Supabase neu muon luu lich su online

Can thay trong [backend/.env](/C:/Users/84352/Desktop/diabetes-prediction-webapp/backend/.env) hoac tren Render env vars:

- `SUPABASE_URL=https://URL_CUA_SUPABASE_PROJECT`
- `SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_CUA_SUPABASE`

Neu khong thay 2 bien nay, app van chay, nhung lich su se chi luu tam bang SQLite trong Render va co the mat sau khi redeploy.

## Deploy len Render

Repo da co san [render.yaml](/C:/Users/84352/Desktop/diabetes-prediction-webapp/render.yaml) cho 1 web service Python duy nhat.

Thong so chinh:

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check: `/api/health`

Sau khi deploy xong:

- Giao dien o: `https://URL_CUA_RENDER_APP`
- API health o: `https://URL_CUA_RENDER_APP/api/health`
- API predict o: `https://URL_CUA_RENDER_APP/api/predict`
- API history o: `https://URL_CUA_RENDER_APP/api/history`
- Swagger docs o: `https://URL_CUA_RENDER_APP/docs`

## Frontend da doi the nao

Frontend da co dinh goi `/api` tren cung web service.

Mac dinh:

- Khong con `config.js` rieng cho API
- Khong con tab `Service`
- Giao dien va API dung cung domain khi chay tren Render
- Browser khong ket noi truc tiep database; FastAPI van la lop an toan de goi model va luu lich su

## Backend da doi the nao

- [backend/main.py](/C:/Users/84352/Desktop/diabetes-prediction-webapp/backend/main.py) gio serve ca thu muc `frontend/`
- API van giu prefix `/api`
- [backend/app/api/routes.py](/C:/Users/84352/Desktop/diabetes-prediction-webapp/backend/app/api/routes.py) van giu cac route cu
- [backend/app/services/history_store.py](/C:/Users/84352/Desktop/diabetes-prediction-webapp/backend/app/services/history_store.py) van ho tro Supabase free va fallback SQLite

## Train lai model

Neu ban train lai local:

```powershell
cd backend
pip install -r requirements.txt
python scripts\train_diabetes_model.py
```

Script se cap nhat:

- `backend/assets/diabetes_model.pkl`
- `backend/assets/imputer_median.pkl`
- `backend/assets/scaler.pkl`
- `backend/assets/reference_stats.json`

Sau do push len repo va redeploy Render service.

## Supabase free

Neu muon luu lich su online:

1. Tao project Supabase free
2. Chay file [backend/sql/supabase_history.sql](/C:/Users/84352/Desktop/diabetes-prediction-webapp/backend/sql/supabase_history.sql)
3. Dien `SUPABASE_URL`
4. Dien `SUPABASE_SERVICE_ROLE_KEY`

Mac dinh env trong [backend/.env.example](/C:/Users/84352/Desktop/diabetes-prediction-webapp/backend/.env.example):

```env
CORS_ALLOW_ORIGINS=*
HISTORY_BACKEND=supabase
SUPABASE_URL=https://URL_CUA_SUPABASE_PROJECT
SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_CUA_SUPABASE
SUPABASE_TABLE=prediction_history
```

## Ghi chu

- Deploi theo kieu 1 web service nay la phuong an khuyen dung cho ban
- Don gian hon mo hinh `frontend static + backend rieng + ngrok`
- It loi CORS hon
- Khong can doi URL moi sau moi lan chay
