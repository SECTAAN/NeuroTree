"""
Live E2E integration test via FastAPI TestClient (in-process).
USE_MOCK_AI=False — all requests go to real Langflow on localhost:7860.

Run with: python test_live_e2e.py
"""
import sys
import json
import uuid

sys.path.insert(0, ".")

from fastapi.testclient import TestClient
from app.main import app

BASE = "/api/v1"
USER_ID    = str(uuid.uuid4())
SESSION_ID = str(uuid.uuid4())
HEADERS = {
    "X-User-ID":    USER_ID,
    "X-Session-ID": SESSION_ID,
}

TEXT = (
    "Jaringan komputer adalah kumpulan perangkat yang saling terhubung untuk berbagi data dan sumber daya. "
    "Topologi jaringan menentukan bagaimana perangkat terhubung: star (pusat switch), ring (lingkaran), bus (kabel tunggal). "
    "IP Address adalah alamat logis setiap perangkat. IPv4 menggunakan 32-bit, IPv6 menggunakan 128-bit. "
    "Subnet mask menentukan batas antara bagian network dan host dalam IP address. "
    "Router meneruskan paket antar jaringan berdasarkan routing table. Switch meneruskan frame berdasarkan MAC address. "
    "Model TCP/IP terdiri dari 4 layer: Application, Transport (TCP/UDP), Internet (IP), Network Access. "
    "Firewall melindungi jaringan dari akses tidak sah. VPN mengenkripsi koneksi jarak jauh untuk keamanan."
)

passed = 0
failed = 0

def ok(label, r):
    global passed, failed
    if r.status_code not in (200, 201):
        print(f"FAIL {label}: HTTP {r.status_code} — {r.text[:400]}")
        failed += 1
        return None
    print(f"PASS {label}: HTTP {r.status_code}")
    passed += 1
    return r.json()


client = TestClient(app, raise_server_exceptions=False)

# ── STEP 1: Ingest (NT-01) ────────────────────────────────────────────────────
print("--- STEP 1: Ingest (NT-01) ---")
r = client.post(f"{BASE}/material/ingest", headers=HEADERS, json={
    "source_text":   TEXT,
    "tree_name":     "Live Test Tree",
    "learning_goal": "CCNA Prep",
    "session_id":    SESSION_ID,
}, timeout=90)
ingest = ok("ingest", r)
if not ingest:
    sys.exit(1)
print(f"  nodes={ingest['nodes_created']}  edges={ingest['edges_created']}  ml_id={ingest['master_light_id']}")

# ── STEP 2: Fetch Graph ───────────────────────────────────────────────────────
print("\n--- STEP 2: Fetch Graph ---")
r = client.get(f"{BASE}/graph", headers=HEADERS)
graph = ok("graph", r)
if not graph:
    sys.exit(1)
knowledge_nodes = [n for n in graph["nodes"] if n["node_type"] == "knowledge"]
ml_nodes        = [n for n in graph["nodes"] if n["node_type"] == "master_light"]
print(f"  knowledge={len(knowledge_nodes)}  master_light={len(ml_nodes)}")
first_node = knowledge_nodes[0]
print(f"  first_node id={first_node['id']}  status={first_node['status']}")

# ── STEP 3: Generate Quiz Question (NT-02) ────────────────────────────────────
print("\n--- STEP 3: Generate Quiz Question (NT-02) ---")
r = client.post(f"{BASE}/quiz/generate", headers=HEADERS, json={"node_id": first_node["id"]}, timeout=60)
quiz_gen = ok("quiz/generate", r)
if not quiz_gen:
    sys.exit(1)
print(f"  question: {quiz_gen['question'][:90]}")

# ── STEP 4a: Evaluate Q0 ─────────────────────────────────────────────────────
print("\n--- STEP 4a: Evaluate Q0 (NT-03) ---")
r = client.post(f"{BASE}/quiz/evaluate", headers=HEADERS, json={
    "node_id":        first_node["id"],
    "user_answer":    "Jaringan komputer menghubungkan perangkat agar dapat berbagi data. Topologi star paling umum karena setiap perangkat terhubung langsung ke switch pusat sehingga mudah dikelola dan fault-tolerant.",
    "question_index": 0,
}, timeout=60)
eval0 = ok("quiz/evaluate Q0", r)
if not eval0:
    sys.exit(1)
