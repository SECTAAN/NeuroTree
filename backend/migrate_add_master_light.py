"""
migrate_add_master_light.py — M-5 migration

Adds Master Light columns to the nodes table if they don't already exist:
  - node_type              VARCHAR(16) DEFAULT 'knowledge'
  - master_light_unlocked  BOOLEAN     DEFAULT 0
  - master_light_mastery   FLOAT       DEFAULT 0.0
  - ml_session_scores      JSON        DEFAULT '[]'
  - ml_last_question       TEXT        DEFAULT ''
  - ml_last_expected_answer TEXT       DEFAULT NULL

SQLite-safe: uses ALTER TABLE ... ADD COLUMN (no drop/recreate needed).
Run from backend/ directory:
  python migrate_add_master_light.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "neurotree.db")

COLUMNS = [
    ("node_type",               "VARCHAR(16)",  "'knowledge'"),
    ("master_light_unlocked",   "INTEGER",      "0"),
    ("master_light_mastery",    "REAL",         "0.0"),
    ("ml_session_scores",       "TEXT",         "'[]'"),
    ("ml_last_question",        "TEXT",         "''"),
    ("ml_last_expected_answer", "TEXT",         "NULL"),
]


def main():
    if not os.path.exists(DB_PATH):
        print(f"[migrate] DB not found at {DB_PATH} — skipping (will be created fresh by uvicorn).")
        return

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    # Get existing columns
    cur.execute("PRAGMA table_info(nodes)")
    existing = {row[1] for row in cur.fetchall()}

    added = []
    for col_name, col_type, col_default in COLUMNS:
        if col_name in existing:
            print(f"[migrate] Column '{col_name}' already exists — skipping.")
            continue
        default_clause = f"DEFAULT {col_default}" if col_default != "NULL" else ""
        sql = f"ALTER TABLE nodes ADD COLUMN {col_name} {col_type} {default_clause}".strip()
        cur.execute(sql)
        added.append(col_name)
        print(f"[migrate] Added column '{col_name}' ({col_type}).")

    conn.commit()
    conn.close()

    if added:
        print(f"[migrate] Done. Added {len(added)} column(s): {', '.join(added)}")
    else:
        print("[migrate] No columns added (all already present).")


if __name__ == "__main__":
    main()
