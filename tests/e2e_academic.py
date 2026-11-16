"""End-to-end test of the academic edition (GitHub Pages frontend + Flask API) with Playwright + Chrome.

Usage:  python3 tests/e2e_academic.py <frontend-url> <screenshot-dir> [--no-writes]
  e.g.  python3 tests/e2e_academic.py http://127.0.0.1:8080/astra-vital/ /tmp/shots
The demo credentials are read from the login page itself (served by the API), never hard-coded here.
Prints one line per check and exits 1 if any check fails.
"""
import json
import pathlib
import re
import sys
import time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") + "/"
OUT = pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
WRITES = "--no-writes" not in sys.argv
ORIGINAL = ["dashboard", "log", "body", "alerts", "risk", "nasa", "profile", "sync", "ground", "about"]
EXPECT_NAV = {
    "admin": ORIGINAL[:-1] + ["crew", "records", "review", "users", "audit", "about"],
    "doctor": ORIGINAL[:-1] + ["crew", "records", "review", "about"],
    "operator": ORIGINAL[:-1] + ["crew", "records", "review", "about"],
}
results, errors = [], []
STAMP = time.strftime("%H%M%S")


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""), flush=True)


def shot(pg, name, full=False):
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / f"{name}.png"), full_page=full)


def toast_text(pg, timeout=60000):
    """Text of the newest toast not read yet (older toasts are marked as seen)."""
    pg.wait_for_selector(".toast:not([data-seen])", timeout=timeout)
    t = pg.locator(".toast:not([data-seen])").last.inner_text()
    mark_seen(pg)
    return t


def mark_seen(pg):
    pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.setAttribute('data-seen', '1'))")


def go(pg, view):
    mark_seen(pg)
    pg.evaluate(f"location.hash = '#{view}'")
    pg.wait_for_timeout(250)
    pg.wait_for_function("() => !document.querySelector('#view .empty') || !document.querySelector('#view .empty').textContent.startsWith('Loading')", timeout=60000)


def login(pg, role):
    pg.goto(BASE)
    pg.wait_for_selector(f".demo-acc.role-{role} .use-acc", timeout=90000)
    pg.click(f".demo-acc.role-{role} .use-acc")
    pg.click("#lbtn")
    pg.wait_for_selector(".app nav", timeout=90000)
    pg.wait_for_timeout(500)
    mark_seen(pg)