print(f"  score={eval0['ai_score']}  is_final={eval0['is_final']}  mastery_unchanged={eval0['new_mastery_score']}")
assert eval0["is_final"] is False, "Q0 should not be final"

# ── STEP 4b: Re-generate + Evaluate Q1 ───────────────────────────────────────
print("\n--- STEP 4b: Re-generate + Evaluate Q1 ---")
r = client.post(f"{BASE}/quiz/generate", headers=HEADERS, json={"node_id": first_node["id"]}, timeout=60)
ok("quiz/generate Q1", r)
r = client.post(f"{BASE}/quiz/evaluate", headers=HEADERS, json={
    "node_id":        first_node["id"],
    "user_answer":    "IP Address adalah identitas unik perangkat di jaringan. IPv4 menggunakan 32-bit sehingga ada sekitar 4 miliar alamat, sedangkan IPv6 menggunakan 128-bit untuk mengatasi keterbatasan IPv4. Subnet mask memisahkan network ID dan host ID.",
    "question_index": 1,
}, timeout=60)
eval1 = ok("quiz/evaluate Q1", r)
if not eval1:
    sys.exit(1)
print(f"  score={eval1['ai_score']}  is_final={eval1['is_final']}")
assert eval1["is_final"] is False, "Q1 should not be final"

# ── STEP 4c: Re-generate + Evaluate Q2 (FINAL) ───────────────────────────────
print("\n--- STEP 4c: Re-generate + Evaluate Q2 (FINAL) ---")
r = client.post(f"{BASE}/quiz/generate", headers=HEADERS, json={"node_id": first_node["id"]}, timeout=60)
ok("quiz/generate Q2", r)
r = client.post(f"{BASE}/quiz/evaluate", headers=HEADERS, json={
    "node_id":        first_node["id"],
    "user_answer":    "TCP menjamin pengiriman data melalui three-way handshake: SYN, SYN-ACK, ACK. UDP lebih cepat tapi tidak menjamin urutan. Firewall memfilter traffic berdasarkan rules. Router menggunakan routing table untuk meneruskan paket ke jaringan tujuan.",
    "question_index": 2,
}, timeout=60)
eval2 = ok("quiz/evaluate Q2", r)
if not eval2:
    sys.exit(1)
print(f"  score={eval2['ai_score']}  is_final={eval2['is_final']}  final_mastery={eval2['new_mastery_score']}  unlocked={eval2['unlocked_new_nodes']}")
assert eval2["is_final"] is True, "Q2 must be final"

# ── STEP 5: Recommendation (NT-04) ────────────────────────────────────────────
print("\n--- STEP 5: Recommendation (NT-04) ---")
r = client.get(f"{BASE}/quiz/recommend", headers=HEADERS, timeout=60)
rec = ok("quiz/recommend", r)
if not rec:
    sys.exit(1)
print(f"  action={rec['action']}  target={rec['target_chunk_id']}  priority={rec['priority']}")
print(f"  progress={rec['progress_summary']}")

# ── STEP 6: Career Pathway (NT-05) ────────────────────────────────────────────
print("\n--- STEP 6: Career Pathway (NT-05) ---")
r = client.post(f"{BASE}/career/pathway", headers=HEADERS, json={"career_goal": "Network Engineer"}, timeout=60)
career = ok("career/pathway", r)
if not career:
    sys.exit(1)
print(f"  goal={career['career_goal']}  steps={len(career['recommended_path'])}  days={career['estimated_completion_days']}")
print(f"  gaps={career['knowledge_gaps'][:3]}")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*55}")
print(f"Live E2E: {passed} passed, {failed} failed")
if failed:
    sys.exit(1)
else:
    print("ALL LIVE E2E STEPS PASSED")
