"""
End-to-end smoke test for Milestone 2 — run via:
  python smoke_test.py
"""
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.database import engine, Base

Base.metadata.create_all(bind=engine)

SESSION_ID = "ccccdddd-eeee-ffff-0000-111122223333"
HEADERS = {"X-User-ID": SESSION_ID}
LONG_ANSWER = (
    "Jaringan komputer adalah kumpulan perangkat yang saling terhubung "
    "melalui media transmisi untuk berbagi data dan sumber daya secara "
    "efisien. Topologi bintang memusat koneksi di switch utama sehingga "
    "mudah dikelola. Protokol TCP/IP memastikan paket data sampai ke "
    "tujuan dengan benar dan andal dalam berbagai kondisi jaringan modern."
)
SHORT_ANSWER = "jaringan komputer"


async def run() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:

        # 1. Ingest
        r = await c.post(
            "/api/v1/material/ingest",
            json={"source_text": "Jaringan komputer adalah kumpulan perangkat."},
            headers=HEADERS,
        )
        assert r.status_code == 200, f"INGEST failed: {r.text}"
        d = r.json()
        # Node/edge counts are non-deterministic when USE_MOCK_AI=False (live NT-01).
        # Assert >=1 so the test works for both mock (5 nodes) and live (variable).
        assert d["nodes_created"] >= 1, f"Expected at least 1 node, got {d['nodes_created']}"
        assert d["edges_created"] >= 1, f"Expected at least 1 edge, got {d['edges_created']}"
        print(f"[PASS] INGEST: {d['nodes_created']} nodes, {d['edges_created']} edges")

        # 2. Graph
        r = await c.get("/api/v1/graph", headers=HEADERS)
        assert r.status_code == 200
        g = r.json()
        assert len(g["nodes"]) >= 1
        assert len(g["edges"]) >= 1
        node_ids = [n["id"] for n in g["nodes"]]
        n1, n2 = node_ids[0], node_ids[1]
        assert g["nodes"][0]["status"] == "unlocked"
        assert g["nodes"][1]["status"] == "locked"
        print(f"[PASS] GRAPH: n1={n1} (unlocked), n2={n2} (locked)")

        # 3. Node content — unlocked
        r = await c.get(f"/api/v1/node/{n1}", headers=HEADERS)
        assert r.status_code == 200
        n = r.json()
        # Title is non-deterministic from live NT-01 — assert non-empty string only.
        assert isinstance(n["title"], str) and len(n["title"]) > 0
        print(f"[PASS] NODE CONTENT: {n['title']}")

        # 4. Node content — locked → 403
        r = await c.get(f"/api/v1/node/{n2}", headers=HEADERS)
        assert r.status_code == 403
        print("[PASS] LOCKED NODE returns 403")

        # 5. Generate quiz
        r = await c.post("/api/v1/quiz/generate", json={"node_id": n1}, headers=HEADERS)
        assert r.status_code == 200
        assert "question" in r.json()
        print(f"[PASS] QUIZ GENERATE: {r.json()['question'][:60]}...")

        # 6. Evaluate short answer → small mastery increment, no unlock
        r = await c.post(
            "/api/v1/quiz/evaluate",
            json={"node_id": n1, "user_answer": SHORT_ANSWER},
            headers=HEADERS,
        )
        assert r.status_code == 200
        e = r.json()
        assert e["mastery_level"] in ("LOW", "MEDIUM", "BRIGHT", "FULL")
        assert e["new_mastery_score"] > 0
        print(f"[PASS] EVAL SHORT: score={e['ai_score']} mastery={e['new_mastery_score']} level={e['mastery_level']}")

        # 7. Evaluate long answers until unlock or 4 attempts
        unlocked = []
        attempts = 0
        while not unlocked and attempts < 4:
            r = await c.post(
                "/api/v1/quiz/evaluate",
                json={"node_id": n1, "user_answer": LONG_ANSWER},
                headers=HEADERS,
            )
            e = r.json()
            unlocked = e["unlocked_new_nodes"]
            attempts += 1
            print(
                f"[INFO] EVAL LONG #{attempts}: score={e['ai_score']} "
                f"mastery={e['new_mastery_score']} level={e['mastery_level']} "
                f"unlocked={unlocked}"
            )
        assert unlocked, "Expected at least one node to be unlocked after 4 long answers"
        print(f"[PASS] UNLOCK: {unlocked}")

        # 8. Verify unlocked node is now accessible
        r = await c.get(f"/api/v1/node/{unlocked[0]}", headers=HEADERS)
        assert r.status_code == 200
        print(f"[PASS] UNLOCKED NODE accessible: {r.json()['title']}")

        # 9. Recommend
        r = await c.get("/api/v1/quiz/recommend", headers=HEADERS)
        assert r.status_code == 200
        recs = r.json()["recommendations"]
        assert len(recs) > 0
        print(f"[PASS] RECOMMEND: {[(x['id'][-8:], x['priority']) for x in recs]}")

        # 10. Input validation — text too long
        r = await c.post(
            "/api/v1/material/ingest",
            json={"source_text": "x" * 5001},
            headers=HEADERS,
        )
        assert r.status_code == 422
        print("[PASS] VALIDATION: 5001-char source_text rejected with 422")

        # 11. Input validation — answer too long
        r = await c.post(
            "/api/v1/quiz/evaluate",
            json={"node_id": n1, "user_answer": "y" * 1001},
            headers=HEADERS,
        )
        assert r.status_code == 422
        print("[PASS] VALIDATION: 1001-char answer rejected with 422")

        # 12. Missing X-User-ID header
        r = await c.get("/api/v1/graph")
        assert r.status_code == 422
        print("[PASS] SECURITY: Missing X-User-ID returns 422")

        # 13. Invalid UUID in header
        r = await c.get("/api/v1/graph", headers={"X-User-ID": "not-a-uuid"})
        assert r.status_code == 400
        print("[PASS] SECURITY: Invalid UUID returns 400")

        print("\n✅ All Milestone 2 smoke tests passed.")


if __name__ == "__main__":
    asyncio.run(run())
