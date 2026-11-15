/* ASTRA VITAL — Health Intelligence Engine (rule-based, explainable)
 * Team NYXARA NOVA — NASA Space Apps Challenge 2026
 * No machine-learning model is used. Every alert is produced by an explicit,
 * documented rule so the astronaut can see exactly why it fired.
 * This software is a prototype. It does NOT diagnose and does NOT replace a flight surgeon.
 */
(function (root) {
  'use strict';
  const DAY = 86400000;

  // Reference sources (shown in-app and in reports)
  const SOURCES = {
    AHA_HR: 'American Heart Association — normal resting heart rate for adults is 60–100 bpm.',
    ACC_AHA_BP: '2017 ACC/AHA Hypertension Guideline (Whelton et al., Hypertension 2018) — Normal <120/<80; Elevated 120–129/<80; Stage 1 130–139 or 80–89; Stage 2 ≥140 or ≥90; Hypertensive crisis >180 and/or >120 mmHg.',
    SPO2: 'Typical SpO2 in healthy adults at sea-level pressure is 95–100%; SpO2 <90% is the commonly used threshold for hypoxemia (e.g., WHO Pulse Oximetry Training Manual, 2011).',
    CDC_FEVER: 'CDC — a person with a measured temperature of 100.4 °F (38.0 °C) or greater is considered to have a fever.',
    AASM_SLEEP: 'AASM/SRS consensus (Watson et al., Sleep 2015) — adults should sleep 7 or more hours per night on a regular basis.',
    BARGER_2014: 'Barger et al., Lancet Neurology 2014 — astronauts averaged about 6 h of sleep per night on ISS missions.',
    NASA_EXERCISE: 'NASA — ISS crew members exercise about 2 hours per day (resistive + aerobic) to counter bone and muscle loss.',
    NASA_BONE: 'NASA Human Research Program — on average, bones lose 1%–1.5% of their density each month during 4–6-month missions.',
    SAMN_PERELLI: 'Samn-Perelli 7-point fatigue scale (Samn & Perelli, USAF SAM 1982); scores of 5–7 indicate moderate-to-extreme fatigue in fatigue-risk management practice.',
    ADA_GLUCOSE: 'American Diabetes Association Standards of Care — Level 1 hypoglycemia <70 mg/dL; Level 2 <54 mg/dL; normal fasting glucose 70–99 mg/dL.',
    NASA_HRP: 'NASA Human Research Program — five hazards of human spaceflight (RIDGE): Radiation, Isolation & confinement, Distance from Earth, Gravity fields, Hostile/closed environments.',
    ENGINE: 'ASTRA VITAL engine convention (engineering rule, not a clinical threshold).'
  };

  // Metric catalogue. hazard keys: R, I, D, G, E
  const METRICS = {
    hr:      { label: 'Heart rate', unit: 'bpm', system: 'cardio', ref: [60, 100], src: 'AHA_HR', plaus: [25, 230], sdFloor: 3, worse: 'both', hazards: ['G', 'I', 'R'] },
    bp:      { label: 'Blood pressure', unit: 'mmHg', system: 'cardio', ref: [90, 120], src: 'ACC_AHA_BP', plaus: [60, 260], sdFloor: 4, worse: 'up', hazards: ['G', 'E'], dual: true },
    spo2:    { label: 'Oxygen saturation', unit: '%', system: 'general', ref: [95, 100], src: 'SPO2', plaus: [60, 100], sdFloor: 0.7, worse: 'down', hazards: ['E'] },
    temp:    { label: 'Body temperature', unit: '°C', system: 'immune', ref: [36.1, 37.2], src: 'CDC_FEVER', plaus: [32, 43], sdFloor: 0.2, worse: 'up', hazards: ['E', 'R'] },
    sleep:   { label: 'Sleep duration', unit: 'h', system: 'nervous', ref: [7, 9], src: 'AASM_SLEEP', plaus: [0, 16], sdFloor: 0.4, worse: 'down', hazards: ['I', 'E'] },
    activity:{ label: 'Exercise completed', unit: 'min', system: 'musculo', ref: [120, 180], src: 'NASA_EXERCISE', plaus: [0, 400], sdFloor: 10, worse: 'down', hazards: ['G'] },
    fatigue: { label: 'Fatigue (Samn-Perelli 1–7)', unit: 'score', system: 'nervous', ref: [1, 4], src: 'SAMN_PERELLI', plaus: [1, 7], sdFloor: 0.8, worse: 'up', hazards: ['I', 'E'] },
    mood:    { label: 'Mood / well-being (1–5)', unit: 'score', system: 'nervous', ref: [3, 5], src: 'ENGINE', plaus: [1, 5], sdFloor: 0.5, worse: 'down', hazards: ['I', 'D'] },
    glucose: { label: 'Blood glucose', unit: 'mg/dL', system: 'general', ref: [70, 99], src: 'ADA_GLUCOSE', plaus: [20, 600], sdFloor: 6, worse: 'both', hazards: ['G', 'E'] }
  };

  const ACTIONS = {
    hr: 'Re-measure after 5 minutes of seated rest, away from exercise and caffeine. Note symptoms (palpitations, dizziness, chest discomfort).',
    bp: 'Re-measure after 5 minutes seated, back supported, same arm, cuff at heart level (AHA measurement technique). Take 2 readings 1 minute apart and log the average.',
    spo2: 'Re-measure: warm the finger, keep still, check sensor placement. Check cabin O2/CO2 readouts. If confirmed below 90% or with breathlessness/confusion, follow the onboard emergency medical checklist.',
    temp: 'Re-measure in 15 minutes. Log symptoms. Hydrate and rest. Follow onboard medical checklist for fever and inform the crew medical officer.',
    sleep: 'Protect the sleep period: dim light before sleep, control noise and cabin temperature, avoid demanding work right before rest. Raise sleep issues at the next Private Medical Conference.',
    activity: 'Complete the prescribed resistive and aerobic sessions. If sessions are being skipped because of workload or pain, report it to the crew lead and flight surgeon.',
    fatigue: 'Review workload and recent sleep. Where possible, re-schedule safety-critical tasks and use a short rest break. Inform the crew lead.',
    mood: 'Use mission behavioral-health resources: talk with a crewmate, schedule a private psychological conference, use planned leisure time and family contact.',
    glucose: 'Re-check. If low (<70 mg/dL), follow the onboard hypoglycemia procedure (fast-acting carbohydrate) and re-test after 15 minutes. Report to the flight surgeon.',
    missing: 'Take the missing measurement at the next scheduled routine slot so trends stay reliable.',
    quality: 'Value excluded from analysis. Re-measure and correct the entry if it was a typing error.'
  };

  const CONTACT = {
    priority: 'Contact the flight surgeon as soon as possible through the emergency medical channel. If the Earth link is unavailable, follow the onboard medical checklist and inform the crew medical officer now.',
    followup: 'Include in the next scheduled Private Medical Conference or next communication window.',
    info: 'No contact needed now — will appear in the weekly summary sent to Earth.'
  };

  function mean(a) { return a.reduce((s, x) => s + x, 0) / (a.length || 1); }
  function sd(a) { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); }
  function slopePerDay(points) { // least squares, t in ms
    if (points.length < 3) return 0;
    const t0 = points[0].t; const xs = points.map(p => (p.t - t0) / DAY); const ys = points.map(p => p.v);
    const mx = mean(xs), my = mean(ys);
    const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    return den ? num / den : 0;
  }

  // Quality check — physiological plausibility (engineering bounds) + internal consistency
  function checkQuality(r) {
    const m = METRICS[r.metric]; if (!m) return { ok: false, reason: 'Unknown indicator' };
    const v = Number(r.value);
    if (r.value === '' || r.value === null || isNaN(v)) return { ok: false, reason: 'Missing value' };
    if (v < m.plaus[0] || v > m.plaus[1]) return { ok: false, reason: `Value ${v} ${m.unit} is outside the physiologically plausible range (${m.plaus[0]}–${m.plaus[1]})` };
    if (m.dual) {
      const d = Number(r.value2);
      if (isNaN(d) || d < 30 || d > 160) return { ok: false, reason: 'Diastolic value missing or implausible' };
      if (d >= v) return { ok: false, reason: 'Diastolic pressure must be lower than systolic' };
    }
    return { ok: true };
  }

  function series(records, metric, key) {
    return records.filter(r => r.metric === metric && checkQuality(r).ok)
      .map(r => ({ t: r.ts, v: Number(key === 'value2' ? r.value2 : r.value), id: r.id }))
      .sort((a, b) => a.t - b.t);
  }

  // Personal baseline: first 7 valid values (the mission's early, stable period)
  function baseline(records, metric, key) {
    const s = series(records, metric, key); if (s.length < 5) return null;
    const vals = s.slice(0, 7).map(p => p.v);
    return { mean: mean(vals), sd: Math.max(sd(vals), (key === 'value2' ? 3 : METRICS[metric].sdFloor)), n: vals.length };
  }

  function fmt(v, metric) { const d = ['temp', 'spo2', 'sleep'].includes(metric) ? 1 : 0; return Number(v).toFixed(d); }

  function analyze(records, now) {
    now = now || Date.now();
    const alerts = [];
    const push = a => alerts.push(Object.assign({ id: `${a.rule}-${a.metric}-${a.recordId || ''}` }, a));

    // 1) Data quality
    records.forEach(r => {
      const q = checkQuality(r);
      if (!q.ok) push({ rule: 'quality', level: 'info', metric: r.metric, recordId: r.id, title: 'Inconsistent entry excluded',
        changed: `${METRICS[r.metric] ? METRICS[r.metric].label : r.metric} entry on ${new Date(r.ts).toISOString().slice(0, 16).replace('T', ' ')} UTC was rejected.`,
        why: q.reason + '. Unchecked errors would distort the personal baseline and trends.', action: ACTIONS.quality, contact: CONTACT.info, src: ['ENGINE'] });
    });

    const gaps = [];
    Object.keys(METRICS).forEach(metric => {
      const m = METRICS[metric];
      const s = series(records, metric);
      if (!s.length) return;
      const last = s[s.length - 1];
      const lastRec = records.find(r => r.id === last.id);

      // 2) Missing data (daily routine indicators)
      if (metric !== 'glucose' && now - last.t > 1.5 * DAY) {
        push({ rule: 'missing', level: 'info', metric, title: `${m.label}: no recent data`, changed: `Last valid value was ${Math.round((now - last.t) / 3600000)} h ago.`,
          why: 'Daily measurements are needed to compare against your personal baseline (engine convention: >36 h without data).', action: ACTIONS.missing, contact: CONTACT.info, src: ['ENGINE'] });
      }
      const days = new Set(s.filter(p => now - p.t < 7 * DAY).map(p => new Date(p.t).toISOString().slice(0, 10)));
      if (metric !== 'glucose' && s.length > 7) {
        const missingDays = [];
        for (let i = 1; i <= 6; i++) { const d = new Date(now - i * DAY).toISOString().slice(0, 10); if (!days.has(d)) missingDays.push(d); }
        if (missingDays.length) gaps.push({ label: m.label, days: missingDays });
      }

      // 3) Documented reference thresholds on the latest value
      const v = last.v; const v2 = m.dual ? Number(lastRec.value2) : null;
      let ref = null;
      if (metric === 'spo2' && v < 90) ref = { level: 'priority', why: `SpO2 ${v}% is below 90%, the commonly used hypoxemia threshold.` };
      else if (metric === 'spo2' && v < 95) ref = { level: 'followup', why: `SpO2 ${v}% is below the typical healthy range (95–100%).` };
      if (metric === 'temp' && v >= 38.0) ref = { level: 'priority', why: `Temperature ${v} °C meets the CDC fever definition (≥38.0 °C).` };
      if (metric === 'bp') {
        if (v > 180 || v2 > 120) ref = { level: 'priority', why: `${v}/${v2} mmHg is in the hypertensive-crisis range (>180 and/or >120).` };
        else if (v >= 140 || v2 >= 90) ref = { level: 'followup', why: `${v}/${v2} mmHg is in the Stage 2 hypertension range (≥140 or ≥90).` };
        else {
          const recent = records.filter(r => r.metric === 'bp' && checkQuality(r).ok).sort((a, b) => b.ts - a.ts).slice(0, 5);
          const n = recent.filter(r => r.value >= 130 || r.value2 >= 80).length;
          if (n >= 3) ref = { level: 'followup', why: `${n} of the last ${recent.length} readings are in the Stage 1 range (130–139 or 80–89). Sustained readings matter more than a single value.` };
          else if (v < 90 || v2 < 60) ref = { level: 'followup', why: `${v}/${v2} mmHg is low; spaceflight can cause orthostatic intolerance, especially after gravity transitions.` };
        }
      }
      if (metric === 'hr' && (v < 60 || v > 100)) ref = { level: 'followup', why: `Resting heart rate ${v} bpm is outside 60–100 bpm. A low value can be normal in fit individuals; compare with your baseline.` };
      if (metric === 'glucose') {
        if (v < 54) ref = { level: 'priority', why: `Glucose ${v} mg/dL is Level 2 hypoglycemia (<54).` };
        else if (v < 70) ref = { level: 'followup', why: `Glucose ${v} mg/dL is Level 1 hypoglycemia (<70).` };
      }
      if (metric === 'fatigue' && v >= 5) ref = { level: 'followup', why: `Samn-Perelli score ${v} indicates moderate-to-extreme fatigue.` };
      if (metric === 'sleep') {
        const lastN = s.slice(-3);
        if (lastN.length === 3 && lastN.every(p => p.v < 7)) ref = { level: 'followup', why: `The last 3 sleep periods were all under 7 h (${lastN.map(p => p.v.toFixed(1)).join(', ')} h). Persistent short sleep is a known spaceflight issue.` };
        else if (v < 7) ref = { level: 'info', why: `Last sleep period ${v.toFixed(1)} h is under the 7 h adult recommendation.` };
      }
      if (metric === 'activity') {
        const lastN = s.slice(-3);
        if (lastN.length === 3 && lastN.every(p => p.v < 120)) ref = { level: 'followup', why: `Exercise was below the ~2 h/day prescription on 3 consecutive days (${lastN.map(p => p.v).join(', ')} min). Exercise is the main countermeasure for bone and muscle loss.` };
      }
      if (ref) push({ rule: 'reference', level: ref.level, metric, recordId: last.id, title: `${m.label}: ${ref.level === 'priority' ? 'needs attention now' : 'outside documented reference'}`,
        changed: `Latest value ${m.dual ? v + '/' + v2 : fmt(v, metric)} ${m.unit} (${new Date(last.t).toISOString().slice(0, 16).replace('T', ' ')} UTC).`,
        why: ref.why, action: ACTIONS[metric], contact: CONTACT[ref.level], src: [m.src].concat(metric === 'sleep' ? ['BARGER_2014'] : []), hazards: m.hazards, value: v });

      // 4) Change vs personal baseline (z-score)
      const b = baseline(records, metric);
      if (b && s.length > b.n) {
        const z = (v - b.mean) / b.sd;
        const bad = m.worse === 'both' ? Math.abs(z) >= 2 : (m.worse === 'up' ? z >= 2 : z <= -2);
        if (bad) push({ rule: 'baseline', level: 'followup', metric, recordId: last.id, title: `${m.label}: change from your personal baseline`,
          changed: `Latest ${fmt(v, metric)} ${m.unit} vs. your baseline ${fmt(b.mean, metric)} ± ${b.sd.toFixed(1)} ${m.unit} (z = ${z.toFixed(1)}).`,
          why: 'A deviation of 2 or more standard deviations from your own early-mission values is unusual for you, even if it is inside general population ranges (engine convention).',
          action: ACTIONS[metric], contact: CONTACT.followup, src: ['ENGINE'], hazards: m.hazards, z });
      }

      // 5) Trend over the last 7 days
      const recent = s.filter(p => now - p.t <= 7 * DAY);
      if (b && recent.length >= 4) {
        const sl = slopePerDay(recent); const total = sl * 6;
        const harmful = m.worse === 'both' ? Math.abs(total) >= 2 * b.sd : (m.worse === 'up' ? total >= 2 * b.sd : total <= -2 * b.sd);
        if (harmful) push({ rule: 'trend', level: 'followup', metric, title: `${m.label}: sustained ${sl > 0 ? 'upward' : 'downward'} trend`,
          changed: `Trend of ${sl > 0 ? '+' : ''}${sl.toFixed(2)} ${m.unit}/day over the last 7 days (≈${total > 0 ? '+' : ''}${total.toFixed(1)} ${m.unit}).`,
          why: 'The week-long change is larger than 2 baseline standard deviations. A trend is shown so it can be discussed early; it is an association, not a diagnosis (engine convention).',
          action: ACTIONS[metric], contact: CONTACT.followup, src: ['ENGINE'], hazards: m.hazards, slope: sl });
      }
    });

    if (gaps.length) {
      const allDays = Array.from(new Set(gaps.flatMap(g => g.days))).sort();
      push({ rule: 'gap', level: 'info', metric: 'routine', title: 'Data gaps in the last 6 days', changed: `No measurements on ${allDays.join(', ')} for ${gaps.length} indicator(s): ${gaps.map(g => g.label).join(', ')}.`,
        why: 'Gaps reduce the reliability of baselines and trend detection (engine convention).', action: ACTIONS.missing, contact: CONTACT.info, src: ['ENGINE'] });
    }

    // Consolidate: one clinical alert per indicator (avoids alert fatigue), keeping all evidence.
    const order = { priority: 0, followup: 1, info: 2 };
    const rank = { reference: 0, baseline: 1, trend: 2 };
    const out = alerts.filter(a => !(a.rule in rank));
    const groups = {};
    alerts.filter(a => a.rule in rank).forEach(a => { (groups[a.metric] = groups[a.metric] || []).push(a); });
    Object.values(groups).forEach(g => {
      g.sort((a, b) => order[a.level] - order[b.level] || rank[a.rule] - rank[b.rule]);
      const p = Object.assign({}, g[0]);
      if (g.length > 1) {
        p.evidence = g.map(x => ({ rule: x.rule, text: x.changed }));
        p.why = g[0].why + ' Supporting evidence: ' + g.slice(1).map(x => x.changed).join(' ');
        p.src = Array.from(new Set(g.flatMap(x => x.src)));
        p.rules = g.map(x => x.rule);
      } else p.rules = [p.rule];
      out.push(p);
    });
    out.sort((a, b) => order[a.level] - order[b.level]);
    return out;
  }

  function status(alerts) {
    if (alerts.some(a => a.level === 'priority')) return 'priority';
    if (alerts.some(a => a.level === 'followup')) return 'followup';
    return 'nominal';
  }

  // Sync with conflict control (record-level versioning)
  function mergeInto(target, incoming) {
    const map = new Map(target.map(r => [r.id, r]));
    const result = { added: 0, updated: 0, conflicts: [] };
    incoming.forEach(r => {
      const cur = map.get(r.id);
      if (!cur) { map.set(r.id, Object.assign({}, r)); result.added++; }
      else if (r.version > cur.version) { map.set(r.id, Object.assign({}, r)); result.updated++; }
      else if (r.version === cur.version && r.hash !== cur.hash) { result.conflicts.push({ id: r.id, local: cur, remote: r }); }
    });
    return { records: Array.from(map.values()), result };
  }

  function hashRecord(r) {
    const s = [r.metric, r.ts, r.value, r.value2, r.note, r.source].join('|');
    let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  const api = { METRICS, SOURCES, ACTIONS, CONTACT, analyze, status, checkQuality, baseline, series, slopePerDay, mergeInto, hashRecord, DAY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AVEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
