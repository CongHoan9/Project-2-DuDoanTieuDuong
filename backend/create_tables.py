# backend/create_tables.py
# Import các model để Base biết có bảng nào cần tạo
from app.database import Base, engine
from app.models import check  # <-- quan trọng: import để SQLAlchemy nhận diện model CheckHistory

print("Đang tạo bảng trong database...")

# Tạo tất cả bảng định nghĩa trong models
Base.metadata.create_all(bind=engine)

print("Hoàn tất! Bảng 'check_history' đã được tạo (hoặc đã tồn tại).")
print("File database: diabetes_checks.db nằm trong thư mục backend/")