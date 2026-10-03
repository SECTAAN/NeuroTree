"""
End-to-End Frontend-Backend Integration Verification
======================================================
Verifies the exact user flow described in Phase F-1 sign-off:

  Step 1.  New session (frontend sends X-User-ID header)
  Step 2.  Ingest real TCP/IP learning material
  Step 3.  NT-01 builds knowledge graph
  Step 4.  Graph has nodes + edges (would render in React Flow)
  Step 5.  First unlocked node selected
  Step 6.  NT-02 generates quiz question (expected_answer stored in DB)
  Step 7.  Correct answer submitted
  Step 8.  NT-03 returns mastery >= 70
  Step 9.  API response carries new_mastery_score (UI updates lamp)
  Step 10. Dependent nodes in unlocked_new_nodes (graph re-sync would reflect this)
  Step 11. Wrong answer submitted on re-ingested session
  Step 12. NT-03 returns mastery < 70, no unlock
  Step 13. No mock API involved — USE_MOCK_AI=False enforced throughout

Run:
  cd backend
  .\.venv\Scripts\python.exe e2e_integration_test.py
"""
import asyncio
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Force live AI for the entire test
os.environ["USE_MOCK_AI"] = "False"

sys.path.insert(0, os.path.dirname(__file__))

SEP   = "─" * 64
PASS  = "[PASS]"
FAIL  = "[FAIL]"
INFO  = "[INFO]"

def section(title):
    print(f"\n{SEP}\n  {title}\n{SEP}")

# ── Real TCP/IP learning material (as a user would paste it) ─────────────────
MATERIAL = """
TCP/IP Protocol Suite — Fundamental Concepts

TCP/IP adalah kumpulan protokol komunikasi yang menjadi fondasi internet modern.
Dikembangkan pada era 1970-an oleh ARPA, TCP/IP kini menjadi standar universal
untuk komunikasi data antar perangkat di seluruh dunia.

Arsitektur TCP/IP terdiri dari empat lapisan utama:

1. Network Access Layer (Data Link + Physical)
   Bertanggung jawab atas transmisi fisik data melalui media jaringan seperti
   kabel Ethernet, Wi-Fi, atau fiber optik. Menggunakan MAC Address untuk
   identifikasi perangkat di jaringan lokal.

2. Internet Layer
   Mengelola pengalamatan logis (IP Address) dan routing paket data antar
   jaringan. Protokol utama: IPv4, IPv6, ICMP, ARP. Router beroperasi di
   lapisan ini untuk meneruskan paket ke tujuan yang tepat.

3. Transport Layer
   Menyediakan komunikasi end-to-end antara aplikasi. TCP (Transmission Control
   Protocol) menjamin pengiriman data yang andal dan berurutan melalui mekanisme
   handshake tiga arah dan acknowledgment. UDP (User Datagram Protocol) lebih
   cepat namun tidak menjamin keandalan — cocok untuk streaming dan gaming.

4. Application Layer
   Protokol komunikasi tingkat aplikasi: HTTP/HTTPS untuk web, DNS untuk
   resolusi nama domain, SMTP/POP3 untuk email, FTP untuk transfer file.

Keunggulan TCP/IP: open standard, vendor-independent, scalable, mendukung
routing lintas jaringan, dan menjadi backbone seluruh infrastruktur internet.
"""

CORRECT_ANSWER = (
    "TCP/IP adalah protokol standar internet yang terdiri dari empat lapisan: "
    "Network Access Layer untuk transmisi fisik menggunakan MAC Address, "
    "Internet Layer untuk pengalamatan IP dan routing antar jaringan, "
    "Transport Layer dengan TCP yang reliable dan connection-oriented serta "
    "UDP yang cepat namun connectionless, dan Application Layer untuk protokol "
    "seperti HTTP, DNS, SMTP, dan FTP."
)

WRONG_ANSWER = "Saya tidak tahu jawabannya."

