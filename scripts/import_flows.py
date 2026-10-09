#!/usr/bin/env python3
"""
import_flows.py — Import semua Langflow flows dari folder langflow_flows/

Jalankan di mesin teman setelah Langflow sudah berjalan:
    python scripts/import_flows.py

Output:
    - Setiap flow di-import ke Langflow
    - File backend/.env diperbarui otomatis dengan Flow ID baru
    - Jika .env belum ada, dibuat dari .env.example

Butuh:
    pip install requests
    Langflow berjalan di localhost:7860
"""

import os
import sys
import json
import pathlib
import re

try:
    import requests
except ImportError:
    sys.exit("❌  Jalankan dulu: pip install requests")

ROOT      = pathlib.Path(__file__).parent.parent
FLOWS_DIR = ROOT / "langflow_flows"
ENV_PATH  = ROOT / "backend" / ".env"
EXAMPLE   = ROOT / "backend" / ".env.example"

# ── Baca / buat .env ─────────────────────────────────────────────────────────
def read_env(path: pathlib.Path) -> dict:
    env = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

def write_env(path: pathlib.Path, env: dict):
    """Tulis ulang .env dari dict, pertahankan komentar dari .env.example."""
    # Mulai dari .example supaya komentar tetap ada
    if EXAMPLE.exists():
        lines = EXAMPLE.read_text(encoding="utf-8").splitlines()
    else:
        lines = [f"{k}={v}" for k, v in env.items()]

    result = []
    written = set()
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#") or not stripped:
            result.append(line)
            continue
        k = stripped.split("=", 1)[0].strip()
        if k in env:
            result.append(f"{k}={env[k]}")
            written.add(k)
        else:
            result.append(line)

    # Tambahkan key yang tidak ada di template
    for k, v in env.items():
        if k not in written:
            result.append(f"{k}={v}")

    path.write_text("\n".join(result) + "\n", encoding="utf-8")

# ── Inisialisasi env ──────────────────────────────────────────────────────────
if not ENV_PATH.exists() and EXAMPLE.exists():
    import shutil
    shutil.copy(EXAMPLE, ENV_PATH)
    print("📄  .env dibuat dari .env.example — isi LANGFLOW_API_KEY jika diperlukan\n")

cfg = read_env(ENV_PATH)

BASE_URL = os.getenv("LANGFLOW_BASE_URL", cfg.get("LANGFLOW_BASE_URL", "http://localhost:7860"))
API_KEY  = os.getenv("LANGFLOW_API_KEY",  cfg.get("LANGFLOW_API_KEY",  ""))

headers = {"Content-Type": "application/json"}
if API_KEY and API_KEY not in ("your-langflow-api-key-here", ""):
    headers["x-api-key"] = API_KEY

FLOW_ENV_KEYS = {
    "NT-01": "LANGFLOW_FLOW_NT01",
    "NT-02": "LANGFLOW_FLOW_NT02",
    "NT-03": "LANGFLOW_FLOW_NT03",
    "NT-04": "LANGFLOW_FLOW_NT04",
    "NT-05": "LANGFLOW_FLOW_NT05",
}

print(f"\n🔌  Connecting to Langflow at {BASE_URL} …\n")

# Health check
try:
    r = requests.get(f"{BASE_URL}/health", timeout=5)
    r.raise_for_status()
except Exception as e:
    sys.exit(f"❌  Langflow tidak bisa dijangkau: {e}\n   Pastikan Langflow sudah berjalan (langflow run).")

# Cek folder flows ada
if not FLOWS_DIR.exists() or not any(FLOWS_DIR.glob("NT-*.json")):
    sys.exit(
        "❌  Folder langflow_flows/ tidak ditemukan atau kosong.\n"
        "   Minta file NT-01.json … NT-05.json dari temanmu dan taruh di langflow_flows/"
    )

ok = 0
new_ids = dict(cfg)  # copy existing env

for name, env_key in FLOW_ENV_KEYS.items():
    flow_file = FLOWS_DIR / f"{name}.json"
    if not flow_file.exists():
        print(f"  ⚠️   {name}.json tidak ditemukan — skip")
        continue

    flow_data = json.loads(flow_file.read_text(encoding="utf-8"))

    # Hapus id lama supaya Langflow generate UUID baru
    flow_data.pop("id", None)
    if "data" in flow_data:
        flow_data["data"].pop("id", None)

    try:
        r = requests.post(
            f"{BASE_URL}/api/v1/flows/",
            headers=headers,
            json=flow_data,
            timeout=30,
        )
        r.raise_for_status()
    except requests.HTTPError as e:
        print(f"  ❌  {name}: HTTP {e.response.status_code} — {e.response.text[:120]}")
        continue
    except Exception as e:
        print(f"  ❌  {name}: {e}")
        continue

    new_flow_id = r.json().get("id", "")
    new_ids[env_key] = new_flow_id
    print(f"  ✅  {name} → {new_flow_id}")
    ok += 1

# Simpan Flow IDs baru ke .env
write_env(ENV_PATH, new_ids)

print(f"\n{'✅  Selesai' if ok == 5 else '⚠️   Selesai dengan peringatan'}: {ok}/5 flows di-import")
print(f"   Flow IDs otomatis disimpan ke backend/.env\n")

if ok == 5:
    print("   Langkah selanjutnya:")
    print("   1. Isi LANGFLOW_API_KEY di backend/.env (jika Langflow-mu pakai auth)")
    print("   2. Jalankan: scripts\\dev.ps1  (Windows)  atau  bash scripts/dev.sh  (Mac/Linux)\n")
