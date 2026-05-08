import asyncio
from typing import AsyncGenerator

class SSEManager:
    def __init__(self):
        self._queues: set[asyncio.Queue] = set()

    async def subscribe(self):
        q = asyncio.Queue(maxsize=20)
        self._queues.add(q)
        try:
            while True:
                try:
                    message = await asyncio.wait_for(q.get(), timeout=20)
                    yield message
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            self._queues.discard(q)
    async def broadcast(self, event: str, data: str):
        message = f"event: {event}\ndata: {data}\n\n"
        dead = []
        for q in self._queues:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._queues.discard(q)

    @property
    def connection_count(self) -> int: 
        return len(self._queues)

_sse_manager: SSEManager | None = None

def get_sse_manager() -> SSEManager:
    global _sse_manager
    if _sse_manager is None:
        _sse_manager = SSEManager()
    return _sse_manager