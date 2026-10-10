"""
migrate_add_edge_annotations.py — Stage 1 (UAT fix)

Adds two nullable annotation columns to the `edges` table:
  - note            TEXT     DEFAULT NULL  (Wi-Fi note icon content)
  - router_enabled  INTEGER  DEFAULT 0     (▣ router marker flag; 0=off, 1=on)

SQLite-safe: uses ALTER TABLE ... ADD COLUMN (no drop/recreate).
Existing data is fully preserved.

Run from backend/ directory:
  python migrate_add_edge_annotations.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "neurotree.db")

COLUMNS = [
    # (column_name, column_type, default_clause_or_None)
    ("note",           "TEXT",    None),
    ("router_enabled", "INTEGER", "0"),
]


def main():
    if not os.path.exists(DB_PATH):
        print(f"[migrate] DB not found at {DB_PATH} — skipping (will be created fresh by uvicorn).")
        return

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    # Get existing columns on edges table
    cur.execute("PRAGMA table_info(edges)")
    existing = {row[1] for row in cur.fetchall()}

    added = []
    for col_name, col_type, default_val in COLUMNS:
        if col_name in existing:
            print(f"[migrate] Column 'edges.{col_name}' already exists — skipping.")
            continue
        if default_val is not None:
            sql = f"ALTER TABLE edges ADD COLUMN {col_name} {col_type} DEFAULT {default_val}"
        else:
            sql = f"ALTER TABLE edges ADD COLUMN {col_name} {col_type}"
        cur.execute(sql)
        added.append(col_name)
        print(f"[migrate] Added column 'edges.{col_name}' ({col_type}).")

    conn.commit()
    conn.close()

    if added:
        print(f"[migrate] Done. Added {len(added)} column(s): {', '.join(added)}")
    else:
        print("[migrate] No columns added (all already present).")


if __name__ == "__main__":
    main()