def logout(pg):
    pg.click("#logout")
    pg.wait_for_selector("#lf", timeout=30000)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    # HTTP 401/403 answers are expected in some checks; the browser logs them as "Failed to load resource"
    pg.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" and "Failed to load resource" not in m.text else None)

    # ---- entry point
    t0 = time.time()
    pg.goto(BASE)
    pg.wait_for_selector("#srv.ok", timeout=90000)
    check("Entry URL shows the NASA Evaluator Access login", "NASA EVALUATOR ACCESS" in pg.inner_text(".login-card .eval-kicker") and pg.locator("#lf").count() == 1, f"server ready in {time.time() - t0:.1f}s")
    pg.wait_for_selector(".demo-acc", timeout=30000)
    cards = pg.locator(".demo-acc")
    check("Three demo accounts served by the API", cards.count() == 3, ", ".join(pg.locator(".demo-acc code").all_inner_texts()[::2]))
    check("Public-demo warning visible", "do not enter personal" in pg.inner_text(".demo-warning"))
    # project briefing + English-only login
    sections = pg.locator(".acc details")
    check("Project briefing has 15 expandable sections", sections.count() == 15, ", ".join(pg.locator(".acc summary").all_inner_texts()))
    for i in range(sections.count()):
        sections.nth(i).locator("summary").click()
    pg.wait_for_timeout(300)
    full = pg.inner_text(".login-page")
    spanish = [w for w in ("Iniciar", "Contraseña", "Correo", "Ingresar", "Usar esta", "Copiar", "cuentas", "servidor", "Equipo ", "sesión", "Versión") if w in full]
    check("Login + briefing text is English only", not spanish, ",".join(spanish))
    for must in ("not a certified medical device", "36-hour missing-data window", "not continuous in-flight vital signs", "not endorsed or validated by NASA", "No AI model runs inside ASTRA VITAL", "without persistent disk storage"):
        check(f"Briefing states: {must}", must in full)
    links = sorted(set(pg.eval_on_selector_all(".briefing a[href^='http']", "els => els.map(e => e.href)")))
    check("Briefing external links are well-formed", all(re.match(r"^https://[^\s]+[^.,;]$", u) and not u.endswith("svg") for u in links), " ".join(links))
    shot(pg, "e2e_03_login_briefing_expanded", True)
    for i in range(sections.count()):
        if i: sections.nth(i).locator("summary").click()
    pg.click("#pwt"); check("Password visibility toggle shows the password", pg.get_attribute("#password", "type") == "text" and pg.inner_text("#pwt") == "Hide")
    pg.click("#pwt"); check("Password visibility toggle hides it again", pg.get_attribute("#password", "type") == "password")
    shot(pg, "e2e_01_login")
    pg.fill("#email", "nobody@astravital.example"); pg.fill("#password", "wrong-password-1"); pg.click("#lbtn")
    pg.wait_for_function("() => document.querySelector('#lerr').textContent.length > 0", timeout=60000)
    check("Wrong credentials rejected (English error)", pg.inner_text("#lerr") == "Incorrect email or password.")

    for role in ("operator", "doctor", "admin"):
        login(pg, role)
        nav = [a.get_attribute("data-v") for a in pg.locator("nav a").all()]
        check(f"[{role}] signs in and sees the original shell", pg.locator(".userbox").count() == 1, pg.inner_text(".userbox").replace("\n", " | "))
        check(f"[{role}] navigation matches role", nav == EXPECT_NAV[role], ",".join(nav))
        shot(pg, f"e2e_10_{role}_dashboard", True)
        before = len(errors)
        for v in ORIGINAL:
            go(pg, v)
            ok = pg.locator("#view .card, #view .hazard").count() > 0
            check(f"[{role}] original module '{v}' renders", ok)
        check(f"[{role}] no JS errors in the 10 original modules", len(errors) == before, "; ".join(errors[before:])[:300])
        # direct URL to a forbidden module falls back to dashboard
        if role != "admin":
            pg.evaluate("location.hash = '#users'"); pg.wait_for_timeout(300)
            check(f"[{role}] #users not reachable", pg.inner_text("#title") == "Mission Dashboard")

        if role == "operator" and WRITES:
            go(pg, "log")
            pg.select_option("#metric", "hr"); pg.fill("#val", "73"); pg.fill("#note", f"E2E operator {STAMP}")
            pg.click("#f button[type=submit]")
            t = toast_text(pg)
            check("[operator] Log Measurement stored in SQLite via API", "confirmed by the ground store" in t, t[:120])
            shot(pg, "e2e_20_operator_log_synced")
            go(pg, "records")
            row = pg.locator("tr", has_text=f"Demo Operador")
            check("[operator] record visible in Measurements Database", row.count() >= 1)
            check("[operator] no edit/delete buttons", pg.locator("#view [data-edit], #view [data-del]").count() == 0)
            go(pg, "profile")
            check("[operator] profile is read-only", pg.locator("#p_id").is_disabled())
            # offline-first: LOS queue then AOS sync
            go(pg, "sync"); pg.click("#link"); pg.wait_for_timeout(300)
            go(pg, "log"); pg.select_option("#metric", "sleep"); pg.fill("#val", "6.4"); pg.click("#f button[type=submit]")
            t = toast_text(pg)
            check("[operator] with LOS the record stays queued on the device", "queued" in t, t[:80])
            go(pg, "sync")
            check("[operator] queue shows 1 pending record", "Queued: 1" in pg.inner_text("#view").replace("\n", " "))
            shot(pg, "e2e_21_operator_los_queue")
            pg.click("#link"); pg.wait_for_timeout(300); pg.click("#sync")
            t = toast_text(pg)
            check("[operator] AOS sync sends the queued record", "1 sent" in t and "0 still queued" in t, t)
            pg.reload(); pg.wait_for_selector(".app nav", timeout=60000)
            check("[operator] session survives page reload", pg.locator(".userbox").count() == 1)

        if role == "doctor" and WRITES:
            go(pg, "review")
            forms = pg.locator("form.rv")
            check("[doctor] can review stored alerts", forms.count() > 0)
            pg.locator(".alert .head").first.click()
            forms.first.locator("select").select_option("acknowledged")
            forms.first.locator("input[name=review_notes]").fill(f"E2E review {STAMP}")
            forms.first.locator("button").click()
            t = toast_text(pg)
            check("[doctor] alert review saved", "Review saved" in t, t)
            shot(pg, "e2e_30_doctor_alert_review")
            go(pg, "records")
            row = pg.locator("tr", has_text="Demo Operador").first
            row.locator("[data-edit]").click()
            pg.wait_for_selector("#mef")
            pg.fill("#mef input[name=heart_rate]", "76"); pg.click("#mef button.primary")
            t = toast_text(pg)
            check("[doctor] edits a measurement (alerts recalculated)", "updated" in t, t)
            check("[doctor] has no delete buttons", pg.locator("#view [data-del]").count() == 0)
            go(pg, "ground")
            pg.wait_for_function("() => { const g = document.querySelector('#galerts'); return g && !g.innerText.includes('Loading'); }", timeout=60000)
            g = pg.inner_text("#galerts")
            check("[doctor] Ground Console lists alerts stored in SQLite", "alerts stored on the ground" in g.lower() and "render api" in g.lower(), g[:160].replace("\n", " | "))
            shot(pg, "e2e_31_doctor_ground_console", True)

        if role == "admin" and WRITES:
            go(pg, "crew"); pg.click("#anew"); pg.wait_for_selector("#af")
            code = f"AV-E2E-{STAMP}"
            pg.fill("#af input[name=code]", code); pg.fill("#af input[name=full_name]", "E2E Evaluator Crew (fictional)")
            pg.select_option("#af select[name=mission_id]", index=1); pg.click("#af button.primary")
            t = toast_text(pg); check("[admin] creates astronaut", "saved" in t, t)
            pg.wait_for_selector(f"tr:has-text('{code}')")
            pg.locator("tr", has_text=code).locator("[data-edit]").click(); pg.wait_for_selector("#af")
            pg.fill("#af input[name=role_on_board]", "E2E Specialist"); pg.click("#af button.primary")
            t = toast_text(pg); check("[admin] edits astronaut", "saved" in t, t)
            shot(pg, "e2e_40_admin_crew")
            pg.locator("tr", has_text=code).locator("[data-del]").click(); pg.locator("tr", has_text=code).locator("[data-del]").click()
            t = toast_text(pg); check("[admin] deletes astronaut it created", "deleted" in t, t)
            pg.click("#mnew"); pg.wait_for_selector("#mf")
            mcode = f"AV-M-{STAMP}"
            pg.fill("#mf input[name=code]", mcode); pg.fill("#mf input[name=name]", "E2E mission"); pg.click("#mf button.primary")
            t = toast_text(pg); check("[admin] creates mission", "saved" in t, t)
            pg.locator("tr", has_text=mcode).locator("[data-mdel]").click(); pg.locator("tr", has_text=mcode).locator("[data-mdel]").click()
            t = toast_text(pg); check("[admin] deletes mission it created", "deleted" in t, t)
            go(pg, "records")
            syn = pg.locator("tr", has_text="synthetic").first.locator("[data-del]")
            syn.click(); syn.click()
            t = toast_text(pg); check("[admin demo] cannot delete synthetic reference data", "cannot delete" in t.lower(), t[:120])
            own = pg.locator("tr", has_text="Demo Operador").first.locator("[data-del]")
            own.click(); own.click()
            t = toast_text(pg); check("[admin] deletes an evaluator-created measurement", "deleted" in t, t)
            go(pg, "users")
            check("[admin demo] user management is read-only", "read-only" in pg.inner_text("#view") and pg.locator("#unew").count() == 0)
            check("[admin demo] private admin e-mail is masked", "admin@nyxara.example" not in pg.inner_text("#view"))
            shot(pg, "e2e_41_admin_users_read_only")
            go(pg, "audit")
            check("[admin] audit log loads (IPs hidden for demo)", "audit log" in pg.inner_text("#view").lower() and "hidden" in pg.inner_text("#view"))
            shot(pg, "e2e_42_admin_audit")
            go(pg, "body"); shot(pg, "e2e_43_admin_body")
        logout(pg)
        check(f"[{role}] sign out returns to login (English notice)", pg.locator("#lf").count() == 1 and pg.inner_text(".flash").startswith("Signed out."))

    # token is invalid after logout
    pg.goto(BASE + "nasa-2026/")
    pg.wait_for_selector("nav", timeout=30000)
    txt = pg.inner_text("body")
    check("/nasa-2026/ opens the submitted version (no login, original app)", "NASA EVALUATOR ACCESS" not in txt and "Mission Dashboard" in txt)
    shot(pg, "e2e_50_nasa_2026_frozen")
    m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2).new_page()
    m.goto(BASE); m.wait_for_selector(".demo-acc", timeout=90000); m.wait_for_timeout(300)
    m.screenshot(path=str(OUT / "e2e_02_login_mobile.png"), full_page=True)
    t = b.new_context(viewport={"width": 820, "height": 1180}).new_page()
    t.goto(BASE); t.wait_for_selector(".demo-acc", timeout=90000); t.wait_for_timeout(300)
    t.screenshot(path=str(OUT / "e2e_02b_login_tablet.png"), full_page=True)
    ovf = m.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1") or t.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check("No horizontal overflow on mobile (390 px) and tablet (820 px)", not ovf)
    b.close()

failed = [r for r in results if not r[1]]
print(json.dumps({"checks": len(results), "passed": len(results) - len(failed), "failed": len(failed), "js_errors": errors[:10]}))
sys.exit(1 if failed or errors else 0)
