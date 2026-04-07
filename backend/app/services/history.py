from app.schemas.prediction import PredictionOutput
from app.services.history_store import get_history_store


def create_check(input_data: dict, result: PredictionOutput):
    return get_history_store().create_check(input_data, result)


def get_recent_checks(limit: int = 10):
    return get_history_store().get_recent_checks(limit)


def get_check_detail(check_id: int):
    return get_history_store().get_check(check_id)
