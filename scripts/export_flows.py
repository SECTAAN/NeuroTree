#!/usr/bin/env python3
"""
export_flows.py — Export semua Langflow flows NeuroTree ke folder langflow_flows/

Jalankan SATU KALI sebelum serah terima ke teman:
    python scripts/export_flows.py

Output: langflow_flows/NT-01.json ... NT-05.json

Butuh:
    pip install requests
    Langflow harus berjalan di localhost:7860
    LANGFLOW_API_KEY di backend/.env (atau lewat env var LANGFLOW_API_KEY)
"""

import os
import sys
import json
import pathlib

try:
    import requests
except ImportError:
    sys.exit("❌  Jalankan dulu: pip install requests")

# ── Baca config dari .env kalau ada ──────────────────────────────────────────
def _read_env():
    env = {}
    env_path = pathlib.Path(__file__).parent.parent / "backend" / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

cfg = _read_env()

BASE_URL   = os.getenv("LANGFLOW_BASE_URL",  cfg.get("LANGFLOW_BASE_URL",  "http://localhost:7860"))
API_KEY    = os.getenv("LANGFLOW_API_KEY",   cfg.get("LANGFLOW_API_KEY",   ""))

FLOW_IDS = {
    "NT-01": os.getenv("LANGFLOW_FLOW_NT01", cfg.get("LANGFLOW_FLOW_NT01", "")),
    "NT-02": os.getenv("LANGFLOW_FLOW_NT02", cfg.get("LANGFLOW_FLOW_NT02", "")),
    "NT-03": os.getenv("LANGFLOW_FLOW_NT03", cfg.get("LANGFLOW_FLOW_NT03", "")),
    "NT-04": os.getenv("LANGFLOW_FLOW_NT04", cfg.get("LANGFLOW_FLOW_NT04", "")),
    "NT-05": os.getenv("LANGFLOW_FLOW_NT05", cfg.get("LANGFLOW_FLOW_NT05", "")),
}

OUT_DIR = pathlib.Path(__file__).parent.parent / "langflow_flows"
OUT_DIR.mkdir(exist_ok=True)

headers = {"Content-Type": "application/json"}
if API_KEY and API_KEY != "your-langflow-api-key-here":
    headers["x-api-key"] = API_KEY

print(f"\n🔌  Connecting to Langflow at {BASE_URL} …\n")

# Health check
try:
    r = requests.get(f"{BASE_URL}/health", timeout=5)
    r.raise_for_status()
except Exception as e:
    sys.exit(f"❌  Langflow tidak bisa dijangkau: {e}\n   Pastikan Langflow sudah berjalan.")

ok = 0
for name, flow_id in FLOW_IDS.items():
    if not flow_id or flow_id.startswith("paste-"):
        print(f"  ⚠️   {name}: flow ID belum diisi di .env — skip")
        continue

    url = f"{BASE_URL}/api/v1/flows/{flow_id}"
    try:
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
    except requests.HTTPError as e:
        print(f"  ❌  {name} ({flow_id[:8]}…): HTTP {e.response.status_code}")
        continue
    except Exception as e:
        print(f"  ❌  {name}: {e}")
        continue

    out_file = OUT_DIR / f"{name}.json"
    out_file.write_text(json.dumps(r.json(), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  ✅  {name} → langflow_flows/{name}.json")
    ok += 1

print(f"\n{'✅  Selesai' if ok == 5 else '⚠️   Selesai dengan peringatan'}: {ok}/5 flows diekspor ke langflow_flows/\n")
if ok < 5:
    print("   Kirim folder langflow_flows/ ke temanmu beserta file .env\n")
