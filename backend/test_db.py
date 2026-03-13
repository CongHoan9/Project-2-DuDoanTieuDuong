# backend/test_db.py
import sqlite3

conn = sqlite3.connect('diabetes_checks.db')
cursor = conn.cursor()

# Kiểm tra bảng tồn tại
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='check_history';")
table_exists = cursor.fetchone()
print("Bảng check_history tồn tại:", bool(table_exists))

# Xem cấu trúc bảng
cursor.execute("PRAGMA table_info('check_history');")
columns = cursor.fetchall()
print("\nCột trong bảng:")
for col in columns:
    print(col)

conn.close()