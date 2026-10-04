"""
migrate_add_user_id.py — one-shot safe migration for multi-session support.

What it does:
  1. Adds `user_id` column to `sessions` table (VARCHAR 36, default '').
  2. Backfills every existing row: user_id = uuid
     (the existing session UUID becomes both the session ID and the user ID,
      preserving ownership of all existing trees).
  3. Creates an index on user_id for fast per-user session lookups.

Safe to run multiple times — checks for column existence before ALTER TABLE.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "neurotree.db")


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"[migrate] No DB found at {DB_PATH} — nothing to do (fresh start).")
        return

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    # ── 1. Check if user_id already exists ───────────────────────────────────
    cur.execute("PRAGMA table_info(sessions)")
    cols = [row[1] for row in cur.fetchall()]
    if "user_id" in cols:
        print("[migrate] user_id column already exists — skipping ALTER TABLE.")
    else:
        print("[migrate] Adding user_id column to sessions...")
        cur.execute(
            "ALTER TABLE sessions ADD COLUMN user_id VARCHAR(36) NOT NULL DEFAULT ''"
        )
        print("[migrate] Column added.")

    # ── 2. Backfill: set user_id = uuid where user_id is empty ───────────────
    cur.execute("SELECT COUNT(*) FROM sessions WHERE user_id = ''")
    (unfilled,) = cur.fetchone()
    if unfilled:
        print(f"[migrate] Backfilling user_id for {unfilled} existing session(s)...")
        cur.execute("UPDATE sessions SET user_id = uuid WHERE user_id = ''")
        print(f"[migrate] Backfilled {cur.rowcount} row(s).")
    else:
        print("[migrate] All rows already have user_id — no backfill needed.")

    # ── 3. Create index if not already present ────────────────────────────────
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='ix_sessions_user_id'"
    )
    if not cur.fetchone():
        print("[migrate] Creating index on sessions.user_id...")
        cur.execute(
            "CREATE INDEX ix_sessions_user_id ON sessions (user_id)"
        )
        print("[migrate] Index created.")
    else:
        print("[migrate] Index ix_sessions_user_id already exists.")

    con.commit()
    con.close()
    print("[migrate] Migration complete.")


if __name__ == "__main__":
    migrate()
