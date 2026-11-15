# NASA Space Apps 2026 — Project Submission Texts (copy/paste)

Team: **NYXARA NOVA** · Local event: Trujillo, Peru · Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*

> Before pasting, replace `https://etner249.github.io/astra-vital/`, `https://github.com/Etner249/astra-vital` and `https://youtu.be/lxITVao2RmQ` with the real public links (test them in a private/incognito window).

---

## 1. Project Name
ASTRA VITAL — Intelligent Astronaut Health Monitoring System

## 2. High-Level Project Summary
ASTRA VITAL is an offline-first web application that helps astronauts on long-duration missions monitor their own health when real-time support from Earth is limited. Crew members log key indicators (heart rate, blood pressure, SpO2, temperature, sleep, exercise, fatigue, mood and glucose). A transparent, rule-based engine compares each value with published reference ranges and with the astronaut's own baseline, detects trends, missing data and inconsistent entries, and explains every alert: what changed, why it matters, what to do and when to contact the flight surgeon. Each indicator is linked to NASA's five hazards of human spaceflight (RIDGE) through an interactive body map and a Mission Risk Center. Data is stored on board first and synchronized in batches when a communication window opens, with conflict control and recovery after link drops. The concept was tested with real NASA OSDR laboratory data from the Inspiration4 crew (OSD-575, OSD-569). It matters because, on the way to Mars, astronauts will carry much of the responsibility for noticing health changes early.

## 3. Link to Project Demo
https://youtu.be/lxITVao2RmQ — 29.6-second video (female English narration — AI-generated voice; English subtitles; real screen captures of the app).

## 4. Link to Final Project
App: https://etner249.github.io/astra-vital/
Source code and documentation: https://github.com/Etner249/astra-vital

## 5. Detailed Project Description

**What it does**
- **Mission Dashboard:** overall status (Nominal / Follow-up / Priority), latest value of every indicator with sparkline, active alerts, mission day, environment, signal delay, time since last Earth contact, sync queue, and a daily health routine with streaks and points (gamification) that prompts measurements.
- **Log Measurement:** validated form with units, timestamp, data source and notes, plus "how to measure" guidance for each indicator. Values are saved locally and queued for Earth.
- **Interactive Body:** clickable cardiovascular, musculoskeletal, nervous/behavioral, immune and general systems, color-coded by status (color + icon + text for accessibility). Each shows its indicators, baseline, trend chart, related spaceflight hazards and a plain-language explanation.
- **Health Intelligence Engine:** five explicit rules — (1) data quality, (2) missing data, (3) documented reference ranges, (4) deviation ≥2 SD from the personal baseline, (5) 7-day trend. Findings for the same indicator are consolidated into one alert to avoid alert fatigue. Every alert lists: what changed, the indicator, why it matters, a conservative suggested action and when to contact the medical team, plus the rule and its source.
- **Mission Risk Center:** the five NASA hazards (Radiation, Isolation & confinement, Distance, Gravity fields, Hostile/closed environments) with description, related risks, indicators in the app, documented preventive measures and honest limitations. Environment selector: station, deep-space spacecraft, Moon base, Mars base, rover.
- **NASA Data (OSDR):** real Inspiration4 clinical lab values (glucose, calcium, potassium, creatinine, white cells, hemoglobin, platelets) for the four crew members across 7 pre/post-flight timepoints, compared with the lab reference range of each sample. The same quality checks flagged a likely entry/unit error in one real sample.
- **Offline-first sync:** local persistence, queue, link indicator (AOS/LOS), batch transfer with confirmation, record versioning and conflict detection, resume after an injected link drop. It never reports a sync that did not happen.
- **Ground Console:** the flight-surgeon side, which only sees data that was actually synchronized, and can queue notes that reach the crew at the next sync.
- **Earth Medical Reports:** printable report (PDF via the browser), HTML report, CSV export, JSON backup/restore.

**How it works**
A single self-contained HTML file (HTML5, CSS, vanilla JavaScript, inline SVG charts). No external libraries or network calls, so it runs fully offline once loaded. Data is kept in browser local storage. The engine (`src/engine.js`) is deterministic and covered by unit tests; the full app is covered by headless-browser end-to-end tests.

**Benefits**
Early, understandable detection of changes; personal baselines instead of only population norms; decisions supported even during communication blackouts; shorter, structured reports for flight surgeons; transparency that builds trust.

**What we hope to achieve**
A base for an onboard self-assessment tool that could connect to certified medical devices and wearables (e.g., biomonitoring garments already used on the ISS) and be validated with flight surgeons and analog missions.

