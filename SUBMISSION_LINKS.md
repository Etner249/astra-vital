# ASTRA VITAL — Submission Links (NASA Space Apps Challenge 2026)

All links verified on **2026-11-15** without signing in (see PUBLICATION_REPORT.md).

| Resource | URL |
|---|---|
| Public application (GitHub Pages, HTTPS) | https://etner249.github.io/astra-vital/ |
| Public GitHub repository | https://github.com/Etner249/astra-vital |
| 30-second demo video (YouTube, public) | https://youtu.be/lxITVao2RmQ |
| Extended presentation video (YouTube, public, 1:47) | https://youtu.be/sz9qzXasEKc |

## Team
**NYXARA NOVA** — *We control the unseen.* Local event: Trujillo, Peru.
Etner Therry Rios Vasquez (team owner) · Jeanfranco Alfredo Ibarra Kocfú · Darlin Saldaña Pinedo · Máximo Fabrizzio Espinoza Peche

## Challenge
2026 NASA Space Apps Challenge — *Create Health Monitoring Software for Astronauts on Space Missions*
https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/

## NASA data and references
- NASA OSDR **OSD-575** — SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays (file LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv): https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
- NASA OSDR **OSD-569** — Whole Blood Measurements from the SpaceX Inspiration4 Mission (file LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv): https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
- These are pre-/post-flight clinical lab values from 4 civilian crew members (3-day mission); they are shown as research data, **not** as continuous in-flight vital signs.
- NASA Human Research Program — five hazards of human spaceflight: https://www.nasa.gov/hrp/hazards/
- Clinical reference sources (AHA, ACC/AHA 2017, WHO, CDC, AASM/SRS, ADA, Samn-Perelli) are cited in the app and in docs/SUBMISSION.md.

## AI disclosure
AI assistant (Claude, Anthropic) used for code, tests, documentation and video assembly; idea and decisions by the team. No AI model runs inside the app (rule-based engine). Video narration is an AI-generated voice (Kokoro-82M TTS) and the team emblem is AI-generated — both labeled on screen, in video metadata and in YouTube descriptions. Details: docs/AI_DISCLOSURE.md.

## Known limitations
Educational prototype, not a medical device, no clinical validation. Demo vital signs are synthetic and labeled. Manual data entry (no sensor integration). Sync is demonstrated between two local stores (no real ground server). Engine conventions (2 SD, 7-day window, 36 h) need validation with flight surgeons. OSDR data: n = 4, 3-day mission — no causal claims.
