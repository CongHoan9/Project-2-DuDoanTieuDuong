from pydantic import BaseModel
from datetime import datetime

class CheckHistoryResponse(BaseModel):
    id: int
    pregnancies: int
    glucose: float
    blood_pressure: float
    skin_thickness: float
    insulin: float
    bmi: float
    diabetes_pedigree: float
    age: int
    probability: float
    has_diabetes: str
    advice: str
    created_at: datetime

    class Config:
        from_attributes = True