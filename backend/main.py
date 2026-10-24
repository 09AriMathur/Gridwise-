"""Creates the app, adds CORS, includes routes."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from datetime import datetime, timezone

from src import database, grid_api, reminders
from src.routes import router


def _save_history() -> None:
    try:
        database.save_history(grid_api.DEFAULT_ZONE, grid_api.fetch_history())
    except Exception:
        pass  # offline or no key: the app still works without history


async def _keep_history() -> None:
    # The API only gives the last 24 h, so save it every hour while the backend
    # runs; that builds up the week the savings backtest replays.
    while True:
        await asyncio.to_thread(_save_history)
        await asyncio.sleep(3600)


async def _send_reminders() -> None:
    # Text reminders are stored in SQLite; send the due ones every 30 s.
    while True:
        try:
            await asyncio.to_thread(reminders.dispatch, datetime.now(timezone.utc))
        except Exception:
            pass  # a bad row or a Twilio outage must not stop the loop
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    tasks = [asyncio.create_task(_keep_history()), asyncio.create_task(_send_reminders())]
    yield
    for task in tasks:
        task.cancel()


app = FastAPI(title="GridWise", version="0.1.0", lifespan=lifespan)

# The frontend runs on a different port, so the browser treats it as a
# different origin and blocks the request unless we allow it here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
