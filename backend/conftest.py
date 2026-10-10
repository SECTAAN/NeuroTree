"""
conftest.py — backend test configuration.

Handles the case where multiple test files each patch os.environ before
importing app.main, but app.core.config.get_settings() uses @lru_cache and
app.db.database creates its engine at import time.

When test files are collected together in a single pytest session:
  1. The first file's env patch wins for get_settings() (lru_cache hit).
  2. Subsequent files' DATABASE_URL patches are ignored by SQLAlchemy
     (engine already created).

Fix: each test module that needs its own DB overrides the SQLAlchemy engine
directly inside the module after patching os.environ.  This conftest provides
a helper that test modules can call via autouse fixture if needed.

No external dependencies required.
"""
