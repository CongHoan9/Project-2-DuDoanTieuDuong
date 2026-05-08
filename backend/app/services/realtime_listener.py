import asyncio
import json
import logging
from typing import Any
from realtime import AsyncRealtimeClient
from app.config import get_settings
from app.services.sse_manager import get_sse_manager

logger = logging.getLogger(__name__)
def _handle_task_result(task: asyncio.Task) -> None:
    """Bắt lỗi task broadcast để tránh silent failure."""
    try:
        task.result()
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("SSE Broadcast task failed")
async def start_supabase_listener():
    logger.info("🚀 start_supabase_listener() đã được gọi")
    settings = get_settings()
    logger.info(f"🔌 Supabase URL: {settings.supabase_url}")
    settings = get_settings()
    sse = get_sse_manager()
    realtime_url = settings.supabase_url.replace("https://", "wss://") + "/realtime/v1"
    reconnect_delay = 1
    running_tasks: set[asyncio.Task] = set()
    while True:
        client = None
        try:
            client = AsyncRealtimeClient(realtime_url, settings.supabase_key)
            await client.connect()
            # Lắng nghe đúng bảng prediction_history
            channel = client.channel("db-changes")
            def handle_payload(payload: dict[str, Any]):
                # Chỉ quan tâm đến record mới (new)
                new_data = payload.get("new")
                if not new_data: return
                safe_payload = {
                    "action": "INSERT",
                    "table": "prediction_history",
                    "data": new_data
                }
                try:
                    # default=str xử lý UUID, Datetime nếu có
                    message_str = json.dumps(safe_payload, default=str)
                except Exception:
                    logger.error("JSON Serialize failed")
                    return
                # Tạo task broadcast an toàn
                task = asyncio.create_task(sse.broadcast("history_update", message_str))
                running_tasks.add(task)
                task.add_done_callback(running_tasks.discard)
                task.add_done_callback(_handle_task_result)
            await (
                channel
                .on_postgres_changes("INSERT", schema="public", table="prediction_history", callback=handle_payload)
                .subscribe()
            )
            logger.info("Supabase Realtime connected to 'prediction_history'")
            reconnect_delay = 1 
            await client.listen()
        except Exception as e:
            logger.error(f"Realtime Error: {e}")
        finally:
            if client: await client.close()
            for t in running_tasks: t.cancel()
            running_tasks.clear()
            await asyncio.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, 60)
