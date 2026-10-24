"""SQLite, only if you need it.

Nothing else imports this yet. Wire it up only when you actually want
scheduled tasks to survive a restart.
"""

import sqlite3

DB_PATH = "gridwise.db"


def get_connection() -> sqlite3.Connection:
    raise NotImplementedError


def init_db() -> None:
    """Create tables if they don't exist."""
    raise NotImplementedError
