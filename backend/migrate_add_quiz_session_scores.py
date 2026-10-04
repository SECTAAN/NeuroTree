"""
migrate_add_quiz_session_scores.py — F-7A: add quiz_session_scores column to nodes.

What it does:
  1. Adds `quiz_session_scores` TEXT column to the `nodes` table (default '[]').
  2. Backfills all existing rows to '[]' (empty list — no in-flight session data).
  3. Safe to run multiple times — checks for column existence before ALTER TABLE.

The column stores a JSON-serialised list of raw NT-03 scores accumulated during
one 3-question quiz session.  It is reset to [] at the start of each new session
and is never exposed to the frontend.
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

    # ── 1. Check if quiz_session_scores already exists ────────────────────────
    cur.execute("PRAGMA table_info(nodes)")
    cols = [row[1] for row in cur.fetchall()]
    if "quiz_session_scores" in cols:
        print("[migrate] quiz_session_scores column already exists — skipping ALTER TABLE.")
    else:
        print("[migrate] Adding quiz_session_scores column to nodes...")
        cur.execute(
            "ALTER TABLE nodes ADD COLUMN quiz_session_scores TEXT NOT NULL DEFAULT '[]'"
        )
        print("[migrate] Column added.")

    # ── 2. Backfill: normalise any NULL values to '[]' ────────────────────────
    cur.execute("SELECT COUNT(*) FROM nodes WHERE quiz_session_scores IS NULL OR quiz_session_scores = ''")
    (unfilled,) = cur.fetchone()
    if unfilled:
        print(f"[migrate] Normalising {unfilled} node(s) with NULL/empty quiz_session_scores to '[]'...")
        cur.execute("UPDATE nodes SET quiz_session_scores = '[]' WHERE quiz_session_scores IS NULL OR quiz_session_scores = ''")
        print(f"[migrate] Normalised {cur.rowcount} row(s).")
    else:
        print("[migrate] All nodes already have quiz_session_scores set — no backfill needed.")

    con.commit()
    con.close()
    print("[migrate] Migration complete.")


if __name__ == "__main__":
    migrate()
