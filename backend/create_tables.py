from app.database import Base, engine
from app.models import check as _check_models
from app.config import get_settings


settings = get_settings()

print(f"Creating tables in {settings.database_backend}...")
Base.metadata.create_all(bind=engine)
print("Done. Table 'prediction_history' is ready.")