**Tools and languages**
HTML5, CSS3, JavaScript (ES2020), SVG; Node.js (unit tests); Python + Playwright + headless Chrome (end-to-end tests and screen capture); FFmpeg (demo video); NASA OSDR public API (data download).

**Validation performed**
10 unit tests of the engine and 27 end-to-end checks (all views render, form validation, persistence after reload, sync blocked during LOS, recovery after link drop, flight-surgeon note round-trip, CSV/report export, body-map interaction, mobile and tablet layouts without overflow, zero console errors).

## 6. Use of Super Intelligence (SI)
Yes. The team used an AI assistant (Claude, by Anthropic) to accelerate coding, test writing, documentation drafting and video assembly. The project idea, scope and decisions were made by the team. All health rules, thresholds and sources were reviewed by the team and are cited in the app. No AI model runs inside ASTRA VITAL: its engine is rule-based and explainable. The video narration is an AI-generated voice (Kokoro-82M open-weight TTS), acknowledged on screen, in the video metadata and in the description. The NYXARA NOVA team emblem shown in the extended video is AI-generated and labeled on screen. All other visuals are real screen captures of the app or original vector artwork; the music is original and was synthesized procedurally. Details: docs/AI_DISCLOSURE.md.

## 7. NASA Data
- **NASA Open Science Data Repository — OSD-575:** "SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays". File used: `LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv` (glucose, calcium, potassium, sodium, creatinine with lab reference ranges). https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
- **NASA OSDR — OSD-569:** "Whole Blood Measurements from the SpaceX Inspiration4 Mission (... CBC)". File used: `LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv` (white blood cells, lymphocytes, hemoglobin, platelets). https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
- Organism: Homo sapiens (4 civilian astronauts). Factors: spaceflight, time. Timepoints: L-92, L-44, L-3, R+1, R+45, R+82, R+194.
- How we used it: to demonstrate value-vs-reference comparison, to test the data-quality checks on real data, and to show what pre/post-flight lab monitoring looks like. Limitation: n = 4 and a 3-day mission — no change is attributed to spaceflight.
- **NASA Human Research Program:** five hazards of human spaceflight (https://www.nasa.gov/hrp/hazards/) and human health risks, used to design the Risk Center and to link indicators to hazards; NASA figures on bone loss (1%–1.5% per month) and ~2 h/day exercise countermeasure.

## 8. Space Agency Partner Data and Other References
- Canadian Space Agency — TBone studies (bone loss up to 1.5% per month).
- American Heart Association — resting heart rate 60–100 bpm.
- Whelton et al., 2017 ACC/AHA Hypertension Guideline (Hypertension, 2018) — blood-pressure categories.
- WHO Pulse Oximetry Training Manual (2011) — SpO2 ranges and hypoxemia threshold.
- CDC — fever definition (≥38.0 °C / 100.4 °F).
- Watson et al., AASM/SRS consensus, Sleep (2015) — ≥7 h sleep for adults.
- Barger et al., Lancet Neurology (2014) — sleep of astronauts on ISS missions.
- Samn & Perelli (1982) — 7-point fatigue scale.
- American Diabetes Association Standards of Care — glucose levels.
- Costes/Overbey et al., "Inspiration4 data access through the NASA Open Science Data Repository", npj Microgravity 10:56 (2024).
- Tools: Playwright, Google Chrome, FFmpeg, Node.js, Python. No third-party images, fonts or music.

---

## Limitations and future work (include at the end of the Detailed Description if space allows)
Prototype, not a medical device; it does not diagnose. Crew values in the demo are synthetic and labeled as such. No direct sensor integration (values are entered manually). Sync is demonstrated between two local stores — a real deployment needs a delay-tolerant ground server. Thresholds marked "engine convention" (2 SD, 7-day window, 36 h without data) are engineering choices that need validation with flight surgeons. Future: wearable/medical-device integration, multi-crew view, delay-tolerant networking, multilingual UI, validation in analog missions.

## Team contributions
- **Etner Therry Rios Vasquez** (team owner): coordination, architecture, product decisions, presentation.
- **Jeanfranco Alfredo Ibarra Kocfú:** technical implementation support and testing. *(adjust to real work)*
- **Darlin Saldaña Pinedo:** scientific research and documentation. *(adjust to real work)*
- **Máximo Fabrizzio Espinoza Peche:** testing, validation and presentation. *(adjust to real work)*
