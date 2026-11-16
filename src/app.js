/* ASTRA VITAL — application layer. Team NYXARA NOVA, NASA Space Apps Challenge 2026.
 * Academic edition: same modules and design as the version submitted to NASA (preserved at /nasa-2026/),
 * now with sign-in (NASA Evaluator Access), roles and a ground store backed by the Flask + SQLite API on Render.
 * The browser keeps the offline-first queue; the "ground store" is the real API. */
(function () {
  'use strict';
  const E = window.AVEngine; const M = E.METRICS; const DAY = E.DAY;
  const OSDR = window.AV_OSDR || [];
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const fmtTime = t => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const fmtDate = t => new Date(t).toISOString().slice(0, 10);

  const HAZARDS = {
    R: { name: 'Space Radiation', color: '#ff8a5b' }, I: { name: 'Isolation & Confinement', color: '#b48cff' },
    D: { name: 'Distance from Earth', color: '#7aa7ff' }, G: { name: 'Gravity Fields', color: '#36d6e7' }, E: { name: 'Hostile/Closed Environments', color: '#3ccf91' }
  };
  const ENVS = {
    station: { label: 'Space station (LEO)', delay: '< 1 s (near-continuous link)', g: 'Microgravity' },
    spacecraft: { label: 'Deep-space spacecraft (Mars transit)', delay: 'up to ~20 min one way', g: 'Microgravity' },
    moon: { label: 'Lunar surface base', delay: '~1.3 s one way', g: '1/6 g' },
    mars: { label: 'Mars surface base', delay: 'up to ~20 min one way', g: '3/8 g' },
    rover: { label: 'Pressurized rover (surface EVA ops)', delay: 'Relayed via base', g: 'Partial gravity' },
    analog: { label: 'Earth analog habitat', delay: 'Simulated (analog mission)', g: '1 g' }
  };
  const ICON = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    followup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
    priority: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="4" y="4" width="16" height="16" rx="2" transform="rotate(45 12 12)"/><path d="M12 8v5M12 16v.5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>'
  };
  // Original ASTRA VITAL symbol (single source of truth — also exported to assets/brand/astra-vital-symbol.svg)
  const SYMBOL_INNER = '<circle cx="20" cy="20" r="18" fill="none" stroke="#36D6E7" stroke-width="1.5"/><ellipse cx="20" cy="20" rx="18" ry="6" fill="none" stroke="#3B82F6" stroke-width="1.2" transform="rotate(-25 20 20)"/><path d="M8 21h6l3-7 4 13 3-9 2 3h6" fill="none" stroke="#E8EEF8" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  const symbol = (size, extra) => `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" ${extra || ''}>${SYMBOL_INNER}</svg>`;
  const LEVEL = { priority: 'Priority', followup: 'Follow-up', info: 'Informative', nominal: 'Nominal', ok: 'Nominal' };
  const badge = (lvl, txt) => `<span class="badge b-${lvl === 'nominal' ? 'ok' : lvl}">${ICON[lvl === 'nominal' ? 'ok' : lvl] || ''}${esc(txt || LEVEL[lvl])}</span>`;

  /* ---------------- Academic edition: API client (Flask + SQLite on Render) ---------------- */
  const API_BASE = (window.AV_CONFIG && window.AV_CONFIG.apiBase || '').replace(/\/$/, '');
  const TOKEN_KEY = 'astra-vital-academic-token', ASTRO_KEY = 'astra-vital-academic-astronaut';
  const SESSION = { token: null, user: null, astronauts: [], astronaut: null, alerts: [], ended: false };
  const can = p => !!(SESSION.user && SESSION.user.permissions.indexOf(p) >= 0);
  const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
  async function api(path, opts) {
    opts = opts || {};
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), opts.timeout || 75000);
    const headers = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (SESSION.token && !opts.anon) headers.Authorization = 'Bearer ' + SESSION.token;
    let res;
    try {
      res = await fetch(API_BASE + path, { method: opts.method || 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: ctrl.signal, credentials: 'omit', cache: 'no-store', mode: 'cors' });
    } catch (e) {
      const err = new Error(e.name === 'AbortError' ? 'The ground server did not answer in time.' : 'Cannot reach the ground server (Render).'); err.network = true; throw err;
    } finally { clearTimeout(timer); }
    let data = null; try { data = await res.json(); } catch (e) { data = null; }
    if (res.status === 401 && !opts.anon) { endSession('Tu sesión expiró o el servidor se reinició. Inicia sesión nuevamente.'); }
    if (!res.ok) { const err = new Error((data && data.error) || ('HTTP ' + res.status)); err.status = res.status; err.fields = data && data.fields; throw err; }
    return data;
  }
  const errText = e => e.fields ? Object.entries(e.fields).map(([k, v]) => `${k}: ${[].concat(v).join(' ')}`).join(' · ') : e.message;

  // server measurement row <-> original per-indicator record
  const FIELD = { hr: ['heart_rate'], bp: ['systolic_bp', 'diastolic_bp'], spo2: ['spo2'], temp: ['temperature'], sleep: ['sleep_hours'], activity: ['exercise_min'], fatigue: ['fatigue'], mood: ['mood'], glucose: ['glucose'] };
  const SRC = { 'Manual entry': 'manual', 'Onboard medical kit device (manual transcription)': 'medkit_device', 'Self-report questionnaire': 'self_report', 'Exercise device log (manual transcription)': 'exercise_log' };
  const SRC_LABEL = {}; Object.keys(SRC).forEach(k => { SRC_LABEL[SRC[k]] = k; });
  function fromServer(rows) {
    const out = [];
    rows.forEach(m => Object.keys(FIELD).forEach(k => {
      const f = FIELD[k]; const v = m[f[0]]; if (v === null || v === undefined) return;
      const rec = { id: `s${m.id}-${k}`, serverId: m.id, metric: k, ts: Date.parse(m.measured_at), value: v, value2: f[1] ? m[f[1]] : null, unit: M[k].unit,
        source: m.is_synthetic ? 'Synthetic demo data' : (SRC_LABEL[m.source] || m.source), note: m.notes && m.notes !== 'SYNTHETIC demo measurement' ? m.notes : '',
        version: 1, synced: true, origin: 'crew', recordedBy: m.recorded_by };
      rec.hash = E.hashRecord(rec); out.push(rec);
    }));
    return out;
  }
  function toServer(r) {
    const body = { astronaut_id: SESSION.astronaut.id, measured_at: new Date(r.ts).toISOString(), notes: r.note || '', source: SRC[r.source] || 'manual' };
    const f = FIELD[r.metric]; body[f[0]] = r.value; if (f[1]) body[f[1]] = r.value2; return body;
  }

  /* ---------------- Storage (offline-first queue, per user and astronaut) ---------------- */
  let S;
  const localKey = () => `astra-vital-academic:v1:${SESSION.user.id}:${SESSION.astronaut.id}`;
  function save() {
    if (!S || !SESSION.user || !SESSION.astronaut) return;
    const keep = { queue: S.queue, pending: S.records.filter(r => S.queue.includes(r.id)), syncLog: S.syncLog, acked: S.acked, notes: S.ground.notes, inbox: S.inbox,
      link: S.link, lastContact: S.lastContact, routine: S.routine, streak: S.streak, points: S.points, profileEnv: S.profileEnv };
    try { localStorage.setItem(localKey(), JSON.stringify(keep)); S._persist = true; } catch (e) { S._persist = false; }
  }
  function loadLocal() { try { const raw = localStorage.getItem(localKey()); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // SYNTHETIC demo data — clearly labelled. Not astronaut measurements.
  function demoRecords(now) {
    const r = rng(2026); const g = (m, s) => m + (r() + r() + r() - 1.5) * s * 1.15;
    const out = []; const start = now - 20 * DAY;
    const mk = (metric, ts, value, value2) => { const rec = { id: uid() + out.length, metric, ts, value, value2: value2 == null ? null : value2, unit: M[metric].unit, source: 'Synthetic demo data', note: '', version: 1, synced: true, origin: 'crew' }; rec.hash = E.hashRecord(rec); out.push(rec); };
    for (let d = 0; d < 21; d++) {
      if (d === 16) continue; // deliberate data gap (missed day)
      const day0 = new Date(start + d * DAY); day0.setUTCHours(7, 10, 0, 0); const t = day0.getTime();
      const late = Math.max(0, d - 13); // last week drifts
      mk('hr', t, Math.round(g(62 + late * 1.3, 2.5)));
      mk('bp', t + 120000, Math.round(g(115 + late * 2.0, 3.5)), Math.round(g(74 + late * 1.2, 2.5)));
      mk('spo2', t + 240000, d === 20 ? 89 : Math.min(100, Math.round(g(97.6, 0.6))));
      mk('temp', t + 300000, +g(36.6, 0.12).toFixed(1));
      mk('sleep', t - 3600000, +Math.max(3.5, g(6.9 - late * 0.27, 0.3)).toFixed(1));
      mk('fatigue', t + 400000, Math.min(7, Math.max(1, Math.round(g(2.6 + late * 0.45, 0.6)))));
      mk('mood', t + 420000, Math.min(5, Math.max(1, Math.round(g(4.2 - late * 0.17, 0.4)))));
      mk('activity', t + 12 * 3600000, Math.round(Math.max(0, g(d >= 17 ? 85 : 126, 9))));
      if (d % 5 === 0) mk('glucose', t + 500000, Math.round(g(88, 5)));
    }
    // a typing error to demonstrate the quality check
    mk('hr', start + 18 * DAY + 9 * 3600000, 7);
    return out;
  }

  function buildState(serverRecords) {
    const a = SESSION.astronaut; const mi = a.mission; const now = Date.now(); const loc = loadLocal() || {};
    const pending = (loc.pending || []).filter(r => (loc.queue || []).includes(r.id));
    const last = serverRecords.length ? Math.max.apply(null, serverRecords.map(r => r.ts)) : now;
    return {
      v: 2, createdAt: now,
      profile: { id: a.code, name: a.full_name, role: a.role_on_board || '—', mission: mi ? mi.name : 'No mission assigned', missionStart: mi ? Date.parse(mi.start_date + 'T00:00:00Z') : now,
        missionDays: mi ? mi.duration_days : 180, env: mi && ENVS[mi.environment] ? mi.environment : 'station', age: a.demo_age, notes: a.notes, synthetic: a.is_synthetic },
      records: serverRecords.concat(pending), queue: pending.map(r => r.id),
      ground: { records: serverRecords.map(r => Object.assign({}, r)), notes: loc.notes || [], receivedAt: last },
      inbox: loc.inbox || [], link: loc.link || 'AOS', lastContact: loc.lastContact || now, dropNext: false,
      syncLog: loc.syncLog || [`${fmtTime(now)}  Connected to the ground store (Flask + SQLite API on Render). ${serverRecords.length} records loaded for ${a.code}.`],
      routine: loc.routine || { date: fmtDate(now), done: [] }, streak: loc.streak || 0, points: loc.points || 0, acked: loc.acked || []
    };
  }

  /* ---------------- Helpers ---------------- */
  const validRecords = () => S.records.filter(r => E.checkQuality(r).ok);
  function latest(metric) { const s = S.records.filter(r => r.metric === metric && E.checkQuality(r).ok).sort((a, b) => b.ts - a.ts); return s[0]; }
  function missionDay(t) { return Math.floor(((t || Date.now()) - S.profile.missionStart) / DAY) + 1; }
  function alerts() { return E.analyze(S.records, Date.now()); }
  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3800); }
  function valStr(r) { if (!r) return '—'; return M[r.metric].dual ? `${r.value}/${r.value2}` : r.value; }

  /* ---------------- Charts (SVG, no external libs) ---------------- */
  function lineChart(seriesList, opts) {
    opts = opts || {}; const W = opts.w || ((opts.h || 200) <= 180 ? 460 : 640), H = opts.h || 200, P = { l: 40, r: 12, t: 12, b: 24 };
    const pts = seriesList.flatMap(s => s.points); if (!pts.length) return '<div class="empty">No data yet</div>';
    let tMin = Math.min(...pts.map(p => p.t)), tMax = Math.max(...pts.map(p => p.t)); if (tMin === tMax) { tMin -= DAY; tMax += DAY; }
    const vals = pts.map(p => p.v).concat(opts.band ? opts.band : []);
    let vMin = Math.min(...vals), vMax = Math.max(...vals); const pad = (vMax - vMin) * 0.12 || 1; vMin -= pad; vMax += pad;
    const x = t => P.l + (t - tMin) / (tMax - tMin) * (W - P.l - P.r);
    const y = v => H - P.b - (v - vMin) / (vMax - vMin) * (H - P.t - P.b);
    let g = '';
    if (opts.band) { const [a, b] = opts.band; g += `<rect x="${P.l}" y="${y(b)}" width="${W - P.l - P.r}" height="${Math.max(1, y(a) - y(b))}" fill="rgba(60,207,145,.08)" stroke="rgba(60,207,145,.35)" stroke-dasharray="3 3"/>`; g += `<text x="${W - P.r - 4}" y="${y(b) - 3}" text-anchor="end">${esc(opts.bandLabel || 'reference')}</text>`; }
    for (let i = 0; i <= 4; i++) { const v = vMin + (vMax - vMin) * i / 4; g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="#1a2740"/><text x="${P.l - 6}" y="${y(v) + 3}" text-anchor="end">${(+v.toFixed(Math.abs(vMax - vMin) < 8 ? 1 : 0))}</text>`; }
    const ticks = opts.labels || [0, 0.5, 1].map(f => ({ t: tMin + f * (tMax - tMin), l: opts.tfmt ? opts.tfmt(tMin + f * (tMax - tMin)) : 'Day ' + missionDay(tMin + f * (tMax - tMin)) }));
    ticks.forEach((k, i) => { const anc = i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'; g += `<text x="${x(k.t)}" y="${H - 6}" text-anchor="${anc}">${esc(k.l)}</text>`; });
    seriesList.forEach(s => {
      if (!s.points.length) return;
      const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
      s.points.forEach(p => { const out = opts.band && (p.v < opts.band[0] || p.v > opts.band[1]); g += `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${out ? 4 : 2.6}" fill="${out ? '#f2b440' : s.color}" stroke="#070b14" stroke-width="1"><title>${esc(s.label || '')} ${p.v} ${esc(opts.unit || '')} — ${esc(p.lab || fmtTime(p.t))}</title></circle>`; });
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || 'chart')}">${g}</svg>`;
  }
  function metricChart(metric, h) {
    const m = M[metric]; const s1 = E.series(S.records, metric);
    const list = [{ points: s1, color: '#36d6e7', label: m.dual ? 'Systolic' : m.label }];
    if (m.dual) list.push({ points: E.series(S.records, metric, 'value2'), color: '#7aa7ff', label: 'Diastolic', dash: true });
    return lineChart(list, { band: m.dual ? null : m.ref, bandLabel: 'documented reference', unit: m.unit, h: h || 180, aria: m.label + ' trend' });
  }
  function spark(metric) {
    const s = E.series(S.records, metric).slice(-14); if (s.length < 2) return '';
    const vs = s.map(p => p.v); const mn = Math.min(...vs), mx = Math.max(...vs) || 1; const W = 120, H = 30;
    const d = s.map((p, i) => `${i ? 'L' : 'M'}${(i / (s.length - 1) * W).toFixed(1)},${(H - 3 - (p.v - mn) / ((mx - mn) || 1) * (H - 6)).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="30" aria-hidden="true"><path d="${d}" fill="none" stroke="#36d6e7" stroke-width="1.6"/></svg>`;
  }

  /* ---------------- Views ---------------- */
  const VIEWS = {};
  const NAV = [
    ['dashboard', 'Mission Dashboard', '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>'],
    ['log', 'Log Measurement', '<path d="M12 5v14M5 12h14"/>'],
    ['body', 'Interactive Body', '<circle cx="12" cy="4.5" r="2.5"/><path d="M12 7v8M7 10h10M12 15l-3.5 6M12 15l3.5 6"/>'],
    ['alerts', 'Health Intelligence', '<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/>'],
    ['risk', 'Mission Risk Center', '<path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6z"/>'],
    ['nasa', 'NASA Data (OSDR)', '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'],
    ['profile', 'Astronaut Profile', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'],
    ['sync', 'Sync & Reports', '<path d="M4 12a8 8 0 0114-5.3L20 9M20 12a8 8 0 01-14 5.3L4 15"/><path d="M20 4v5h-5M4 20v-5h5"/>'],
    ['ground', 'Ground Console', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>'],
    ['crew', 'Crew & Missions', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c2 .8 3.2 2.6 3.7 5.5"/>', 'astronauts.view'],
    ['records', 'Measurements Database', '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M8 12h8M8 16h5"/>', 'measurements.view'],
    ['review', 'Alert Review', '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9"/>', 'alerts.view'],
    ['users', 'Users & Roles', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/><path d="M19 3l2 2-4 4"/>', 'users.manage'],
    ['audit', 'Audit Log', '<path d="M8 3h8l4 4v14H4V3z"/><path d="M8 11h8M8 15h8M8 7h4"/>', 'audit.view'],
    ['about', 'About & References', '<path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4z"/><path d="M8 9h8M8 13h6"/>']
  ];

  function shell() {
    document.getElementById('root').innerHTML = `
    <div class="app">
      <aside id="side">
        <div class="brand">
          ${symbol(38)}
          <div><b>ASTRA VITAL</b><small>NYXARA NOVA · HEALTH MONITOR</small></div>
        </div>
        <nav>${navItems().map(n => ({ ground: '<div class="sep">EARTH SIDE</div>', crew: '<div class="sep">MISSION CONTROL · API</div>', about: '<div class="sep">PROJECT</div>' }[n[0]] || '') + `<a href="#${n[0]}" data-v="${n[0]}"><svg viewBox="0 0 24 24">${n[2]}</svg>${n[1]}</a>`).join('')}</nav>
        <div class="userbox"><b>${esc(SESSION.user.full_name)}</b><span>${esc(SESSION.user.role_label)}${SESSION.user.is_demo ? ' · <span class="demo-tag">PUBLIC DEMO</span>' : ''}</span><span class="dim">${esc(SESSION.user.email)}</span><button class="btn" id="logout" type="button">Sign out</button></div>
        <div class="disclaimer">Prototype for the 2026 NASA Space Apps Challenge by team NYXARA NOVA. Not an official NASA product. Not a medical device: it does not diagnose and does not replace flight surgeons or official protocols.</div>
      </aside>
      <main>
        <div class="topbar">
          <div class="row"><button class="btn menu-btn" id="menu" aria-label="Open menu"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><h1 id="title">Mission Dashboard</h1></div>
          <div class="meta" id="meta"></div>
        </div>
        <div class="content" id="view"></div>
      </main>
    </div>
    <div id="report"></div>`;
    $('#menu').onclick = () => $('#side').classList.toggle('open');
    $('#logout').onclick = logout;
  }
  const navItems = () => NAV.filter(n => !n[3] || can(n[3]));

  function renderMeta() {
    const a = alerts(); const st = E.status(a); const los = S.link === 'LOS';
    const since = Math.round((Date.now() - S.lastContact) / 3600000 * 10) / 10;
    $('#meta').innerHTML = `
      <label class="pill astro-pick" title="Astronaut shown in the crew-side modules">Crew <select id="astro" aria-label="Select astronaut">${SESSION.astronauts.map(x => `<option value="${x.id}" ${x.id === SESSION.astronaut.id ? 'selected' : ''}>${esc(x.code)}</option>`).join('')}</select></label>
      ${S.profile.synthetic ? '<span class="pill demo" title="All values of this astronaut are synthetic">DEMO · SYNTHETIC DATA</span>' : ''}
      <span class="pill" title="Ground store: Flask + SQLite API on Render"><span class="dot" style="background:var(--ok)"></span>API · ${esc(SESSION.user.role_label)}</span>
      <span class="pill">Mission day <b class="mono">${missionDay()}</b> / ${S.profile.missionDays}</span>
      <span class="pill"><span class="dot" style="background:${los ? 'var(--warn)' : 'var(--ok)'}"></span>${los ? 'Earth link: LOS' : 'Earth link: AOS'} · last contact ${since} h ago</span>
      <span class="pill">Queue <b class="mono">${S.queue.length}</b></span>
      ${badge(st)}`;
    $('#astro').onchange = e => selectAstronaut(Number(e.target.value));
  }

  function route() {
    const v = (location.hash || '#dashboard').slice(1).split('?')[0];
    const view = VIEWS[v] && navItems().some(n => n[0] === v) ? v : 'dashboard';
    $$('nav a').forEach(a => a.classList.toggle('active', a.dataset.v === view));
    $('#title').textContent = NAV.find(n => n[0] === view)[1];
    $('#side').classList.remove('open');
    renderMeta();
    const prev = $('#view'); const el = prev.cloneNode(false); prev.replaceWith(el); // stale async renders write into the detached node
    el.className = 'content fade';
    VIEWS[view](el);
    window.scrollTo(0, 0);
  }
  function refresh() { save(); route(); }

  /* ---- Dashboard ---- */
  const ROUTINE = [
    ['hr', 'Morning resting heart rate'], ['bp', 'Morning blood pressure'], ['spo2', 'Oxygen saturation'], ['temp', 'Body temperature'],
    ['sleep', 'Log last sleep period'], ['fatigue', 'Fatigue self-check'], ['mood', 'Mood / well-being check-in'], ['activity', 'Log exercise session']
  ];
  function routineDone(metric) { const t0 = new Date(); t0.setUTCHours(0, 0, 0, 0); return S.records.some(r => r.metric === metric && r.ts >= t0.getTime() && r.origin === 'crew'); }

  VIEWS.dashboard = el => {
    const a = alerts(); const st = E.status(a); const counts = { priority: 0, followup: 0, info: 0 }; a.forEach(x => counts[x.level]++);
    const color = st === 'priority' ? 'var(--crit)' : st === 'followup' ? 'var(--warn)' : 'var(--ok)';
    const msg = st === 'priority' ? 'At least one indicator needs attention now. Open the priority alert for the recommended action.' : st === 'followup' ? 'No emergency. Some indicators changed and should be followed up at the next medical conference.' : 'All monitored indicators are within your baseline and documented references.';
    const done = ROUTINE.filter(r => routineDone(r[0])).length;
    const env = ENVS[S.profile.env];
    el.innerHTML = `
    <div class="grid g3">
      <div class="card span2">
        <h2>Overall status <span class="muted" style="text-transform:none;letter-spacing:0">${esc(S.profile.id)} · ${esc(S.profile.role)}</span></h2>
        <div class="status-hero">
          <div class="status-ring" style="border-color:${color};color:${color}">${ICON[st === 'nominal' ? 'ok' : st]}</div>
          <div><h3 style="font-size:20px">${LEVEL[st]}</h3><div class="muted">${msg}</div>
          <div class="row" style="margin-top:10px">${badge('priority', counts.priority + ' priority')}${badge('followup', counts.followup + ' follow-up')}${badge('info', counts.info + ' informative')}</div></div>
        </div>
      </div>
      <div class="card">
        <h2>Mission</h2>
        <div class="kpi"><div class="v">Day ${missionDay()}<small>of ${S.profile.missionDays}</small></div><div class="progress"><i style="width:${Math.min(100, missionDay() / S.profile.missionDays * 100)}%"></i></div></div>
        <div class="muted" style="margin-top:10px;font-size:12.5px">${esc(env.label)} · ${esc(env.g)}<br>Signal delay: ${esc(env.delay)}<br>Last Earth contact: ${fmtTime(S.lastContact)}</div>
      </div>
    </div>
    <div class="grid g4" style="margin-top:16px">${['hr', 'bp', 'spo2', 'temp', 'sleep', 'activity', 'fatigue', 'mood'].map(k => {
      const r = latest(k); const m = M[k]; const lvl = a.find(x => x.metric === k && x.level !== 'info') ? (a.find(x => x.metric === k && x.level === 'priority') ? 'priority' : 'followup') : 'ok';
      return `<a class="card" href="#alerts" style="text-decoration:none;color:inherit"><div class="row between"><span class="muted" style="font-size:12px">${esc(m.label.split(' (')[0])}</span>${badge(lvl)}</div><div class="kpi"><div class="v">${valStr(r)}<small>${esc(m.unit)}</small></div><div class="l">${r ? fmtTime(r.ts) : 'no data'}</div></div>${spark(k)}</a>`;
    }).join('')}</div>
    <div class="grid g3" style="margin-top:16px">
      <div class="card span2"><h2>Active alerts <a class="btn" href="#alerts">Open Health Intelligence</a></h2>${a.filter(x => x.level !== 'info').slice(0, 4).map(alertHtml).join('') || '<div class="empty">No active follow-up or priority alerts.</div>'}</div>
      <div class="card"><h2>Today's health routine <span class="badge b-info">${done}/${ROUTINE.length}</span></h2>
        <div class="muted" style="font-size:12px;margin-bottom:6px">Streak: <b>${S.streak} days</b> · Health points: <b>${S.points}</b></div>
        ${ROUTINE.map(r => `<div class="check"><input type="checkbox" disabled ${routineDone(r[0]) ? 'checked' : ''} aria-label="${esc(r[1])}"><span style="flex:1">${esc(r[1])}</span>${routineDone(r[0]) ? '<span class="dim" style="font-size:12px">done</span>' : `<a href="#log?m=${r[0]}" class="btn" style="padding:4px 9px;font-size:12px">Log</a>`}</div>`).join('')}
        <div class="hint">Items tick automatically when you log the measurement today. Completing all items adds 50 points and keeps the streak.</div>
      </div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h2>Sleep trend (h)</h2>${metricChart('sleep')}</div>
      <div class="card"><h2>Blood pressure trend (mmHg)</h2>${metricChart('bp')}<div class="legend"><span><i style="background:#36d6e7"></i>Systolic</span><span><i style="background:#7aa7ff"></i>Diastolic</span></div></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Latest records <a class="btn" href="#sync">All records & export</a></h2>${recordsTable(S.records.slice().sort((a, b) => b.ts - a.ts).slice(0, 8))}</div>`;
    bindAlerts(el);
  };

  function recordsTable(list) {
    if (!list.length) return '<div class="empty">No records.</div>';
    return `<div class="tablewrap"><table><thead><tr><th>Time (UTC)</th><th>Day</th><th>Indicator</th><th>Value</th><th>Reference</th><th>Source</th><th>Quality</th><th>Sync</th></tr></thead><tbody>${list.map(r => {
      const m = M[r.metric]; const q = E.checkQuality(r);
      return `<tr><td class="num">${fmtTime(r.ts).slice(0, 16)}</td><td class="num">${missionDay(r.ts)}</td><td>${esc(m.label)}</td><td class="num">${esc(valStr(r))} ${esc(m.unit)}</td><td class="num dim">${m.dual ? '<120/<80' : m.ref.join('–')}</td><td>${r.source === 'Synthetic demo data' ? '<span class="badge b-syn">synthetic</span>' : esc(r.source)}</td><td>${q.ok ? '<span class="badge b-ok">valid</span>' : `<span class="badge b-info" title="${esc(q.reason)}">rejected</span>`}</td><td>${S.queue.includes(r.id) ? '<span class="badge b-followup">queued</span>' : '<span class="badge b-ok">on ground</span>'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  /* ---- Alerts ---- */
  function alertHtml(a) {
    const acked = S.acked.includes(a.id);
    return `<div class="alert ${a.level}" data-id="${esc(a.id)}">
      <div class="head" tabindex="0" role="button" aria-expanded="false"><div><b>${esc(a.title)}</b><div class="muted" style="font-size:12.5px">${esc(a.changed)}</div></div><div class="row">${acked ? '<span class="badge b-ok">acknowledged</span>' : ''}${badge(a.level)}</div></div>
      <div class="more" hidden><dl>
        <dt>1. What changed</dt><dd>${esc(a.changed)}</dd>
        <dt>2. Indicator</dt><dd>${esc(M[a.metric] ? M[a.metric].label : a.metric)}${a.hazards ? ' · related hazards: ' + a.hazards.map(h => esc(HAZARDS[h].name)).join(', ') : ''}</dd>
        <dt>3. Why it matters</dt><dd>${esc(a.why)}</dd>
        <dt>4. Suggested action</dt><dd>${esc(a.action)}</dd>
        <dt>5. Medical team</dt><dd>${esc(a.contact)}</dd>
      </dl><div class="src">Rule(s): ${esc((a.rules || [a.rule]).join(' + '))} · Basis: ${(a.src || []).map(k => esc(E.SOURCES[k])).join(' | ')}</div>
      <div class="row" style="margin-top:10px"><button class="btn ack" ${acked ? 'disabled' : ''}>Acknowledge</button><a class="btn" href="#body?s=${M[a.metric] ? M[a.metric].system : 'general'}">See on body map</a></div></div>
    </div>`;
  }
  function bindAlerts(el) {
    $$('.alert .head', el).forEach(h => { const tog = () => { const m = h.nextElementSibling; m.hidden = !m.hidden; h.setAttribute('aria-expanded', String(!m.hidden)); }; h.onclick = tog; h.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } }; });
    $$('.alert .ack', el).forEach(b => b.onclick = () => { const id = b.closest('.alert').dataset.id; if (!S.acked.includes(id)) S.acked.push(id); save(); b.disabled = true; b.closest('.alert').querySelector('.head .row').insertAdjacentHTML('afterbegin', '<span class="badge b-ok">acknowledged</span>'); toast('Alert acknowledged. It stays visible until the data change.'); });
  }

  VIEWS.alerts = el => {
    const a = alerts(); let filter = 'all';
    const draw = () => {
      const list = a.filter(x => filter === 'all' || x.level === filter);
      el.innerHTML = `
      <div class="card" style="margin-bottom:16px"><h2>How the engine works</h2>
        <div class="muted">ASTRA VITAL uses a transparent, rule-based engine (no black-box AI). For every valid record it checks: <b>(1) data quality</b> — plausibility and consistency; <b>(2) missing data</b> — gaps in the daily routine; <b>(3) documented references</b> — published adult reference ranges (AHA, ACC/AHA, CDC, AASM, ADA); <b>(4) personal baseline</b> — deviation ≥2 SD from your own first 7 values; <b>(5) 7-day trend</b> — change larger than 2 baseline SD. Each alert shows the rule and its source. Results are associations, not diagnoses.</div></div>
      <div class="tabs" role="tablist">${['all', 'priority', 'followup', 'info'].map(f => `<button class="tab ${f === filter ? 'active' : ''}" data-f="${f}" role="tab">${f === 'all' ? 'All' : LEVEL[f]} (${f === 'all' ? a.length : a.filter(x => x.level === f).length})</button>`).join('')}</div>
      ${list.map(alertHtml).join('') || '<div class="empty">No alerts in this category.</div>'}`;
      $$('.tab', el).forEach(b => b.onclick = () => { filter = b.dataset.f; draw(); });
      bindAlerts(el);
    };
    draw();
  };

  /* ---- Log ---- */
  VIEWS.log = el => {
    const pre = (location.hash.split('m=')[1] || 'hr').replace(/[^a-z0-9]/g, '');
    el.innerHTML = `<div class="grid g2">
    <div class="card"><h2>New measurement</h2>
      <form id="f" novalidate>
        <div class="field"><label for="metric">Indicator</label><select id="metric">${Object.keys(M).map(k => `<option value="${k}" ${k === pre ? 'selected' : ''}>${esc(M[k].label)} (${esc(M[k].unit)})</option>`).join('')}</select></div>
        <div class="row" style="align-items:flex-start"><div class="field" style="flex:1"><label for="val" id="vlabel">Value</label><input id="val" inputmode="decimal" autocomplete="off"></div>
        <div class="field" style="flex:1" id="v2wrap" hidden><label for="val2">Diastolic (mmHg)</label><input id="val2" inputmode="decimal"></div></div>
        <div class="field"><label for="ts">Date & time</label><input id="ts" type="datetime-local"></div>
        <div class="field"><label for="src">Data source</label><select id="src"><option>Manual entry</option><option>Onboard medical kit device (manual transcription)</option><option>Self-report questionnaire</option><option>Exercise device log (manual transcription)</option></select><div class="hint">ASTRA VITAL does not connect to sensors in this prototype; values are entered by the crew member.</div></div>
        <div class="field"><label for="note">Notes / symptoms (optional)</label><textarea id="note" rows="2" maxlength="300"></textarea></div>
        <div class="err" id="err" role="alert"></div>
        <button class="btn primary" type="submit"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Save</button>
        <span class="hint" style="margin-left:8px">Saved on this device first and queued; with the Earth link open (AOS) it is sent at once to the ground store (Render API, SQLite).</span>
      </form></div>
    <div class="card"><h2>How to measure <span id="mname" class="muted" style="text-transform:none;letter-spacing:0"></span></h2><div id="how" class="muted"></div><div id="mchart" style="margin-top:12px"></div></div></div>`;
    const HOW = {
      hr: 'Measure after waking, seated, before exercise or caffeine. Count for 60 s or use the kit monitor. Documented adult resting range: 60–100 bpm (AHA).',
      bp: 'Sit 5 min, back supported, arm at heart level, same arm each time. Two readings 1 min apart; log the average. Spaceflight fluid shifts and gravity transitions can change blood pressure regulation.',
      spo2: 'Warm finger, stay still 30 s, read when the value is stable. Typical healthy range 95–100%. Low readings can be artifacts — always re-measure.',
      temp: 'Same site and time each day. Fever: ≥38.0 °C (CDC). Immune changes are documented during spaceflight.',
      sleep: 'Log total time asleep in the last sleep period (hours). Adults: ≥7 h recommended (AASM). ISS crews averaged ~6 h (Barger et al. 2014).',
      activity: 'Total minutes of prescribed exercise completed today (resistive + aerobic). ISS crews exercise about 2 h/day (NASA).',
      fatigue: 'Samn-Perelli scale: 1 fully alert · 2 very lively · 3 okay, somewhat fresh · 4 a little tired · 5 moderately tired · 6 extremely tired · 7 completely exhausted.',
      mood: '1 very low · 2 low · 3 neutral · 4 good · 5 very good. A self-report check-in; changes relative to your own baseline matter most.',
      glucose: 'Use the onboard glucometer per kit instructions. Normal fasting 70–99 mg/dL; <70 mg/dL is hypoglycemia (ADA).'
    };
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16); $('#ts').value = now;
    const upd = () => { const k = $('#metric').value; const m = M[k]; $('#v2wrap').hidden = !m.dual; $('#vlabel').textContent = m.dual ? 'Systolic (mmHg)' : `Value (${m.unit})`; $('#how').textContent = HOW[k]; $('#mname').textContent = m.label; $('#mchart').innerHTML = metricChart(k, 170); $('#src').value = (k === 'fatigue' || k === 'mood' || k === 'sleep') ? 'Self-report questionnaire' : k === 'activity' ? 'Exercise device log (manual transcription)' : 'Manual entry'; };
    $('#metric').onchange = upd; upd();
    $('#f').onsubmit = e => {
      e.preventDefault(); const k = $('#metric').value; const m = M[k];
      const ts = new Date($('#ts').value).getTime();
      const rec = { id: uid(), metric: k, ts, value: $('#val').value.trim() === '' ? '' : Number($('#val').value.replace(',', '.')), value2: m.dual ? Number($('#val2').value.replace(',', '.')) : null, unit: m.unit, source: $('#src').value, note: $('#note').value.trim(), version: 1, synced: false, origin: 'crew' };
      if (isNaN(ts)) { $('#err').textContent = 'Enter a valid date and time.'; return; }
      if (ts > Date.now() + 5 * 60000) { $('#err').textContent = 'Time cannot be in the future.'; return; }
      const q = E.checkQuality(rec);
      if (!q.ok) { $('#err').textContent = q.reason + '. Please check the value.'; return; }
      rec.hash = E.hashRecord(rec);
      const before = routineDone(k);
      S.records.push(rec); S.queue.push(rec.id);
      if (!before) { S.points += 10; if (ROUTINE.every(r => routineDone(r[0]))) { S.points += 50; S.streak += 1; toast('Daily routine complete — streak ' + S.streak + ' days.'); } }
      save();
      const a = E.analyze(S.records).filter(x => x.metric === k && x.level !== 'info');
      const msg = a.length ? `<b>${a.length} alert(s)</b> for ${esc(m.label)} — see Health Intelligence.` : 'No follow-up needed for this indicator.';
      $('#val').value = ''; $('#val2').value = ''; $('#note').value = ''; $('#err').textContent = '';
      upd(); renderMeta();
      if (S.link === 'AOS') { syncNow(true).then(() => toast((S.queue.includes(rec.id) ? 'Saved locally; still queued (see Sync log). ' : 'Saved and confirmed by the ground store (SQLite on Render). ') + msg)); }
      else toast('Saved locally and queued for sync (LOS). ' + msg);
    };
  };

  /* ---- Body ---- */
  const SYSTEMS = {
    cardio: { name: 'Cardiovascular System', metrics: ['hr', 'bp'], hazards: ['G', 'E', 'R'],
      text: 'In weightlessness, body fluids shift toward the head and the heart and vessels adapt. Astronauts can experience changes in heart rhythm and blood pressure regulation, and orthostatic intolerance (dizziness when standing) after returning to gravity. Radiation is studied as a possible long-term contributor to cardiovascular disease.' },
    musculo: { name: 'Musculoskeletal System', metrics: ['activity'], hazards: ['G'],
      text: 'Without gravity loading, weight-bearing bones lose on average 1%–1.5% of their density per month during 4–6-month missions, and muscles lose mass and strength (NASA HRP). Daily resistive and aerobic exercise is the main countermeasure, so ASTRA VITAL tracks exercise against the ~2 h/day prescription. Bone density itself cannot be measured with this prototype.' },
    nervous: { name: 'Nervous System & Behavioral Health', metrics: ['sleep', 'fatigue', 'mood'], hazards: ['I', 'D', 'E'],
      text: 'Isolation, confinement, workload, distance from family and disrupted light cycles can affect sleep, fatigue, mood and team performance. The vestibular system also adapts to altered gravity (space motion sickness, balance changes). ASTRA VITAL tracks sleep, Samn-Perelli fatigue and a mood check-in.' },
    immune: { name: 'Immune System', metrics: ['temp'], hazards: ['E', 'R'],
      text: 'Spaceflight is associated with immune dysregulation and reactivation of latent viruses. In a closed environment, microbes and contaminants circulate. Body temperature is tracked as a simple, measurable sign; laboratory immune markers (see NASA Data: Inspiration4 CBC) are not available onboard in this prototype.' },
    general: { name: 'General Health', metrics: ['spo2', 'glucose'], hazards: ['E', 'G'],
      text: 'Oxygen saturation reflects how well blood is oxygenated and can be affected by cabin atmosphere (closed environment). Blood glucose relates to nutrition and metabolism, which change with activity level and diet during missions.' }
  };
  function zoneLevel(sys) { const a = alerts().filter(x => SYSTEMS[sys].metrics.includes(x.metric)); return a.some(x => x.level === 'priority') ? 'priority' : a.some(x => x.level === 'followup') ? 'followup' : 'ok'; }
  VIEWS.body = el => {
    let sel = (location.hash.split('s=')[1] || 'cardio').replace(/[^a-z]/g, ''); if (!SYSTEMS[sel]) sel = 'cardio';
    const C = { ok: '#3ccf91', followup: '#f2b440', priority: '#ff5d6c' };
    const draw = () => {
      const z = k => C[zoneLevel(k)];
      const s = SYSTEMS[sel]; const a = alerts().filter(x => s.metrics.includes(x.metric));
      el.innerHTML = `<div class="body-wrap">
        <div class="card"><h2>Select a body system</h2>
          <svg class="body-svg" viewBox="0 0 220 440" role="group" aria-label="Interactive human body">
            <g class="zone" data-s="general" tabindex="0" role="button" aria-label="General health"><path d="M110 8c18 0 30 13 30 31s-12 33-30 33-30-15-30-33 12-31 30-31zM80 84c-28 4-44 16-46 40l-10 110c-1 9 9 12 12 4l20-98 6 0-4 120 4 160c0 10 16 10 17 0l9-150h4l9 150c1 10 17 10 17 0l4-160-4-120 6 0 20 98c3 8 13 5 12-4l-10-110c-2-24-18-36-46-40z" fill="#13233b" stroke="${sel === 'general' ? '#e8eef8' : z('general')}" stroke-width="${sel === 'general' ? 2.5 : 1.5}"/></g>
            <g class="zone" data-s="nervous" tabindex="0" role="button" aria-label="Nervous system and behavioral health"><ellipse cx="110" cy="36" rx="20" ry="17" fill="${z('nervous')}" fill-opacity=".35" stroke="${sel === 'nervous' ? '#fff' : z('nervous')}" stroke-width="2"/><path d="M110 56v100" stroke="${z('nervous')}" stroke-width="3" stroke-dasharray="4 3"/></g>
            <g class="zone" data-s="cardio" tabindex="0" role="button" aria-label="Cardiovascular system"><path d="M118 112c8-10 24-4 20 10-3 10-20 22-20 22s-17-12-20-22c-4-14 12-20 20-10z" fill="${z('cardio')}" fill-opacity=".55" stroke="${sel === 'cardio' ? '#fff' : z('cardio')}" stroke-width="2"/></g>
            <g class="zone" data-s="immune" tabindex="0" role="button" aria-label="Immune system"><circle cx="90" cy="168" r="11" fill="${z('immune')}" fill-opacity=".4" stroke="${sel === 'immune' ? '#fff' : z('immune')}" stroke-width="2"/><circle cx="96" cy="98" r="5" fill="${z('immune')}" fill-opacity=".6"/><circle cx="124" cy="98" r="5" fill="${z('immune')}" fill-opacity=".6"/><circle cx="96" cy="210" r="5" fill="${z('immune')}" fill-opacity=".6"/><circle cx="124" cy="210" r="5" fill="${z('immune')}" fill-opacity=".6"/></g>
            <g class="zone" data-s="musculo" tabindex="0" role="button" aria-label="Musculoskeletal system"><path d="M92 236l-4 150M128 236l4 150M68 120l-14 104M152 120l14 104" stroke="${z('musculo')}" stroke-width="7" stroke-linecap="round" stroke-opacity=".55"/><path d="M96 220h28" stroke="${z('musculo')}" stroke-width="7" stroke-linecap="round" stroke-opacity=".55"/>${sel === 'musculo' ? `<path d="M92 236l-4 150M128 236l4 150" stroke="#fff" stroke-width="1.5"/>` : ''}</g>
          </svg>
          <div class="legend" style="justify-content:center"><span><i style="background:#3ccf91"></i>Nominal</span><span><i style="background:#f2b440"></i>Follow-up</span><span><i style="background:#ff5d6c"></i>Priority</span></div>
          <div class="tabs" style="margin-top:12px">${Object.keys(SYSTEMS).map(k => `<button class="tab ${k === sel ? 'active' : ''}" data-s="${k}">${esc(SYSTEMS[k].name.split(' ')[0])}</button>`).join('')}</div>
        </div>
        <div>
          <div class="card"><h2>${esc(s.name)} ${badge(zoneLevel(sel))}</h2><p style="margin-top:0">${esc(s.text)}</p>
            <div class="row">${s.hazards.map(h => `<span class="badge" style="color:${HAZARDS[h].color};border-color:${HAZARDS[h].color}55">${esc(HAZARDS[h].name)}</span>`).join('')}</div></div>
          <div class="grid g2" style="margin-top:16px">${s.metrics.map(k => { const r = latest(k); const b = E.baseline(S.records, k); return `<div class="card"><h2>${esc(M[k].label)}</h2><div class="kpi"><div class="v">${valStr(r)}<small>${esc(M[k].unit)}</small></div><div class="l">Baseline: ${b ? b.mean.toFixed(1) + ' ± ' + b.sd.toFixed(1) : 'not enough data'} · Reference: ${M[k].dual ? '<120/<80' : M[k].ref.join('–')} ${esc(M[k].unit)}</div></div>${metricChart(k, 160)}</div>`; }).join('')}</div>
          <div class="card" style="margin-top:16px"><h2>Alerts for this system</h2>${a.map(alertHtml).join('') || '<div class="empty">No alerts for this system.</div>'}</div>
        </div></div>`;
      $$('[data-s]', el).forEach(z2 => { const go = () => { sel = z2.dataset.s; history.replaceState(null, '', '#body?s=' + sel); draw(); }; z2.onclick = go; z2.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
      bindAlerts(el);
    };
    draw();
  };

  /* ---- Risk Center ---- */
  const RISKS = {
    R: { desc: 'Outside Earth\'s protective magnetic field and atmosphere, crews are exposed to galactic cosmic rays and solar particle events. NASA considers radiation one of the most hazardous aspects of spaceflight.', risks: ['Increased lifetime cancer risk', 'Possible central nervous system effects', 'Possible degenerative tissue effects (e.g., cardiovascular, cataracts)', 'Acute radiation effects during large solar particle events'], ind: ['Not measured by ASTRA VITAL (requires dosimeters)', 'Indirect: temperature, fatigue, blood counts in lab data'], prev: ['Shielding and storm shelters during solar particle events', 'Dose monitoring with dosimeters and mission planning'], lim: 'ASTRA VITAL does not measure radiation dose. Linking vital signs to radiation exposure would require dosimetry data.' },
    I: { desc: 'Small crews living and working in a confined space for months, with limited privacy and contact with family, can experience behavioral and team-performance problems.', risks: ['Adverse behavioral conditions (mood, anxiety)', 'Sleep loss and circadian misalignment', 'Reduced team cohesion and performance'], ind: ['Sleep duration', 'Fatigue (Samn-Perelli)', 'Mood check-in'], prev: ['Crew selection and training', 'Private psychological conferences and family contact', 'Planned leisure, exercise and sleep schedules'], lim: 'Self-reported scores are subjective. ASTRA VITAL compares each person with their own baseline instead of population norms.' },
    D: { desc: 'As crews travel farther, resupply, evacuation and real-time support from Earth become harder; a Mars mission could last about 3 years with communication delays of many minutes.', risks: ['Limited onboard medical capability', 'Delayed guidance from flight surgeons', 'Crew must make more health decisions autonomously'], ind: ['All indicators — the tool supports self-assessment', 'Time since last Earth contact', 'Sync queue status'], prev: ['Offline-first tools and onboard medical checklists', 'Crew medical training', 'Store-and-forward medical reports'], lim: 'Communication delay is shown per mission environment; ASTRA VITAL does not model real link budgets.' },
    G: { desc: 'Three gravity fields matter: weightlessness in transit, partial gravity on the Moon (1/6 g) or Mars (3/8 g), and Earth gravity on return. Each transition affects bones, muscles, balance and the cardiovascular system.', risks: ['Bone loss: on average 1%–1.5% density per month (4–6-month missions)', 'Muscle atrophy and loss of strength', 'Orthostatic intolerance and cardiovascular deconditioning', 'Sensorimotor/vestibular changes and spaceflight-associated neuro-ocular syndrome (SANS)'], ind: ['Exercise minutes vs. prescription', 'Heart rate', 'Blood pressure'], prev: ['~2 h/day of resistive and aerobic exercise', 'Adequate nutrition and vitamin D', 'Post-flight reconditioning'], lim: 'Bone density, muscle mass and eye changes need imaging that this prototype does not perform.' },
    E: { desc: 'The spacecraft is a closed ecosystem: temperature, pressure, lighting, noise, CO2, microbes and the immune response all affect health.', risks: ['Immune dysregulation and infection', 'Effects of CO2 and air quality', 'Noise and lighting affecting sleep', 'Microbial contamination'], ind: ['Oxygen saturation', 'Body temperature', 'Sleep duration', 'Fatigue'], prev: ['Environmental monitoring (CO2, O2, microbes)', 'Lighting schedules for circadian health', 'Hygiene and pre-flight health stabilization'], lim: 'ASTRA VITAL does not read cabin sensors; it reminds the crew to check cabin readouts when SpO2 is low.' }
  };
  VIEWS.risk = el => {
    const a = alerts(); const env = ENVS[S.profile.env];
    el.innerHTML = `<div class="card" style="margin-bottom:16px"><h2>NASA's five hazards of human spaceflight (RIDGE)</h2><div class="muted">NASA's Human Research Program groups spaceflight risks into five hazards. ASTRA VITAL links each indicator to these hazards so the crew understands <i>why</i> a measurement matters. Current environment: <b>${esc(env.label)}</b> (${esc(env.g)}, signal delay ${esc(env.delay)}). Change it in Astronaut Profile.</div></div>
    <div class="grid g2">${Object.keys(RISKS).map(k => { const r = RISKS[k]; const h = HAZARDS[k]; const act = a.filter(x => x.hazards && x.hazards.includes(k) && x.level !== 'info'); return `
      <div class="hazard"><div class="row" style="margin-bottom:8px"><div class="letter" style="color:${h.color};border-color:${h.color}66">${k}</div><div style="flex:1"><h3 style="margin:0">${esc(h.name)}</h3><span class="muted" style="font-size:12px">${act.length ? act.length + ' related active alert(s)' : 'No related active alerts'}</span></div>${act.length ? badge(act.some(x => x.level === 'priority') ? 'priority' : 'followup') : badge('ok')}</div>
        <p style="margin:0 0 8px">${esc(r.desc)}</p>
        <b style="font-size:12px;color:var(--muted)">RELATED HEALTH RISKS</b><ul>${r.risks.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <b style="font-size:12px;color:var(--muted)">INDICATORS IN ASTRA VITAL</b><ul>${r.ind.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <b style="font-size:12px;color:var(--muted)">DOCUMENTED PREVENTIVE MEASURES</b><ul>${r.prev.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="hint" style="margin-top:8px"><b>Limitation:</b> ${esc(r.lim)}</div></div>`; }).join('')}
      <div class="hazard"><h3>Sources</h3><div class="ref">${esc(E.SOURCES.NASA_HRP)} https://www.nasa.gov/hrp/hazards/</div><div class="ref">${esc(E.SOURCES.NASA_BONE)}</div><div class="ref">${esc(E.SOURCES.NASA_EXERCISE)}</div><div class="ref">${esc(E.SOURCES.BARGER_2014)}</div></div>
    </div>`;
  };

  /* ---- NASA data (real OSDR) ---- */
  VIEWS.nasa = el => {
    const TP = ['L-92', 'L-44', 'L-3', 'R+1', 'R+45', 'R+82', 'R+194']; const TD = { 'L-92': 0, 'L-44': 1, 'L-3': 2, 'R+1': 3, 'R+45': 4, 'R+82': 5, 'R+194': 6 };
    const COLORS = ['#36d6e7', '#7aa7ff', '#b48cff', '#3ccf91'];
    const VARS = { glucose_mg_dL: ['Glucose', 'mg/dL', 'glucose_min', 'glucose_max', 'OSD-575'], calcium_mg_dL: ['Calcium', 'mg/dL', 'calcium_min', 'calcium_max', 'OSD-575'], potassium_mmol_L: ['Potassium', 'mmol/L', 'potassium_min', 'potassium_max', 'OSD-575'], creatinine_mg_dL: ['Creatinine', 'mg/dL', 'creatinine_min', 'creatinine_max', 'OSD-575'], wbc_k_uL: ['White blood cells', '×10³/µL', null, null, 'OSD-569'], hemoglobin_g_dL: ['Hemoglobin', 'g/dL', 'hgb_min', 'hgb_max', 'OSD-569'], platelets_k_uL: ['Platelets', '×10³/µL', null, null, 'OSD-569'] };
    let v = 'glucose_mg_dL';
    // run the same plausibility idea on real data: platelets < 50 with otherwise normal CBC flagged as suspect
    const qc = OSDR.map(r => { const issues = []; Object.keys(VARS).forEach(k => { const [n, u, lo, hi] = VARS[k]; if (lo && (r[k] < r[lo] || r[k] > r[hi])) issues.push(`${n} ${r[k]} ${u} outside lab range ${r[lo]}–${r[hi]}`); }); if (r.platelets_k_uL < 50) issues.push(`Platelets ${r.platelets_k_uL} ×10³/µL is inconsistent with other values from the same sample (possible entry/unit error) — excluded from trends`); return { r, issues }; }).filter(x => x.issues.length);
    const draw = () => {
      const [n, u, lo, hi, osd] = VARS[v];
      const series = ['C001', 'C002', 'C003', 'C004'].map((c, i) => ({ label: c, color: COLORS[i], points: OSDR.filter(r => r.crew === c && !(v === 'platelets_k_uL' && r[v] < 50)).map(r => ({ t: TD[r.timepoint] * DAY, v: r[v], lab: c + ' ' + r.timepoint })).sort((a, b) => a.t - b.t) }));
      const band = lo ? [Math.max(...OSDR.map(r => r[lo])), Math.min(...OSDR.map(r => r[hi]))] : null;
      el.innerHTML = `
      <div class="card" style="margin-bottom:16px"><h2>Real NASA open data <span class="badge b-real">REAL DATA · NASA OSDR</span></h2>
        <div class="muted">These are real clinical laboratory values from the four civilian crew members of the SpaceX Inspiration4 mission (3 days in orbit, September 2021), published in NASA's Open Science Data Repository. Sampling: pre-flight L-92, L-44, L-3 days and post-flight R+1, R+45, R+82, R+194 days. ASTRA VITAL uses them to <b>(a)</b> demonstrate comparison of a value with the laboratory reference range of each sample, <b>(b)</b> test the data-quality checks on real data, and <b>(c)</b> show crews what pre/post-flight lab monitoring looks like. With n = 4 and a 3-day mission, changes cannot be attributed to spaceflight.</div></div>
      <div class="tabs">${Object.keys(VARS).map(k => `<button class="tab ${k === v ? 'active' : ''}" data-v="${k}">${esc(VARS[k][0])}</button>`).join('')}</div>
      <div class="grid g3"><div class="card span2"><h2>${esc(n)} (${esc(u)}) · ${osd} <span class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</span></h2>
        ${lineChart(series, { band, bandLabel: band ? 'lab reference range (common to all samples)' : '', unit: u, h: 240, labels: TP.map(t => ({ t: TD[t] * DAY, l: t })), aria: n + ' Inspiration4' })}
        <div class="hint">Points outside the lab reference range are highlighted in amber. X axis: sampling timepoints in days before launch (L-) and after return (R+), evenly spaced (not to scale). Values are not interpreted clinically.</div></div>
        <div class="card"><h2>Dataset</h2><table style="table-layout:fixed;word-break:break-word"><colgroup><col style="width:80px"><col></colgroup><tbody>
        <tr><td class="muted">ID</td><td><b>${osd}</b></td></tr>
        <tr><td class="muted">Title</td><td>${osd === 'OSD-575' ? 'SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays' : 'Whole Blood Measurements from the SpaceX Inspiration4 Mission (RNA-seq, epitranscriptome, WGS, clonal hematopoiesis, CBC)'}</td></tr>
        <tr><td class="muted">File</td><td class="mono" style="font-size:11px">${osd === 'OSD-575' ? 'LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv' : 'LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv'}</td></tr>
        <tr><td class="muted">Organism</td><td>Homo sapiens (4 civilian astronauts)</td></tr>
        <tr><td class="muted">Factors</td><td>Spaceflight, Time</td></tr>
        <tr><td class="muted">Link</td><td><a href="https://osdr.nasa.gov/bio/repo/data/studies/${osd}" target="_blank" rel="noopener">osdr.nasa.gov/…/${osd}</a></td></tr></tbody></table></div></div>
      <div class="card" style="margin-top:16px"><h2>Quality & reference checks on the real data (${qc.length} samples flagged)</h2>
        <div class="tablewrap"><table><thead><tr><th>Crew</th><th>Timepoint</th><th>Findings</th></tr></thead><tbody>${qc.map(x => `<tr><td>${x.r.crew}</td><td class="mono">${x.r.timepoint}</td><td>${x.issues.map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table></div>
        <div class="hint">Out-of-range lab values are common in healthy people and are not diagnoses. Shown to demonstrate the reference-comparison logic.</div></div>`;
      $$('.tab', el).forEach(b => b.onclick = () => { v = b.dataset.v; draw(); });
    };
    draw();
  };

  /* ---- Profile ---- */
  VIEWS.profile = el => {
    const p = S.profile; const a = alerts();
    el.innerHTML = `<div class="grid g2">
      <div class="card"><h2>Astronaut profile <span class="badge b-syn">fictional</span></h2>
        <form id="pf">
          <div class="grid g2" style="gap:10px"><div class="field"><label>Crew ID</label><input id="p_id" value="${esc(p.id)}" maxlength="20"></div><div class="field"><label>Role</label><input id="p_role" value="${esc(p.role)}" maxlength="40"></div></div>
          <div class="field"><label>Display name</label><input id="p_name" value="${esc(p.name)}" maxlength="60"></div>
          <div class="field"><label>Mission</label><input id="p_mission" value="${esc(p.mission)}" maxlength="80"></div>
          <div class="grid g2" style="gap:10px"><div class="field"><label>Mission length (days)</label><input id="p_days" type="number" min="1" max="1500" value="${p.missionDays}"></div>
          <div class="field"><label>Environment</label><select id="p_env">${Object.keys(ENVS).map(k => `<option value="${k}" ${k === p.env ? 'selected' : ''}>${esc(ENVS[k].label)}</option>`).join('')}</select></div></div>
          <div class="err" id="perr"></div>${can('astronauts.manage') ? '<button class="btn primary">Save profile</button><div class="hint">Saved in the ground database (astronaut and mission records).</div>' : '<div class="hint">Read-only for your role: only an Administrator can edit astronaut and mission records.</div>'}</form></div>
      <div class="card"><h2>Personal baselines (first 7 valid values)</h2><table><thead><tr><th>Indicator</th><th>Baseline</th><th>Latest</th><th>Documented reference</th></tr></thead><tbody>${Object.keys(M).map(k => { const b = E.baseline(S.records, k); const r = latest(k); return `<tr><td>${esc(M[k].label)}</td><td class="num">${b ? b.mean.toFixed(1) + ' ± ' + b.sd.toFixed(1) : '—'}</td><td class="num">${esc(valStr(r))}</td><td class="num dim">${M[k].dual ? '<120/<80' : M[k].ref.join('–')} ${esc(M[k].unit)}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="card"><h2>Sleep & exercise history</h2>${metricChart('sleep', 150)}${metricChart('activity', 150)}</div>
      <div class="card"><h2>Well-being history</h2>${lineChart([{ points: E.series(S.records, 'fatigue'), color: '#f2b440', label: 'Fatigue' }, { points: E.series(S.records, 'mood'), color: '#b48cff', label: 'Mood' }], { h: 170, aria: 'fatigue and mood' })}<div class="legend"><span><i style="background:#f2b440"></i>Fatigue (1–7, higher = more tired)</span><span><i style="background:#b48cff"></i>Mood (1–5, higher = better)</span></div></div>
      <div class="card span2"><h2>Event & alert history</h2><div class="tablewrap"><table><thead><tr><th>Level</th><th>Event</th><th>Detail</th></tr></thead><tbody>${a.map(x => `<tr><td>${badge(x.level)}</td><td>${esc(x.title)}</td><td class="muted">${esc(x.changed)}</td></tr>`).join('')}${S.inbox.map(n => `<tr><td><span class="badge b-real">ground note</span></td><td>Flight surgeon note</td><td>${esc(n.text)} <span class="dim">(${fmtTime(n.ts)})</span></td></tr>`).join('')}</tbody></table></div></div></div>`;
    if (!can('astronauts.manage')) $$('#pf input, #pf select', el).forEach(i => { i.disabled = true; });
    $('#pf').onsubmit = async e => { e.preventDefault(); if (!can('astronauts.manage')) return; const d = Number($('#p_days').value); if (!$('#p_id').value.trim()) { $('#perr').textContent = 'Crew ID is required.'; return; } if (!(d >= 1 && d <= 1500)) { $('#perr').textContent = 'Mission length must be 1–1500 days.'; return; }
      const a = SESSION.astronaut; const mi = a.mission;
      try {
        await api('/astronauts/' + a.id, { method: 'PUT', body: { code: $('#p_id').value.trim().toUpperCase(), full_name: $('#p_name').value.trim(), role_on_board: $('#p_role').value.trim(), status: a.status, demo_age: a.demo_age, notes: a.notes, mission_id: a.mission_id || 0 } });
        if (mi && can('missions.manage')) await api('/missions/' + mi.id, { method: 'PUT', body: { code: mi.code, name: $('#p_mission').value.trim() || mi.name, environment: $('#p_env').value, start_date: mi.start_date, duration_days: d, status: mi.status, description: mi.description } });
        await selectAstronaut(a.id, true); toast('Profile saved in the ground database.');
      } catch (err) { $('#perr').textContent = errText(err); }
    };
  };

  /* ---- Sync & Reports ---- */
  let syncing = null;
  function syncNow(silent) {
    if (S.link !== 'AOS') { if (!silent) toast('No Earth link (LOS). Records stay queued on this device.'); return Promise.resolve(); }
    if (syncing) return syncing;
    syncing = (async () => {
      const BATCH = 5; let sent = 0, rejected = 0, batches = 0, newAlerts = 0;
      while (S.queue.length && S.link === 'AOS') {
        if (S.dropNext && batches >= 1) { S.dropNext = false; S.link = 'LOS'; log(`Link dropped during transfer after ${sent} records. ${S.queue.length} remain queued; transfer will resume at next AOS.`); break; }
        const ids = S.queue.slice(0, BATCH); batches++;
        for (const id of ids) {
          const r = S.records.find(x => x.id === id);
          if (!r) { S.queue = S.queue.filter(q => q !== id); continue; }
          try {
            const res = await api('/measurements', { method: 'POST', body: toServer(r) });
            r.serverId = res.item.id; r.synced = true; S.queue = S.queue.filter(q => q !== id); sent++;
            newAlerts += res.alerts.filter(x => x.level !== 'info').length;
          } catch (e) {
            if (SESSION.ended) return;
            if (e.network) { S.link = 'LOS'; log(`Link lost: ${e.message} ${S.queue.length} record(s) remain queued; they will be sent at the next AOS.`); break; }
            if (e.status === 422) { S.queue = S.queue.filter(q => q !== id); S.records = S.records.filter(x => x.id !== id); rejected++; log(`Ground store rejected ${M[r.metric].label} ${valStr(r)} (${fmtTime(r.ts)}): ${errText(e)}`); continue; }
            log(`Sync stopped: ${e.message}`); S.link = 'LOS'; break;
          }
        }
        save(); // persisted after every batch → resumes after interruption
      }
      const notes = S.ground.notes.filter(n => !n.delivered); if (S.link === 'AOS') { notes.forEach(n => { n.delivered = true; S.inbox.push(n); }); S.lastContact = Date.now(); }
      if (sent) await reloadAstronautData();
      log(`Uplink: ${sent} record(s) stored in SQLite by the ground API${rejected ? `, ${rejected} rejected by validation` : ''}${newAlerts ? `, ${newAlerts} new ground alert(s)` : ''}. Downlink: ${S.link === 'AOS' ? notes.length : 0} flight-surgeon note(s).`);
      save(); refresh();
      if (!silent) toast(`Sync finished: ${sent} sent, ${S.queue.length} still queued.`);
    })().finally(() => { syncing = null; });
    return syncing;
  }
  function log(t) { S.syncLog.unshift(`${fmtTime(Date.now())}  ${t}`); S.syncLog = S.syncLog.slice(0, 60); }
  function download(name, text, type) { const b = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function csv() { const h = ['id', 'utc_time', 'mission_day', 'indicator', 'value', 'value2', 'unit', 'source', 'quality', 'quality_reason', 'synced', 'note']; return [h.join(',')].concat(S.records.slice().sort((a, b) => a.ts - b.ts).map(r => { const q = E.checkQuality(r); return [r.id, new Date(r.ts).toISOString(), missionDay(r.ts), r.metric, r.value, r.value2 == null ? '' : r.value2, r.unit, r.source, q.ok ? 'valid' : 'rejected', q.reason || '', S.queue.includes(r.id) ? 'queued' : 'on_ground', r.note || ''].map(x => `"${String(x).replace(/"/g, '""')}"`).join(','); })).join('\n'); }
  function reportHtml() {
    const a = alerts(); const p = S.profile;
    const rows = Object.keys(M).map(k => { const b = E.baseline(S.records, k); const r = latest(k); return `<tr><td>${esc(M[k].label)}</td><td>${esc(valStr(r))} ${esc(M[k].unit)}</td><td>${r ? fmtTime(r.ts) : '—'}</td><td>${b ? b.mean.toFixed(1) + ' ± ' + b.sd.toFixed(1) : '—'}</td><td>${M[k].dual ? '<120/<80' : M[k].ref.join('–')}</td></tr>`; }).join('');
    return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">${symbol(44).replace('#E8EEF8', '#0B1220')}<div><b style="letter-spacing:.14em;font-size:13pt">ASTRA VITAL</b><br><span style="font-size:8pt;letter-spacing:.08em;color:#555">INTELLIGENT ASTRONAUT HEALTH MONITORING · NYXARA NOVA</span></div></div><h1 style="margin:0">Earth Medical Report</h1><p>Generated ${fmtTime(Date.now())} · Crew ${esc(p.id)} (${esc(p.name)}) · ${esc(p.mission)} · Mission day ${missionDay()}<br><b>DEMO REPORT — all crew values are synthetic. Prototype, not a medical device.</b></p>
      <h2>Overall status: ${LEVEL[E.status(a)]}</h2><p>Sync state: ${S.queue.length} record(s) not yet confirmed by ground. Last Earth contact ${fmtTime(S.lastContact)}.</p>
      <h2>Indicators</h2><table style="width:100%;border-collapse:collapse"><tr><th align="left">Indicator</th><th align="left">Latest</th><th align="left">Time</th><th align="left">Personal baseline</th><th align="left">Reference</th></tr>${rows}</table>
      <h2>Alerts (${a.length})</h2>${a.map(x => `<p><b>[${LEVEL[x.level]}] ${esc(x.title)}</b><br>${esc(x.changed)}<br>Why: ${esc(x.why)}<br>Action: ${esc(x.action)}<br>Medical team: ${esc(x.contact)}</p>`).join('')}
      <h2>Crew observations</h2>${S.records.filter(r => r.note).map(r => `<p>${fmtTime(r.ts)} — ${esc(M[r.metric].label)}: ${esc(r.note)}</p>`).join('') || '<p>None recorded.</p>'}
      <h2>References</h2>${Object.values(E.SOURCES).map(s => `<p style="font-size:9pt">${esc(s)}</p>`).join('')}`;
  }
  VIEWS.sync = el => {
    const los = S.link === 'LOS';
    el.innerHTML = `<div class="grid g2">
      <div class="card"><h2>Offline-first sync</h2>
        <p class="muted" style="margin-top:0">Every record is saved on this device first (browser local storage) and placed in a queue. When the Earth link is available (AOS), the queue is transferred in batches of 5 to the <b>ground store — the ASTRA VITAL Flask API on Render, which stores each record in SQLite</b> — and is removed from the queue only after the server confirms it. Invalid values are rejected by the server's validation and logged. The AOS/LOS switch simulates the communication windows of a real mission; with LOS, nothing is sent.</p>
        <div class="row" style="margin-bottom:12px"><span class="pill"><span class="dot" style="background:${los ? 'var(--warn)' : 'var(--ok)'}"></span>${los ? 'LOS — no link' : 'AOS — link available'}</span><span class="pill">Queued: <b class="mono">${S.queue.length}</b></span><span class="pill">On ground (SQLite): <b class="mono">${S.ground.records.length}</b></span><span class="pill">Storage: ${S._persist === false ? 'memory only (storage blocked)' : 'persistent'}</span></div>
        <div class="row"><button class="btn" id="link">${los ? 'Simulate communication window (AOS)' : 'Simulate loss of signal (LOS)'}</button><button class="btn primary" id="sync" ${los ? 'disabled' : ''}>Sync now</button></div>
        <label class="row" style="margin-top:12px;gap:8px;cursor:pointer"><input type="checkbox" id="drop" style="width:auto" ${S.dropNext ? 'checked' : ''}> Inject a link drop after the first batch (test recovery)</label>
        <h2 style="margin-top:16px">Sync log</h2><div class="log" aria-live="polite">${S.syncLog.map(esc).join('\n')}</div></div>
      <div class="card"><h2>Earth medical reports</h2>
        <p class="muted" style="margin-top:0">Reports include indicators, baselines, alerts, crew notes, references and sync status.</p>
        <div class="row"><button class="btn primary" id="pdf"><svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/></svg>Print / save as PDF</button><button class="btn" id="html">Download report (.html)</button><button class="btn" id="csv">Export CSV</button><button class="btn" id="json">Backup (.json)</button></div>
        <div class="row" style="margin-top:8px"><button class="btn" id="ccsv">Copy CSV to clipboard</button><button class="btn" id="crep">Copy report text</button></div>
        <div class="hint">Some embedded viewers block printing and downloads; the copy buttons always work.</div>
        <h2 style="margin-top:16px">Restore / reset</h2>
        <div class="row"><label class="btn" style="margin:0">Restore backup<input type="file" id="restore" accept="application/json" hidden></label><button class="btn danger" id="reset">Discard local queue &amp; reload from ground</button></div>
        <div class="hint">Restore re-queues the records of a backup that are not yet on the ground. Discard removes records still queued on this device (click twice to confirm) and reloads the ground copy.</div></div>
      <div class="card span2"><h2>All records (${S.records.length})</h2>${recordsTable(S.records.slice().sort((a, b) => b.ts - a.ts))}</div></div>`;
    $('#link').onclick = () => { S.link = los ? 'AOS' : 'LOS'; log(los ? 'Communication window opened (AOS).' : 'Loss of signal (LOS).'); if (los) S.lastContact = Date.now(); refresh(); };
    $('#sync').onclick = () => syncNow(false);
    $('#drop').onchange = e => { S.dropNext = e.target.checked; save(); };
    $('#pdf').onclick = () => { $('#report').innerHTML = reportHtml(); try { window.print(); } catch (e) { toast('Printing is blocked here — use "Download report (.html)" and print it.'); } };
    $('#html').onclick = () => download(`astra-vital-report-${fmtDate(Date.now())}.html`, `<!doctype html><meta charset="utf-8"><title>ASTRA VITAL report</title><body style="font-family:Arial;max-width:900px;margin:auto;padding:20px">${reportHtml()}</body>`, 'text/html');
    $('#csv').onclick = () => download(`astra-vital-records-${fmtDate(Date.now())}.csv`, csv(), 'text/csv');
    $('#json').onclick = () => download(`astra-vital-backup-${fmtDate(Date.now())}.json`, JSON.stringify(S, null, 1), 'application/json');
    $('#restore').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const d = JSON.parse(t); if (!Array.isArray(d.records)) throw new Error('Not an ASTRA VITAL backup');
      const have = new Set(S.records.map(r => r.metric + '|' + r.ts + '|' + r.value + '|' + r.value2)); let n = 0;
      d.records.filter(r => M[r.metric] && E.checkQuality(r).ok && r.source !== 'Synthetic demo data' && !have.has(r.metric + '|' + r.ts + '|' + r.value + '|' + r.value2)).forEach(r => { const rec = Object.assign({}, r, { id: uid(), serverId: undefined, synced: false }); rec.hash = E.hashRecord(rec); S.records.push(rec); S.queue.push(rec.id); n++; });
      refresh(); toast(`Backup read: ${n} record(s) queued for the ground store.`); } catch (err) { toast('Could not restore: ' + esc(err.message)); } }); };
    let armed = false;
    $('#reset').onclick = async () => { if (!armed) { armed = true; $('#reset').textContent = 'Click again to confirm'; setTimeout(() => { armed = false; const b = $('#reset'); if (b) b.textContent = 'Discard local queue & reload from ground'; }, 4000); return; }
      S.records = S.records.filter(r => !S.queue.includes(r.id)); S.queue = []; save(); await reloadAstronautData(); refresh(); toast('Local queue discarded; ground copy reloaded.'); };
    const copy = (txt, what) => { try { navigator.clipboard.writeText(txt).then(() => toast(what + ' copied to clipboard.'), () => toast('Clipboard blocked by this viewer.')); } catch (e) { toast('Clipboard not available here.'); } };
    $('#ccsv').onclick = () => copy(csv(), 'CSV');
    $('#crep').onclick = () => { const d = document.createElement('div'); d.innerHTML = reportHtml(); copy(d.innerText, 'Report'); };
  };

  /* ---- Ground console ---- */
  VIEWS.ground = el => {
    const gr = S.ground.records; const a = E.analyze(gr, Date.now());
    el.innerHTML = `<div class="card" style="margin-bottom:16px"><h2>Flight surgeon console (Earth side)</h2><div class="muted">This view only sees what has actually been synchronized to the ground store (Flask + SQLite on Render). Records still queued on the spacecraft are not visible here — this shows the effect of communication gaps. ${can('alerts.manage') ? 'As ' + esc(SESSION.user.role_label) + ' you can review the stored alerts below.' : 'Reviewing stored alerts requires the Doctor or Administrator role.'}</div></div>
    <div class="grid g4"><div class="card kpi"><div class="l">Records received</div><div class="v">${gr.length}</div></div><div class="card kpi"><div class="l">Pending on spacecraft</div><div class="v">${S.queue.length}</div></div><div class="card kpi"><div class="l">Last data received</div><div class="v" style="font-size:15px">${fmtTime(S.ground.receivedAt)}</div></div><div class="card kpi"><div class="l">Ground-side status</div><div class="v" style="font-size:18px">${badge(E.status(a))}</div></div></div>
    <div class="grid g2" style="margin-top:16px"><div class="card"><h2>Alerts computed from received data</h2>${a.filter(x => x.level !== 'info').map(alertHtml).join('') || '<div class="empty">None</div>'}</div>
    <div class="card span2" id="galerts"><h2>Alerts stored on the ground (SQLite) <span class="badge b-real">RENDER API</span></h2><div class="empty">Loading…</div></div>
    <div class="card"><h2>Send a note to the crew</h2><div class="field"><label for="gn">Note (delivered at next sync)</label><textarea id="gn" rows="3" maxlength="300" placeholder="e.g., Reviewed sleep trend — let's discuss at Friday's PMC."></textarea></div><div class="err" id="gerr"></div><button class="btn primary" id="gsend">Queue note for uplink</button>
      <h2 style="margin-top:16px">Notes</h2>${S.ground.notes.map(n => `<div class="ref">${esc(n.text)}<br><span class="dim">${fmtTime(n.ts)} · ${n.delivered ? 'delivered to crew' : 'waiting for next sync'}</span></div>`).join('') || '<div class="empty">No notes yet.</div>'}</div></div>`;
    bindAlerts(el);
    renderGroundAlerts($('#galerts'), SESSION.astronaut.id);
    $('#gsend').onclick = () => { const t = $('#gn').value.trim(); if (t.length < 3) { $('#gerr').textContent = 'Write a note first.'; return; } S.ground.notes.push({ id: uid(), text: t, ts: Date.now(), delivered: false }); refresh(); toast('Note queued. It reaches the crew at the next sync.'); };
  };

  /* ---- About ---- */
  VIEWS.about = el => {
    el.innerHTML = `<div class="grid g2">
    <div class="card"><div class="row" style="gap:16px;margin-bottom:14px">${symbol(64)}<div><div style="font-size:24px;font-weight:700;letter-spacing:.14em">ASTRA VITAL</div><div class="muted" style="font-size:12px;letter-spacing:.1em">INTELLIGENT ASTRONAUT HEALTH MONITORING SYSTEM · BY NYXARA NOVA</div></div></div><h2>About the project</h2>
      <p style="margin-top:0">Built by team <b>NYXARA NOVA</b> (Trujillo, Peru) for the 2026 NASA Space Apps Challenge "Create Health Monitoring Software for Astronauts on Space Missions". <i>We control the unseen.</i></p>
      <p>Goal: help astronauts log health indicators, compare them with documented references and with their own baseline, understand how they relate to NASA's five hazards, and know what to do and when to involve the medical team — even without a link to Earth.</p>
      <h3>Data honesty</h3><ul><li><span class="badge b-real">REAL</span> NASA OSDR Inspiration4 lab data (OSD-575, OSD-569) in the NASA Data view.</li><li><span class="badge b-syn">SYNTHETIC</span> All crew vital signs in the demo are generated by a seeded algorithm to show a realistic scenario (sleep decline, rising fatigue, one low SpO2 reading, a missing day, a typing error). They are not astronaut measurements.</li><li>Reference ranges come from published guidelines (below). Rules marked "engine convention" are engineering choices, not clinical thresholds.</li></ul>
      <h3>Not a medical device</h3><p class="muted">ASTRA VITAL does not diagnose disease and does not replace flight surgeons or official protocols. Suggested actions are conservative and general.</p>
      <h3>Use of AI</h3><p class="muted">The health engine is rule-based; no machine-learning model runs in the app. The team used an AI assistant (Claude, by Anthropic) to help write and review code and documentation; all rules and sources were checked by the team.</p></div>
    <div class="card"><h2>References</h2>${Object.entries(E.SOURCES).map(([k, s]) => `<div class="ref">${esc(s)}</div>`).join('')}
      <div class="ref">NASA Open Science Data Repository — OSD-575 and OSD-569 (SpaceX Inspiration4). https://osdr.nasa.gov/</div>
      <div class="ref">Overbey et al. / Costes et al., "Inspiration4 data access through the NASA Open Science Data Repository", npj Microgravity 10:56 (2024).</div>
      <div class="ref">NASA Space Apps Challenge 2026 — Create Health Monitoring Software for Astronauts on Space Missions.</div>
      <h2 style="margin-top:14px">Team</h2><div class="muted">Etner Therry Rios Vasquez (team owner) · Jeanfranco Alfredo Ibarra Kocfú · Darlin Saldaña Pinedo · Máximo Fabrizzio Espinoza Peche</div></div></div>`;
  };

  /* ================= Academic edition: Mission Control modules (Flask + SQLite API on Render) ================= */
  const fmtIso = iso => iso ? iso.slice(0, 16).replace('T', ' ') + ' UTC' : '—';
  const LV = { priority: 'priority', followup: 'followup', info: 'info', nominal: 'ok' };
  const statusBadge = st => badge(LV[st] === 'ok' ? 'nominal' : LV[st] || 'ok');
  function loading(el, what) { if (!el.isConnected) return; el.innerHTML = `<div class="card"><div class="empty">Loading ${esc(what)} from the ground store…</div></div>`; }
  function failed(el, e) { if (!SESSION.ended) el.innerHTML = `<div class="card"><div class="err">${esc(errText(e))}</div></div>`; }
  function formVals(form) { const o = {}; $$('[name]', form).forEach(i => { o[i.name] = i.type === 'checkbox' ? i.checked : i.value.trim(); }); return o; }
  function showErr(form, e) { const box = $('.err', form); if (box) box.textContent = errText(e); }

  /* ---- server alerts (Ground Console + Alert Review) ---- */
  function serverAlertHtml(a) {
    const review = can('alerts.manage') ? `<form class="row rv" data-id="${a.id}" style="margin-top:8px"><select name="status" aria-label="Status">${['open', 'acknowledged', 'resolved'].map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select><input name="review_notes" maxlength="1000" placeholder="Review notes" value="${esc(a.review_notes)}" style="flex:1;min-width:160px"><button class="btn primary">Save review</button><span class="err"></span></form>` : '';
    return `<div class="alert ${a.level}" data-sid="${a.id}"><div class="head" tabindex="0" role="button" aria-expanded="false"><div><b>${esc(a.title)}</b><div class="muted" style="font-size:12.5px">${esc(a.astronaut_code)} · ${esc(a.what_changed)}</div></div><div class="row"><span class="badge ${a.status === 'open' ? 'b-followup' : 'b-ok'}">${esc(a.status)}</span>${badge(a.level)}</div></div>
      <div class="more" hidden><dl><dt>Why it matters</dt><dd>${esc(a.why)}</dd><dt>Suggested action</dt><dd>${esc(a.action)}</dd><dt>Medical team</dt><dd>${esc(a.contact)}</dd>${a.reviewed_by ? `<dt>Review</dt><dd>${esc(a.reviewed_by)} · ${fmtIso(a.reviewed_at)}${a.review_notes ? ' — ' + esc(a.review_notes) : ''}</dd>` : ''}</dl><div class="src">Rule: ${esc(a.rule)} · Basis: ${esc(a.source_ref)} · Stored ${fmtIso(a.created_at)}</div>${review}</div></div>`;
  }
  function bindServerAlerts(el, after) {
    $$('.alert .head', el).forEach(h => { const tog = () => { const m = h.nextElementSibling; m.hidden = !m.hidden; h.setAttribute('aria-expanded', String(!m.hidden)); }; h.onclick = tog; h.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } }; });
    $$('form.rv', el).forEach(f => f.onsubmit = async e => { e.preventDefault(); try { await api('/alerts/' + f.dataset.id, { method: 'PATCH', body: formVals(f) }); toast('Review saved in the ground database.'); after(); } catch (err) { showErr(f, err); } });
  }
  async function renderGroundAlerts(box, astronautId) {
    try {
      const items = (await api('/alerts?astronaut_id=' + astronautId)).items.filter(a => a.level !== 'info');
      if (!box.isConnected) return;
      box.innerHTML = `<h2>Alerts stored on the ground (SQLite) <span class="badge b-real">RENDER API</span></h2>${items.slice(0, 12).map(serverAlertHtml).join('') || '<div class="empty">No stored follow-up or priority alerts.</div>'}<div class="hint">Generated by the server copy of the rule engine when each record reached the ground. ${items.length > 12 ? `Showing 12 of ${items.length}; see Alert Review.` : ''}</div>`;
      bindServerAlerts(box, () => renderGroundAlerts(box, astronautId));
    } catch (e) { if (box.isConnected) box.innerHTML = `<div class="err">${esc(errText(e))}</div>`; }
  }

  VIEWS.review = async el => {
    let st = 'open', lv = '', astro = '';
    const draw = async () => {
      loading(el, 'alerts');
      try {
        const q = `?status=${st}${lv ? '&level=' + lv : ''}${astro ? '&astronaut_id=' + astro : ''}`;
        const items = (await api('/alerts' + q)).items; if (!el.isConnected) return;
        el.innerHTML = `<div class="card" style="margin-bottom:16px"><h2>Alert review (ground database)</h2><div class="muted">Alerts persisted in SQLite by the ground API for every astronaut. ${can('alerts.manage') ? 'Doctors and administrators can acknowledge or resolve them with notes.' : 'Your role can view alerts; reviewing requires the Doctor or Administrator role.'}</div>
          <div class="row" style="margin-top:10px"><select id="fs">${['open', 'acknowledged', 'resolved'].map(s => `<option ${s === st ? 'selected' : ''}>${s}</option>`).join('')}</select><select id="fl"><option value="">all levels</option>${['priority', 'followup', 'info'].map(s => `<option value="${s}" ${s === lv ? 'selected' : ''}>${LEVEL[s]}</option>`).join('')}</select><select id="fa"><option value="">all astronauts</option>${SESSION.astronauts.map(a => `<option value="${a.id}" ${String(a.id) === astro ? 'selected' : ''}>${esc(a.code)}</option>`).join('')}</select><span class="pill">${items.length} alert(s)</span></div></div>
          ${items.map(serverAlertHtml).join('') || '<div class="card"><div class="empty">No alerts match the filters.</div></div>'}`;
        $('#fs').onchange = e => { st = e.target.value; draw(); }; $('#fl').onchange = e => { lv = e.target.value; draw(); }; $('#fa').onchange = e => { astro = e.target.value; draw(); };
        bindServerAlerts(el, draw);
      } catch (e) { failed(el, e); }
    };
    draw();
  };

  /* ---- Crew & Missions ---- */
  VIEWS.crew = async el => {
    let editing = null, editingMission = null;
    const draw = async () => {
      loading(el, 'crew and missions');
      try {
        const [as, ms] = await Promise.all([api('/astronauts'), api('/missions')]); if (!el.isConnected) return;
        SESSION.astronauts = as.items;
        const manage = can('astronauts.manage'), mmanage = can('missions.manage');
        const a = editing === 'new' ? { code: '', full_name: '', role_on_board: '', status: 'active', demo_age: '', notes: '', mission_id: 0 } : as.items.find(x => x.id === editing);
        const m = editingMission === 'new' ? { code: '', name: '', environment: 'station', start_date: new Date().toISOString().slice(0, 10), duration_days: 180, status: 'planned', description: '' } : ms.items.find(x => x.id === editingMission);
        el.innerHTML = `<div class="grid g2">
          <div class="card span2"><h2>Astronauts (${as.items.length}) ${manage ? '<button class="btn primary" id="anew">+ New astronaut</button>' : ''}</h2>
            <div class="tablewrap"><table><thead><tr><th>Code</th><th>Name</th><th>Role</th><th>Mission</th><th>Status</th><th>Health</th><th>Records</th><th>Data</th><th></th></tr></thead><tbody>${as.items.map(x => `<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.full_name)}</td><td>${esc(x.role_on_board || '—')}</td><td>${x.mission ? esc(x.mission.code) : '—'}</td><td>${esc(x.status)}</td><td>${statusBadge(x.overall_status)}</td><td class="num">${x.measurements}</td><td>${x.is_synthetic ? '<span class="badge b-syn">synthetic</span>' : '<span class="badge b-real">recorded</span>'}</td>
              <td class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn" data-open="${x.id}">Open</button>${manage ? `<button class="btn" data-edit="${x.id}">Edit</button><button class="btn danger" data-del="${x.id}">Delete</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>
          ${a ? `<div class="card"><h2>${editing === 'new' ? 'New astronaut' : 'Edit ' + esc(a.code)}</h2><form id="af" novalidate>
            <div class="grid g2" style="gap:10px"><div class="field"><label>Code</label><input name="code" value="${esc(a.code)}" maxlength="30" placeholder="AV-CREW-05" required></div><div class="field"><label>Role on board</label><input name="role_on_board" value="${esc(a.role_on_board)}" maxlength="60"></div></div>
            <div class="field"><label>Full name (fictional for demos)</label><input name="full_name" value="${esc(a.full_name)}" maxlength="120"></div>
            <div class="grid g2" style="gap:10px"><div class="field"><label>Age (demo)</label><input name="demo_age" type="number" min="18" max="80" value="${a.demo_age || ''}"></div><div class="field"><label>Status</label><select name="status">${['active', 'inactive', 'returned'].map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
            <div class="field"><label>Mission</label><select name="mission_id"><option value="0">— No mission —</option>${ms.items.map(mm => `<option value="${mm.id}" ${mm.id === a.mission_id ? 'selected' : ''}>${esc(mm.code)} · ${esc(mm.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Notes</label><textarea name="notes" rows="2" maxlength="1000">${esc(a.notes)}</textarea></div>
            <div class="err"></div><div class="row"><button class="btn primary">Save astronaut</button><button class="btn" type="button" id="acancel">Cancel</button></div></form></div>` : ''}
          <div class="card ${a ? '' : 'span2'}"><h2>Missions (${ms.items.length}) ${mmanage ? '<button class="btn primary" id="mnew">+ New mission</button>' : ''}</h2>
            <div class="tablewrap"><table><thead><tr><th>Code</th><th>Name</th><th>Environment</th><th>Start</th><th>Days</th><th>Status</th><th>Crew</th><th></th></tr></thead><tbody>${ms.items.map(x => `<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.name)}</td><td>${esc(ENVS[x.environment] ? ENVS[x.environment].label : x.environment)}</td><td class="num">${esc(x.start_date)}</td><td class="num">${x.duration_days}</td><td>${esc(x.status)}</td><td class="num">${x.astronauts}</td><td class="row" style="gap:6px;flex-wrap:nowrap">${mmanage ? `<button class="btn" data-medit="${x.id}">Edit</button><button class="btn danger" data-mdel="${x.id}">Delete</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
            ${m ? `<form id="mf" novalidate style="margin-top:12px"><h2>${editingMission === 'new' ? 'New mission' : 'Edit ' + esc(m.code)}</h2>
              <div class="grid g2" style="gap:10px"><div class="field"><label>Code</label><input name="code" value="${esc(m.code)}" maxlength="30" placeholder="AV-MARS-500"></div><div class="field"><label>Name</label><input name="name" value="${esc(m.name)}" maxlength="120"></div></div>
              <div class="grid g2" style="gap:10px"><div class="field"><label>Environment</label><select name="environment">${['station', 'spacecraft', 'moon', 'mars', 'analog'].map(k => `<option value="${k}" ${k === m.environment ? 'selected' : ''}>${esc(ENVS[k].label)}</option>`).join('')}</select></div><div class="field"><label>Status</label><select name="status">${['planned', 'active', 'completed'].map(s => `<option ${s === m.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
              <div class="grid g2" style="gap:10px"><div class="field"><label>Start date</label><input name="start_date" type="date" value="${esc(m.start_date)}"></div><div class="field"><label>Duration (days)</label><input name="duration_days" type="number" min="1" max="1500" value="${m.duration_days}"></div></div>
              <div class="field"><label>Description</label><textarea name="description" rows="2" maxlength="1000">${esc(m.description)}</textarea></div>
              <div class="err"></div><div class="row"><button class="btn primary">Save mission</button><button class="btn" type="button" id="mcancel">Cancel</button></div></form>` : ''}</div></div>`;
        $$('[data-open]', el).forEach(b => b.onclick = async () => { await selectAstronaut(Number(b.dataset.open)); location.hash = '#dashboard'; });
        $$('[data-edit]', el).forEach(b => b.onclick = () => { editing = Number(b.dataset.edit); draw(); });
        $$('[data-medit]', el).forEach(b => b.onclick = () => { editingMission = Number(b.dataset.medit); draw(); });
        if ($('#anew')) $('#anew').onclick = () => { editing = 'new'; draw(); };
        if ($('#mnew')) $('#mnew').onclick = () => { editingMission = 'new'; draw(); };
        if ($('#acancel')) $('#acancel').onclick = () => { editing = null; draw(); };
        if ($('#mcancel')) $('#mcancel').onclick = () => { editingMission = null; draw(); };
        $$('[data-del]', el).forEach(b => b.onclick = async () => {
          const x = as.items.find(y => y.id === Number(b.dataset.del)); if (!confirmTwice(b)) return;
          try { await api(`/astronauts/${x.id}?confirm=yes`, { method: 'DELETE' }); toast(`Astronaut ${esc(x.code)} and related records deleted.`); if (x.id === SESSION.astronaut.id) await selectAstronaut(null, true); draw(); } catch (e) { toast(esc(errText(e))); }
        });
        $$('[data-mdel]', el).forEach(b => b.onclick = async () => {
          const x = ms.items.find(y => y.id === Number(b.dataset.mdel)); if (!confirmTwice(b)) return;
          try { await api(`/missions/${x.id}`, { method: 'DELETE' }); toast(`Mission ${esc(x.code)} deleted.`); draw(); } catch (e) { toast(esc(errText(e))); }
        });
        if ($('#af')) $('#af').onsubmit = async e => { e.preventDefault(); const v = formVals(e.target); v.code = v.code.toUpperCase();
          try { const r = await api(editing === 'new' ? '/astronauts' : '/astronauts/' + editing, { method: editing === 'new' ? 'POST' : 'PUT', body: v }); toast(`Astronaut ${esc(r.item.code)} saved.`); editing = null; if (SESSION.astronaut && r.item.id === SESSION.astronaut.id) await selectAstronaut(r.item.id, true); draw(); } catch (err) { showErr(e.target, err); } };
        if ($('#mf')) $('#mf').onsubmit = async e => { e.preventDefault(); const v = formVals(e.target); v.code = v.code.toUpperCase();
          try { const r = await api(editingMission === 'new' ? '/missions' : '/missions/' + editingMission, { method: editingMission === 'new' ? 'POST' : 'PUT', body: v }); toast(`Mission ${esc(r.item.code)} saved.`); editingMission = null; draw(); } catch (err) { showErr(e.target, err); } };
      } catch (e) { failed(el, e); }
    };
    draw();
  };
  function confirmTwice(btn) {
    if (btn.dataset.armed) return true;
    btn.dataset.armed = '1'; const old = btn.textContent; btn.textContent = 'Click again to confirm';
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; } }, 4000);
    return false;
  }

  /* ---- Measurements database ---- */
  const COLS = [['heart_rate', 'HR', 'bpm'], ['systolic_bp', 'SBP', 'mmHg'], ['diastolic_bp', 'DBP', 'mmHg'], ['spo2', 'SpO2', '%'], ['temperature', 'Temp', '°C'], ['respiratory_rate', 'RR', '/min'], ['sleep_hours', 'Sleep', 'h'], ['exercise_min', 'Exercise', 'min'], ['fatigue', 'Fatigue', '1–7'], ['mood', 'Mood', '1–5'], ['glucose', 'Glucose', 'mg/dL']];
  VIEWS.records = async el => {
    let astro = String(SESSION.astronaut.id), from = '', to = '', offset = 0, editing = null; const LIMIT = 50;
    const draw = async () => {
      loading(el, 'measurements');
      try {
        const q = `?limit=${LIMIT}&offset=${offset}${astro ? '&astronaut_id=' + astro : ''}${from ? '&from=' + from : ''}${to ? '&to=' + to : ''}`;
        const r = await api('/measurements' + q); const ed = editing && r.items.find(x => x.id === editing); if (!el.isConnected) return;
        el.innerHTML = `<div class="card" style="margin-bottom:16px"><h2>Measurements stored in SQLite (${r.total})</h2>
          <form class="row" id="flt"><select name="astro"><option value="">all astronauts</option>${SESSION.astronauts.map(a => `<option value="${a.id}" ${String(a.id) === astro ? 'selected' : ''}>${esc(a.code)}</option>`).join('')}</select><label class="row" style="gap:6px">From <input type="date" name="from" value="${esc(from)}"></label><label class="row" style="gap:6px">To <input type="date" name="to" value="${esc(to)}"></label><button class="btn primary">Filter</button><a class="btn" href="#log">+ Log measurement</a></form>
          <div class="hint">New records are added from Log Measurement (crew side) and reach this table when synchronized. ${can('measurements.edit') ? 'Your role can edit records' + (can('measurements.delete') ? ' and delete them.' : '; deleting requires an Administrator.') : 'Editing requires the Doctor or Administrator role.'}</div></div>
          ${ed ? `<div class="card" style="margin-bottom:16px"><h2>Edit measurement #${ed.id} · ${esc(ed.astronaut_code)}</h2><form id="mef" novalidate><div class="grid g4" style="gap:10px">
            <div class="field"><label>Date & time (UTC)</label><input name="measured_at" type="datetime-local" value="${esc(ed.measured_at.slice(0, 16))}"></div>
            ${COLS.map(c => `<div class="field"><label>${c[1]} (${c[2]})</label><input name="${c[0]}" inputmode="decimal" value="${ed[c[0]] == null ? '' : ed[c[0]]}"></div>`).join('')}</div>
            <div class="field"><label>Notes</label><input name="notes" maxlength="1000" value="${esc(ed.notes)}"></div><div class="err"></div>
            <div class="row"><button class="btn primary">Save changes</button><button class="btn" type="button" id="mecancel">Cancel</button></div><div class="hint">Saving re-runs the rule engine on the server and replaces this record's open alerts.</div></form></div>` : ''}
          <div class="card"><div class="tablewrap" style="max-height:none"><table><thead><tr><th>Time (UTC)</th><th>Crew</th>${COLS.map(c => `<th>${c[1]}</th>`).join('')}<th>Alerts</th><th>Data</th><th>By</th><th></th></tr></thead><tbody>
          ${r.items.map(x => `<tr><td class="num">${fmtIso(x.measured_at).slice(0, 16)}</td><td>${esc(x.astronaut_code)}</td>${COLS.map(c => `<td class="num">${x[c[0]] == null ? '<span class="dim">—</span>' : x[c[0]]}</td>`).join('')}<td class="num">${x.alerts}</td><td>${x.is_synthetic ? '<span class="badge b-syn">synthetic</span>' : '<span class="badge b-real">recorded</span>'}</td><td class="muted">${esc(x.recorded_by || (x.is_synthetic ? 'seed' : '—'))}</td>
            <td class="row" style="gap:6px;flex-wrap:nowrap">${can('measurements.edit') ? `<button class="btn" data-edit="${x.id}">Edit</button>` : ''}${can('measurements.delete') ? `<button class="btn danger" data-del="${x.id}">Delete</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="${COLS.length + 6}" class="dim">No measurements match the filters.</td></tr>`}</tbody></table></div>
          <div class="row" style="margin-top:10px"><button class="btn" id="prev" ${offset ? '' : 'disabled'}>← Newer</button><span class="pill">${r.total ? offset + 1 : 0}–${Math.min(offset + LIMIT, r.total)} of ${r.total}</span><button class="btn" id="next" ${offset + LIMIT < r.total ? '' : 'disabled'}>Older →</button></div></div>`;
        $('#flt').onsubmit = e => { e.preventDefault(); const v = formVals(e.target); astro = v.astro; from = v.from; to = v.to; offset = 0; draw(); };
        $('#prev').onclick = () => { offset = Math.max(0, offset - LIMIT); draw(); }; $('#next').onclick = () => { offset += LIMIT; draw(); };
        $$('[data-edit]', el).forEach(b => b.onclick = () => { editing = Number(b.dataset.edit); draw(); });
        if ($('#mecancel')) $('#mecancel').onclick = () => { editing = null; draw(); };
        if ($('#mef')) $('#mef').onsubmit = async e => { e.preventDefault(); const v = formVals(e.target); const body = { notes: v.notes, measured_at: v.measured_at ? v.measured_at + ':00Z' : undefined };
          COLS.forEach(c => { body[c[0]] = v[c[0]] === '' ? null : Number(String(v[c[0]]).replace(',', '.')); });
          try { await api('/measurements/' + editing, { method: 'PUT', body }); toast('Measurement updated; alerts recalculated on the server.'); editing = null; await reloadAstronautData(); draw(); } catch (err) { showErr(e.target, err); } };
        $$('[data-del]', el).forEach(b => b.onclick = async () => { if (!confirmTwice(b)) return;
          try { await api('/measurements/' + b.dataset.del, { method: 'DELETE' }); toast('Measurement deleted from the ground database.'); await reloadAstronautData(); draw(); } catch (e) { toast(esc(errText(e))); } });
      } catch (e) { failed(el, e); }
    };
    draw();
  };

  /* ---- Users & roles (admin) ---- */
  VIEWS.users = async el => {
    let editing = null;
    const draw = async () => {
      loading(el, 'users');
      try {
        const r = await api('/users'); const ro = r.read_only; if (!el.isConnected) return;
        const u = editing === 'new' ? { full_name: '', email: '', role: 'operator', is_active: true } : r.items.find(x => x.id === editing);
        el.innerHTML = `<div class="grid g2"><div class="card ${u ? '' : 'span2'}"><h2>Users (${r.items.length}) ${ro ? '' : '<button class="btn primary" id="unew">+ New user</button>'}</h2>
          ${ro ? '<div class="hint" style="margin-bottom:8px">Public demo account: user management is <b>read-only</b> and e-mails of non-public accounts are masked.</div>' : ''}
          <div class="tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Last sign-in</th><th></th></tr></thead><tbody>${r.items.map(x => `<tr><td>${esc(x.full_name)}${x.is_demo ? ' <span class="badge b-syn">demo</span>' : ''}</td><td>${esc(x.email)}</td><td>${esc(x.role_label)}</td><td>${x.is_active ? 'yes' : 'no'}</td><td class="num">${fmtIso(x.last_login_at)}</td><td class="row" style="gap:6px;flex-wrap:nowrap">${ro ? '<span class="dim">read-only</span>' : `<button class="btn" data-edit="${x.id}">Edit</button>${x.id !== SESSION.user.id ? `<button class="btn danger" data-del="${x.id}">Delete</button>` : ''}`}</td></tr>`).join('')}</tbody></table></div></div>
          ${u ? `<div class="card"><h2>${editing === 'new' ? 'New user' : 'Edit ' + esc(u.email)}</h2><form id="uf" novalidate>
            <div class="field"><label>Full name</label><input name="full_name" value="${esc(u.full_name)}" maxlength="120"></div>
            <div class="field"><label>Email</label><input name="email" type="email" value="${esc(u.email)}" maxlength="160"></div>
            <div class="field"><label>Role</label><select name="role">${[['operator', 'Operator'], ['doctor', 'Doctor / Specialist'], ['admin', 'Administrator']].map(o => `<option value="${o[0]}" ${o[0] === u.role ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
            <div class="field"><label>Password ${editing === 'new' ? '' : '(leave blank to keep current)'}</label><input name="password" type="password" autocomplete="new-password" maxlength="128"></div>
            <label class="row" style="gap:8px;margin-bottom:10px"><input type="checkbox" name="is_active_account" style="width:auto" ${u.is_active ? 'checked' : ''}> Account active</label>
            <div class="err"></div><div class="row"><button class="btn primary">Save user</button><button class="btn" type="button" id="ucancel">Cancel</button></div></form></div>` : ''}
          <div class="card span2"><h2>Permission matrix (enforced by the server)</h2><table><thead><tr><th>Capability</th><th>Administrator</th><th>Doctor / Specialist</th><th>Operator</th></tr></thead><tbody>
          ${[['View all modules', 1, 1, 1], ['Log measurements', 1, 1, 1], ['Edit measurements', 1, 1, 0], ['Delete measurements', 1, 0, 0], ['Review alerts', 1, 1, 0], ['Manage astronauts & missions', 1, 0, 0], ['Reports', 1, 1, 0], ['Users & audit log', 1, 0, 0]].map(row => `<tr><td>${row[0]}</td>${row.slice(1).map(v => `<td>${v ? '✔' : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
        if ($('#unew')) $('#unew').onclick = () => { editing = 'new'; draw(); };
        if ($('#ucancel')) $('#ucancel').onclick = () => { editing = null; draw(); };
        $$('[data-edit]', el).forEach(b => b.onclick = () => { editing = Number(b.dataset.edit); draw(); });
        $$('[data-del]', el).forEach(b => b.onclick = async () => { if (!confirmTwice(b)) return; try { await api('/users/' + b.dataset.del, { method: 'DELETE' }); toast('User deleted.'); draw(); } catch (e) { toast(esc(errText(e))); } });
        if ($('#uf')) $('#uf').onsubmit = async e => { e.preventDefault(); try { await api(editing === 'new' ? '/users' : '/users/' + editing, { method: editing === 'new' ? 'POST' : 'PUT', body: formVals(e.target) }); toast('User saved.'); editing = null; draw(); } catch (err) { showErr(e.target, err); } };
      } catch (e) { failed(el, e); }
    };
    draw();
  };

  /* ---- Audit log (admin) ---- */
  VIEWS.audit = async el => {
    loading(el, 'audit log');
    try {
      const r = await api('/audit'); if (!el.isConnected) return;
      el.innerHTML = `<div class="card"><h2>Audit log — last ${r.items.length} actions</h2><div class="tablewrap" style="max-height:none"><table><thead><tr><th>Time (UTC)</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th><th>Details</th><th>IP</th></tr></thead><tbody>${r.items.map(x => `<tr><td class="num">${fmtIso(x.created_at)}</td><td>${esc(x.user || '—')}</td><td><span class="badge b-info">${esc(x.action)}</span></td><td>${esc(x.entity)}</td><td class="num">${x.entity_id || ''}</td><td class="muted">${esc(x.details || '')}</td><td class="num dim">${esc(x.ip_address || '')}</td></tr>`).join('')}</tbody></table></div></div>`;
    } catch (e) { failed(el, e); }
  };

  /* ================= Session: NASA Evaluator Access login ================= */
  function renderLogin(message) {
    document.title = 'Iniciar sesión · ASTRA VITAL';
    document.getElementById('root').innerHTML = `<div class="login-page"><div class="login-wrap">
      <header class="login-head"><div class="brand">${symbol(54)}<div><b style="font-size:20px">ASTRA VITAL</b><small>INTELLIGENT ASTRONAUT HEALTH MONITORING</small><div class="edition">ACADEMIC EDITION · FLASK + SQLITE API</div></div></div>
        <div class="team-tag">Equipo <b>NYXARA NOVA</b> · NASA Space Apps Challenge 2026</div></header>
      <div class="login-grid">
        <section class="card login-card" aria-labelledby="signin-h"><h2 id="signin-h">Iniciar sesión · Sign in</h2>
          <div id="srv" class="srv" role="status"><span class="dot"></span><span>Conectando con el servidor en Render…</span></div>
          ${message ? `<div class="flash" role="status">${esc(message)}</div>` : ''}
          <form id="lf" novalidate><div class="field"><label for="email">Correo electrónico · Email</label><input id="email" name="email" type="email" autocomplete="username" placeholder="usuario@ejemplo.com"></div>
            <div class="field"><label for="password">Contraseña · Password</label><input id="password" name="password" type="password" autocomplete="current-password"></div>
            <div class="err" id="lerr" role="alert"></div><button class="btn primary block" id="lbtn" type="submit">Ingresar</button></form>
          <ol class="steps" aria-label="Cómo ingresar"><li>Elige una cuenta de la sección <b>NASA Evaluator Access</b>.</li><li>Pulsa <b>Usar esta cuenta</b> (o copia el correo y la contraseña).</li><li>Pulsa <b>Ingresar</b>. Cada cuenta abre ASTRA VITAL con los permisos reales de su rol.</li></ol>
          <p class="hint">Primera carga: el servidor gratuito de Render puede tardar hasta ~50 s en despertar. Versión enviada a la NASA (15/11/2026, sin cambios): <a href="nasa-2026/">/astra-vital/nasa-2026/</a></p>
        </section>
        <section class="card evaluator" aria-labelledby="eval-h"><div class="eval-kicker">NASA EVALUATOR ACCESS</div><h2 id="eval-h">Credenciales de demostración</h2>
          <p class="muted small">Tres cuentas públicas, una por rol, para docentes, evaluadores y jurados de NASA Space Apps. Las credenciales las entrega el servidor.</p>
          <div class="demo-list" id="demo"><div class="empty">Cargando cuentas desde el servidor…</div></div>
          <div class="demo-warning" role="note"><b>Cuentas públicas de demostración.</b> Cualquier persona puede usarlas: no ingreses datos personales, médicos ni reales. Todos los astronautas y signos vitales son sintéticos y la base de datos se restablece cuando el servidor se reinicia. Por seguridad estas cuentas no pueden gestionar usuarios ni borrar los datos de referencia.</div>
        </section></div>
      <p class="disclaimer" style="text-align:center">Prototype for the 2026 NASA Space Apps Challenge by team NYXARA NOVA — academic edition with Flask + SQLite backend. Not an official NASA product. Not a medical device.</p></div></div>`;
    const srv = $('#srv');
    const setSrv = (ok, txt) => { srv.className = 'srv ' + (ok === true ? 'ok' : ok === false ? 'bad' : ''); srv.lastElementChild.textContent = txt; };
    if (!API_BASE) setSrv(false, 'Build error: API URL not configured.');
    const t0 = Date.now(); const slow = setTimeout(() => setSrv(null, 'Despertando el servidor gratuito de Render… (hasta ~50 s)'), 4000);
    api('/health', { anon: true }).then(() => { clearTimeout(slow); setSrv(true, `Servidor en línea (${((Date.now() - t0) / 1000).toFixed(1)} s)`); return api('/demo-accounts', { anon: true }); })
      .then(d => renderDemo(d.accounts)).catch(e => { clearTimeout(slow); setSrv(false, 'No se pudo contactar al servidor: ' + e.message + ' Recarga la página para reintentar.'); $('#demo').innerHTML = '<div class="empty">Las cuentas se muestran cuando el servidor responde.</div>'; });
    $('#lf').onsubmit = async e => {
      e.preventDefault(); const email = $('#email').value.trim(), password = $('#password').value;
      if (!email || !password) { $('#lerr').textContent = 'Ingresa correo y contraseña.'; return; }
      $('#lbtn').disabled = true; $('#lbtn').textContent = 'Ingresando…'; $('#lerr').textContent = '';
      try {
        const r = await api('/auth/login', { method: 'POST', body: { email, password }, anon: true });
        SESSION.token = r.token; SESSION.user = r.user; SESSION.ended = false; ssSet(TOKEN_KEY, r.token);
        await startApp();
      } catch (err) { $('#lerr').textContent = err.status === 401 ? 'Correo o contraseña incorrectos.' : errText(err); $('#lbtn').disabled = false; $('#lbtn').textContent = 'Ingresar'; }
    };
  }
  function renderDemo(accounts) {
    const box = $('#demo'); if (!box) return;
    if (!accounts || !accounts.length) { box.innerHTML = '<div class="empty">Las cuentas de demostración están desactivadas en este servidor.</div>'; return; }
    box.innerHTML = accounts.map(a => `<article class="demo-acc role-${esc(a.role)}"><div class="demo-top"><span class="role-badge">${esc(a.label)}</span><button type="button" class="btn small use-acc">Usar esta cuenta</button></div>
      <dl><dt>Correo</dt><dd><code>${esc(a.email)}</code><button type="button" class="copy" data-copy="${esc(a.email)}" aria-label="Copiar correo de ${esc(a.label)}">Copiar</button></dd>
      <dt>Contraseña</dt><dd><code>${esc(a.password)}</code><button type="button" class="copy" data-copy="${esc(a.password)}" aria-label="Copiar contraseña de ${esc(a.label)}">Copiar</button></dd></dl><p class="perm">${esc(a.can)}</p></article>`).join('');
    $$('.demo-acc', box).forEach((card, i) => { $('.use-acc', card).onclick = () => { $('#email').value = accounts[i].email; $('#password').value = accounts[i].password; $$('.demo-acc', box).forEach(c => c.classList.remove('used')); card.classList.add('used'); $('#lbtn').focus(); }; });
    $$('button.copy', box).forEach(b => b.onclick = () => copyText(b.dataset.copy).then(ok => { const old = b.textContent; b.textContent = ok ? 'Copiado ✓' : 'Copia manual'; b.classList.toggle('ok', ok); setTimeout(() => { b.textContent = old; b.classList.remove('ok'); }, 1600); }));
  }
  function copyText(text) {
    const fallback = () => { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } t.remove(); return ok; };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => fallback());
    return Promise.resolve(fallback());
  }

  async function startApp() {
    const root = document.getElementById('root');
    if (!$('.app', root)) root.innerHTML = `<div class="login-page"><div class="login-wrap"><div class="card" style="max-width:420px;margin:80px auto;text-align:center">${symbol(54)}<p>Cargando ASTRA VITAL desde el servidor…</p></div></div></div>`;
    try {
      if (!SESSION.user) SESSION.user = (await api('/auth/me')).user;
      SESSION.astronauts = (await api('/astronauts')).items;
      if (!SESSION.astronauts.length && !can('astronauts.manage')) throw new Error('No astronauts are registered yet. Ask an Administrator to create one.');
      const stored = Number(ssGet(ASTRO_KEY));
      await selectAstronaut(SESSION.astronauts.some(a => a.id === stored) ? stored : (SESSION.astronauts[0] || {}).id, true);
      document.title = 'ASTRA VITAL — Astronaut Health Monitoring | NYXARA NOVA';
      shell(); window.removeEventListener('hashchange', route); window.addEventListener('hashchange', route); route();
      if (S.queue.length && S.link === 'AOS') syncNow(true);
    } catch (e) { if (!SESSION.ended) endSession(e.network ? 'No se pudo contactar al servidor. ' + e.message : errText(e)); }
  }
  async function loadServerRecords(id) { return fromServer((await api(`/measurements?astronaut_id=${id}&limit=2000`)).items); }
  async function selectAstronaut(id, silent) {
    if (!id) { SESSION.astronauts = (await api('/astronauts')).items; id = (SESSION.astronauts[0] || {}).id; }
    if (!id) { SESSION.astronaut = { id: 0, code: '—', full_name: 'No astronauts', mission: null, is_synthetic: false }; S = buildState([]); return; }
    const [a, recs] = await Promise.all([api('/astronauts/' + id), loadServerRecords(id)]);
    SESSION.astronaut = a.item; SESSION.astronauts = SESSION.astronauts.map(x => x.id === a.item.id ? a.item : x);
    ssSet(ASTRO_KEY, String(id));
    S = buildState(recs);
    if (S.routine.date !== fmtDate(Date.now())) S.routine = { date: fmtDate(Date.now()), done: [] };
    save();
    if (!silent) { refresh(); toast(`Showing ${esc(a.item.code)} — ${esc(a.item.full_name)}.`); }
  }
  async function reloadAstronautData() {
    const recs = await loadServerRecords(SESSION.astronaut.id);
    const pending = S.records.filter(r => S.queue.includes(r.id));
    S.records = recs.concat(pending); S.ground.records = recs.map(r => Object.assign({}, r));
    S.ground.receivedAt = recs.length ? Math.max.apply(null, recs.map(r => r.ts)) : S.ground.receivedAt;
    const a = await api('/astronauts/' + SESSION.astronaut.id); SESSION.astronaut = a.item;
  }
  function endSession(message) {
    if (SESSION.ended) return; SESSION.ended = true;
    if (S) save();
    SESSION.token = null; SESSION.user = null; SESSION.astronaut = null; S = null; ssSet(TOKEN_KEY, null);
    window.removeEventListener('hashchange', route); renderLogin(message);
  }
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* token may already be invalid */ }
    endSession('Sesión cerrada. Los registros pendientes quedan guardados en este dispositivo.');
  }

  /* ---------------- Boot ---------------- */
  SESSION.token = ssGet(TOKEN_KEY);
  if (SESSION.token) startApp(); else renderLogin();
  window.AV = { get state() { return S; }, get session() { return { user: SESSION.user, astronaut: SESSION.astronaut }; }, engine: E, syncNow, csv, reportHtml };

})();
