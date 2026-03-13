from fastapi import FastAPI
from app.api.routes import router  # sẽ tạo sau

app = FastAPI(
    title="Diabetes Prediction API",
    description="API dự đoán nguy cơ tiểu đường dựa trên chỉ số sức khỏe",
    version="1.0.0"
)

# Gắn các router (sau này thêm /history, /health...)
app.include_router(router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Welcome to Diabetes Prediction Web App API"}