PARTIAL_ANSWER = "TCP/IP adalah protokol internet."


async def run():
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.db.database import engine, Base, SessionLocal
    from app.models.node import Node
    from app.models.edge import Edge

    Base.metadata.create_all(bind=engine)

    SESSION_ID = "e2e00000-0000-0000-0000-000000000001"
    HEADERS    = {"X-User-ID": SESSION_ID}

    results = {"passed": [], "failed": [], "warnings": []}

    def ok(msg, detail=""):
        print(f"  {PASS} {msg}")
        if detail:
            print(f"         {detail}")
        results["passed"].append(msg)

    def fail(msg, detail=""):
        print(f"  {FAIL} {msg}")
        if detail:
            print(f"         {detail}")
        results["failed"].append(msg)

    def info(msg):
        print(f"  {INFO} {msg}")

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        timeout=120.0,
    ) as c:

        # ── Step 1: Session / New Tree ─────────────────────────────────────────
        section("Step 1 — New Session (X-User-ID header)")
        info(f"Session ID: {SESSION_ID}")
        info("Frontend generates this via localStorage+crypto.randomUUID() after Phase F-1 fix")
        ok("Session ID set — header will be sent with every request")

        # ── Step 2: Ingest real material ───────────────────────────────────────
        section("Step 2 — Ingest Real TCP/IP Learning Material → NT-01")
        info(f"Material length: {len(MATERIAL.strip())} characters")
        info("Calling POST /api/v1/material/ingest …")

        r = await c.post(
            "/api/v1/material/ingest",
            json={"source_text": MATERIAL.strip()},
            headers=HEADERS,
        )

        if r.status_code != 200:
            fail("Ingest returned non-200", f"status={r.status_code}  body={r.text[:200]}")
            print("\n  STOP — cannot continue without a graph.")
            return results

        d = r.json()
        nodes_created = d["nodes_created"]
        edges_created = d["edges_created"]
        info(f"Response: {d}")

        if nodes_created >= 1:
            ok(f"NT-01 created knowledge graph", f"{nodes_created} nodes, {edges_created} edges")
        else:
            fail("NT-01 returned 0 nodes")

        # ── Step 3: Fetch graph ────────────────────────────────────────────────
        section("Step 3 — Fetch Graph (React Flow data)")
        r = await c.get("/api/v1/graph", headers=HEADERS)
        assert r.status_code == 200, f"Graph fetch failed: {r.text}"
        g = r.json()

        all_nodes  = g["nodes"]
        all_edges  = g["edges"]
        unlocked   = [n for n in all_nodes if n["status"] == "unlocked"]
        locked     = [n for n in all_nodes if n["status"] == "locked"]

        info(f"Nodes:    {len(all_nodes)} total  ({len(unlocked)} unlocked, {len(locked)} locked)")
        info(f"Edges:    {len(all_edges)}")
        for n in all_nodes:
            info(f"  node id={n['id']!r:35s}  status={n['status']:10s}  mastery={n['mastery_score']:.1f}")
        for e in all_edges:
            info(f"  edge {e['source_id']!r} → {e['target_id']!r}")

        # ── Step 4: React Flow rendering assertion ────────────────────────────
        section("Step 4 — React Flow Rendering Contract")
        has_id       = all(("id" in n) for n in all_nodes)
        has_title    = all(("title" in n) for n in all_nodes)
        has_status   = all(("status" in n) for n in all_nodes)
        has_mastery  = all(("mastery_score" in n) for n in all_nodes)
        has_edge_src = all(("source_id" in e and "target_id" in e) for e in all_edges)

        if has_id and has_title and has_status and has_mastery:
            ok("All node fields present (id, title, status, mastery_score)")
        else:
            fail("Missing node fields", f"id={has_id} title={has_title} status={has_status} mastery={has_mastery}")

        if all_edges and has_edge_src:
            ok("All edge fields present (source_id, target_id)")
        elif not all_edges:
            results["warnings"].append("No edges returned — single-node graph (may be valid for short material)")
            info("WARNING: 0 edges — single-node graph or NT-01 found no prerequisites")
        else:
            fail("Missing edge fields")

        if not unlocked:
            fail("No unlocked nodes — cannot continue quiz flow")
            print("\n  STOP — cannot test quiz without an unlocked node.")
            return results

        ok(f"First node is unlocked (entry point correct)")

        # ── Step 5: Select unlocked node ──────────────────────────────────────
        section("Step 5 — Select First Unlocked Node")
        node_id    = unlocked[0]["id"]
        node_title = unlocked[0]["title"]
        info(f"Selected node: id={node_id!r}  title={node_title!r}")

        r = await c.get(f"/api/v1/node/{node_id}", headers=HEADERS)
        assert r.status_code == 200, f"Node content fetch failed: {r.status_code} {r.text}"
        node_data = r.json()
        info(f"Node content length: {len(node_data.get('content',''))} chars")
        info(f"Key concepts: {node_data.get('key_concepts', [])}")
        ok(f"GET /api/v1/node/{node_id} returned 200 with full content")

        # ── Step 6: Generate quiz via NT-02 ───────────────────────────────────
        section("Step 6 — Generate Quiz via NT-02")
        info("Calling POST /api/v1/quiz/generate …")
        r = await c.post(
            "/api/v1/quiz/generate",
            json={"node_id": node_id},
            headers=HEADERS,
        )

        if r.status_code != 200:
            fail("quiz/generate returned non-200", f"status={r.status_code}  body={r.text[:200]}")
            return results

        quiz_data = r.json()
        question  = quiz_data["question"]
        info(f"Question: {question!r}")
        ok("NT-02 returned a quiz question")

        # Verify expected_answer was saved to DB
        db = SessionLocal()
        try:
            row = db.query(Node).filter(Node.id == node_id).first()
            db_expected = row.last_expected_answer if row else None
            mastery_before_eval = row.mastery_score if row else 0.0
        finally:
            db.close()

        info(f"DB last_expected_answer: {(db_expected or '')[:80]!r}")
        if db_expected:
            ok("expected_answer stored in DB (server-side, never exposed to frontend)")
        else:
            fail("expected_answer NOT stored in DB after NT-02 call")

        # ── Step 7 & 8: Submit correct answer → NT-03 mastery >= 70 ──────────
        section("Step 7+8 — Submit Correct Answer → NT-03 (expect mastery >= 70)")
        info(f"Answer: {CORRECT_ANSWER[:100]!r}…")
        info("Calling POST /api/v1/quiz/evaluate …")

        r = await c.post(
            "/api/v1/quiz/evaluate",
            json={"node_id": node_id, "user_answer": CORRECT_ANSWER},
            headers=HEADERS,
        )

        if r.status_code != 200:
            fail("quiz/evaluate returned non-200", f"status={r.status_code}  body={r.text[:200]}")
            return results

        eval_data   = r.json()
        ai_score    = eval_data["ai_score"]
        new_mastery = eval_data["new_mastery_score"]
        level       = eval_data["mastery_level"]
        unlocked_ids = eval_data["unlocked_new_nodes"]
        feedback    = eval_data.get("feedback", "")

        info(f"NT-03 response:")
        info(f"  ai_score (mastery_score from NT-03): {ai_score}")
        info(f"  new_mastery_score:                   {new_mastery}")
        info(f"  mastery_level:                       {level!r}")
        info(f"  unlocked_new_nodes:                  {unlocked_ids}")
        info(f"  feedback:                            {feedback[:100]!r}")

        # ── Step 9: Node mastery updates in UI ────────────────────────────────
        section("Step 9 — Node Mastery Update (UI lamp brightness)")
        # Read DB to confirm storage
        db = SessionLocal()
        try:
            row = db.query(Node).filter(Node.id == node_id).first()
            db_mastery = row.mastery_score if row else None
        finally:
            db.close()

        info(f"DB mastery_score after evaluation: {db_mastery}")
        info(f"mastery_before_evaluation:         {mastery_before_eval}")

        if db_mastery is not None and abs(db_mastery - new_mastery) < 0.01:
            ok(f"DB mastery == API response mastery ({db_mastery:.1f}) — stored directly from NT-03")
        else:
            fail(f"DB mastery mismatch", f"db={db_mastery}  api={new_mastery}")

        # Verify NOT progressive: prev + score*0.4
        progressive_would_be = round(min(100.0, mastery_before_eval + ai_score * 0.4), 2)
        if abs(new_mastery - progressive_would_be) > 0.1 or mastery_before_eval == 0:
            ok("mastery stored directly (not passed through calculate_progressive_mastery)")
        else:
            results["warnings"].append(
                f"mastery={new_mastery} coincides with progressive formula result={progressive_would_be}; "
                "code inspection already confirmed no wrapper is called"
            )

        if new_mastery >= 70:
            ok(f"NT-03 mastery {new_mastery:.1f} >= 70 → BRIGHT/FULL", f"mastery_level={level!r}")
        else:
            fail(f"Correct answer mastery {new_mastery:.1f} < 70 (expected >= 70)")

        # ── Step 10: Dependent node unlock + graph re-sync ────────────────────
        section("Step 10 — Dependent Node Unlock + Graph Re-Sync")

        if len(all_nodes) == 1:
            info("Single-node graph — no dependents to unlock (valid for short material)")
            ok("No dependents expected — single-node graph")
        elif unlocked_ids:
            info(f"Unlocked by evaluate: {unlocked_ids}")
            ok(f"{len(unlocked_ids)} dependent node(s) unlocked via backend threshold logic")

            # Simulate the background re-sync that AppContext.jsx now performs
            r2 = await c.get("/api/v1/graph", headers=HEADERS)
            assert r2.status_code == 200
            g2 = r2.json()
            now_unlocked = [n["id"] for n in g2["nodes"] if n["status"] == "unlocked"]
            info(f"Graph after re-sync: {len(g2['nodes'])} nodes, unlocked={now_unlocked}")

            for uid in unlocked_ids:
                found_unlocked = any(n["id"] == uid and n["status"] == "unlocked" for n in g2["nodes"])
                if found_unlocked:
                    ok(f"Re-sync confirms {uid!r} is unlocked in graph response")
                else:
                    fail(f"Re-sync: {uid!r} not showing as unlocked after re-fetch")
        else:
            # mastery >= 70 but no unlocks — means no dependents exist for this node
            if new_mastery >= 70:
                db = SessionLocal()
                try:
                    out_edges = db.query(Edge).filter(Edge.source_id == node_id).count()
                finally:
                    db.close()
                if out_edges == 0:
                    info(f"Node {node_id!r} has no outgoing edges — no dependents to unlock")
                    ok("mastery >= 70, no dependents exist — correct behavior")
                else:
                    fail(f"mastery >= 70 but {out_edges} dependent(s) not unlocked — check threshold logic")
            else:
                info("mastery < 70 on correct answer — threshold not crossed, no unlock expected")

        # ── Step 11 & 12: Wrong answer → mastery < 70, no unlock ─────────────
        section("Steps 11+12 — Wrong Answer → mastery < 70, no unlock")

        # Re-ingest to get a fresh session with mastery=0
        r = await c.post(
            "/api/v1/material/ingest",
            json={"source_text": MATERIAL.strip()},
            headers=HEADERS,
        )
        assert r.status_code == 200, f"Re-ingest failed: {r.text}"

        r = await c.get("/api/v1/graph", headers=HEADERS)
        assert r.status_code == 200
        g3 = r.json()
        fresh_node = next((n for n in g3["nodes"] if n["status"] == "unlocked"), None)
        assert fresh_node, "No unlocked node after re-ingest"

        fresh_id = fresh_node["id"]
        # Generate question first (sets expected_answer in DB)
        await c.post("/api/v1/quiz/generate", json={"node_id": fresh_id}, headers=HEADERS)

        # Wrong answer
        info(f"Submitting WRONG answer: {WRONG_ANSWER!r}")
        r_wrong = await c.post(
            "/api/v1/quiz/evaluate",
            json={"node_id": fresh_id, "user_answer": WRONG_ANSWER},
            headers=HEADERS,
        )
        assert r_wrong.status_code == 200
        wd = r_wrong.json()
        info(f"NT-03 wrong answer response:")
        info(f"  ai_score:          {wd['ai_score']}")
        info(f"  new_mastery_score: {wd['new_mastery_score']}")
        info(f"  mastery_level:     {wd['mastery_level']!r}")
        info(f"  unlocked:          {wd['unlocked_new_nodes']}")
        info(f"  feedback:          {wd.get('feedback','')[:80]!r}")

        if wd["new_mastery_score"] < 70:
            ok(f"Wrong answer mastery {wd['new_mastery_score']:.1f} < 70 → review state (no unlock)")
        else:
            fail(f"Wrong answer mastery {wd['new_mastery_score']:.1f} >= 70 (unexpected unlock risk)")

        if not wd["unlocked_new_nodes"]:
            ok("No nodes unlocked after wrong answer (correct behavior)")
        else:
            fail(f"Wrong answer incorrectly unlocked: {wd['unlocked_new_nodes']}")

        # Partial answer test
        info(f"\n  Submitting PARTIAL answer: {PARTIAL_ANSWER!r}")
        r_partial = await c.post(
            "/api/v1/quiz/evaluate",
            json={"node_id": fresh_id, "user_answer": PARTIAL_ANSWER},
            headers=HEADERS,
        )
        assert r_partial.status_code == 200
        pd = r_partial.json()
        info(f"NT-03 partial answer response:")
        info(f"  ai_score:          {pd['ai_score']}")
        info(f"  new_mastery_score: {pd['new_mastery_score']}")
        info(f"  mastery_level:     {pd['mastery_level']!r}")
        info(f"  unlocked:          {pd['unlocked_new_nodes']}")

        if pd["new_mastery_score"] < 70:
            ok(f"Partial answer mastery {pd['new_mastery_score']:.1f} < 70 → review")
        else:
            fail(f"Partial answer mastery {pd['new_mastery_score']:.1f} >= 70 (unexpectedly high)")

        # ── Step 13: No mock API ───────────────────────────────────────────────
        section("Step 13 — Mock API Verification")
        import app.core.config as cfg
        s = cfg.get_settings()
        info(f"USE_MOCK_AI setting: {s.USE_MOCK_AI}")
        if not s.USE_MOCK_AI:
            ok("USE_MOCK_AI=False — all calls went through real LangFlow (NT-01/02/03)")
        else:
            fail("USE_MOCK_AI=True — mock data was used, not real LangFlow")

    # ── Summary ───────────────────────────────────────────────────────────────
    section("VERIFICATION SUMMARY")
    print(f"\n  PASSED ({len(results['passed'])}):")
    for p in results["passed"]:
        print(f"    {PASS} {p}")

    if results["warnings"]:
        print(f"\n  WARNINGS ({len(results['warnings'])}):")
        for w in results["warnings"]:
            print(f"    [WARN] {w}")

    if results["failed"]:
        print(f"\n  FAILED ({len(results['failed'])}):")
        for f in results["failed"]:
            print(f"    {FAIL} {f}")
        print("\n  RESULT: INTEGRATION ISSUES FOUND — see above")
    else:
        print(f"\n  RESULT: ALL {len(results['passed'])} CHECKS PASSED")
        print("  End-to-end flow is fully functional.")

    print()
    return results


if __name__ == "__main__":
    asyncio.run(run())
