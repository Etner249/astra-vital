"""End-to-end test in headless Chrome. Run: python3 tests/e2e.py (needs playwright + chrome)."""
import pathlib, sys, json
from playwright.sync_api import sync_playwright
url = (pathlib.Path(__file__).resolve().parent.parent / 'dist/index.html').as_uri()
shots = pathlib.Path(__file__).resolve().parent.parent / 'media/screens'; shots.mkdir(parents=True, exist_ok=True)
errors = []; ok = 0
def check(cond, msg):
    global ok
    if not cond: print('FAIL -', msg); sys.exit(1)
    ok += 1; print('ok -', msg)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(500)
    for v in ['dashboard','log','body','alerts','risk','nasa','profile','sync','ground','about']:
        pg.goto(url + '#' + v); pg.wait_for_timeout(300)
        check(len(pg.inner_text('#view')) > 200, f'view {v} renders')
        pg.screenshot(path=str(shots / f'{v}.png'))
    pg.goto(url + '#dashboard'); pg.wait_for_timeout(300)
    st = pg.evaluate('AV.engine.status(AV.engine.analyze(AV.state.records))')
    check(st == 'priority', f'demo scenario status is priority (got {st})')
    # log a measurement
    pg.goto(url + '#log?m=temp'); pg.wait_for_timeout(300)
    n0 = pg.evaluate('AV.state.records.length')
    pg.fill('#val', '45'); pg.click('#f button[type=submit]'); pg.wait_for_timeout(200)
    check('plausible' in pg.inner_text('#err'), 'form validation rejects 45 °C')
    pg.fill('#val', '36.8'); pg.click('#f button[type=submit]'); pg.wait_for_timeout(300)
    check(pg.evaluate('AV.state.records.length') == n0 + 1, 'valid measurement saved')
    check(pg.evaluate('AV.state.queue.length') == 1, 'record queued for sync')
    # persistence
    pg.reload(); pg.wait_for_timeout(400)
    check(pg.evaluate('AV.state.records.length') == n0 + 1, 'record persists after reload')
    # sync blocked during LOS
    pg.goto(url + '#sync'); pg.wait_for_timeout(300)
    check(pg.is_disabled('#sync'), 'sync disabled during LOS')
    # add 7 more records, inject a drop, sync
    pg.evaluate("""() => { for (let i=0;i<7;i++){ const r={id:'t'+i,metric:'hr',ts:Date.now()-i*60000,value:63,value2:null,unit:'bpm',source:'Manual entry',note:'',version:1,origin:'crew'}; r.hash=AV.engine.hashRecord(r); AV.state.records.push(r); AV.state.queue.push(r.id);} AV.state.dropNext=true; }""")
    pg.click('#link'); pg.wait_for_timeout(200); pg.click('#sync'); pg.wait_for_timeout(300)
    q = pg.evaluate('AV.state.queue.length'); link = pg.evaluate('AV.state.link')
    check(q == 3 and link == 'LOS', f'link drop leaves remaining records queued (queue={q}, link={link})')
    pg.click('#link'); pg.wait_for_timeout(200); pg.click('#sync'); pg.wait_for_timeout(300)
    check(pg.evaluate('AV.state.queue.length') == 0, 'transfer resumes and completes after interruption')
    # ground note round trip
    pg.goto(url + '#ground'); pg.wait_for_timeout(300)
    pg.fill('#gn', 'Reviewed sleep trend, discuss at PMC.'); pg.click('#gsend'); pg.wait_for_timeout(200)
    pg.goto(url + '#sync'); pg.wait_for_timeout(200); pg.click('#sync'); pg.wait_for_timeout(300)
    check(pg.evaluate('AV.state.inbox.length') == 1, 'flight surgeon note delivered at sync')
    # exports
    csv = pg.evaluate('AV.csv()'); check(csv.startswith('id,utc_time') or csv.startswith('"') or 'utc_time' in csv.split('\n')[0], 'CSV export has header')
    check('Earth Medical Report' in pg.evaluate('AV.reportHtml()'), 'report generated')
    with pg.expect_download() as d: pg.click('#csv')
    check(d.value.suggested_filename.endswith('.csv'), 'CSV download works')
    # body map interaction
    pg.goto(url + '#body'); pg.wait_for_timeout(300); pg.click('g.zone[data-s=nervous]'); pg.wait_for_timeout(200)
    check('nervous system' in pg.inner_text('#view').lower(), 'body map selects nervous system')
    # alert expand
    pg.goto(url + '#alerts'); pg.wait_for_timeout(300); pg.click('.alert .head'); pg.wait_for_timeout(100)
    check(pg.is_visible('.alert .more'), 'alert expands with explanation')
    # responsive
    m = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    m.on('pageerror', lambda e: errors.append(str(e)))
    m.goto(url + '#dashboard'); m.wait_for_timeout(400)
    sw = m.evaluate('document.documentElement.scrollWidth'); check(sw <= 392, f'no horizontal overflow on mobile (scrollWidth={sw})')
    m.screenshot(path=str(shots / 'mobile-dashboard.png'))
    m.goto(url + '#body'); m.wait_for_timeout(300); m.screenshot(path=str(shots / 'mobile-body.png'))
    t = b.new_page(viewport={'width': 820, 'height': 1180}); t.goto(url + '#risk'); t.wait_for_timeout(300)
    check(t.evaluate('document.documentElement.scrollWidth') <= 822, 'no horizontal overflow on tablet')
    b.close()
check(not errors, 'no console errors: ' + json.dumps(errors[:3]))
print(f'\n{ok} checks passed')
