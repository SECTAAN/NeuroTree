"""
Migration: add revealed_depth column to sessions table.

Safe to run multiple times (idempotent).
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "neurotree.db")


def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Check if column already exists
    cur.execute("PRAGMA table_info(sessions)")
    cols = [row[1] for row in cur.fetchall()]
    if "revealed_depth" in cols:
        print("revealed_depth column already exists — nothing to do.")
        conn.close()
        return

    cur.execute("ALTER TABLE sessions ADD COLUMN revealed_depth INTEGER NOT NULL DEFAULT 0")
    conn.commit()
    print("revealed_depth column added to sessions table.")
    conn.close()


if __name__ == "__main__":
    migrate()
