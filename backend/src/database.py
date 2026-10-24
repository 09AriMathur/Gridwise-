"""SQLite for carbon-intensity history and text-message reminders.

The API key only returns the last 24 hours, so every fetch is saved here;
after a week of the backend running there's a week to replay. Reminders
are stored so texts go out even when no browser is open. Scheduled tasks
themselves still live in the browser.
"""

import os
import sqlite3

DB_PATH = os.getenv("GRIDWISE_DB", "gridwise.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS history (
                zone TEXT NOT NULL,
                datetime TEXT NOT NULL,
                carbon_intensity REAL NOT NULL,
                PRIMARY KEY (zone, datetime)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                kind TEXT NOT NULL,             -- "on" or "off"
                phone TEXT NOT NULL,
                send_at TEXT NOT NULL,          -- ISO UTC, Z suffix
                body TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, failed, cancelled, skipped
                error TEXT,
                sent_at TEXT,
                UNIQUE (task_id, kind)
            )
            """
        )


def save_history(zone: str, rows: list[dict]) -> int:
    """Upsert hourly readings ({"datetime", "carbonIntensity"}); returns how many were written."""
    init_db()
    with get_connection() as conn:
        conn.executemany(
            "INSERT INTO history (zone, datetime, carbon_intensity) VALUES (?, ?, ?) "
            "ON CONFLICT(zone, datetime) DO UPDATE SET carbon_intensity = excluded.carbon_intensity",
            [(zone, row["datetime"], row["carbonIntensity"]) for row in rows],
        )
    return len(rows)


def load_history(zone: str, since: str) -> list[dict]:
    """Stored readings at or after `since` (ISO, Z suffix), oldest first."""
    init_db()
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT datetime, carbon_intensity FROM history WHERE zone = ? AND datetime >= ? ORDER BY datetime",
            (zone, since),
        )
        return [{"datetime": row["datetime"], "carbonIntensity": row["carbon_intensity"]} for row in cursor]


def days_covered(zone: str) -> int:
    """How many distinct UTC dates have any stored reading."""
    init_db()
    with get_connection() as conn:
        row = conn.execute("SELECT COUNT(DISTINCT substr(datetime, 1, 10)) FROM history WHERE zone = ?", (zone,)).fetchone()
        return int(row[0] or 0)


def add_reminders(rows: list[dict]) -> None:
    """Store reminders ({task_id, kind, phone, send_at, body}); re-adding a task's reminder replaces it."""
    init_db()
    with get_connection() as conn:
        conn.executemany(
            "INSERT INTO reminders (task_id, kind, phone, send_at, body) VALUES (:task_id, :kind, :phone, :send_at, :body) "
            "ON CONFLICT(task_id, kind) DO UPDATE SET phone = excluded.phone, send_at = excluded.send_at, "
            "body = excluded.body, status = 'pending', error = NULL, sent_at = NULL",
            rows,
        )


def due_reminders(now: str) -> list[dict]:
    """Pending reminders whose time has come, oldest first."""
    init_db()
    with get_connection() as conn:
        cursor = conn.execute("SELECT * FROM reminders WHERE status = 'pending' AND send_at <= ? ORDER BY send_at", (now,))
        return [dict(row) for row in cursor]


def mark_reminder(reminder_id: int, status: str, error: str | None = None, sent_at: str | None = None) -> None:
    init_db()
    with get_connection() as conn:
        conn.execute("UPDATE reminders SET status = ?, error = ?, sent_at = ? WHERE id = ?", (status, error, sent_at, reminder_id))


def cancel_reminders(task_id: str, kinds: tuple[str, ...] = ("on", "off")) -> int:
    """Cancel a task's pending reminders; returns how many were cancelled."""
    init_db()
    with get_connection() as conn:
        marks = ",".join("?" for _ in kinds)
        cursor = conn.execute(
            f"UPDATE reminders SET status = 'cancelled' WHERE task_id = ? AND status = 'pending' AND kind IN ({marks})",
            (task_id, *kinds),
        )
        return cursor.rowcount


def reminders_for(task_id: str) -> list[dict]:
    init_db()
    with get_connection() as conn:
        cursor = conn.execute("SELECT id, task_id, kind, send_at, status, error, sent_at FROM reminders WHERE task_id = ? ORDER BY send_at", (task_id,))
        return [dict(row) for row in cursor]
