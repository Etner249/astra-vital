# AI / Super Intelligence (SI) Usage Disclosure — ASTRA VITAL (NYXARA NOVA)

Required by the NASA Space Apps Challenge 2026 rules: images and videos made with SI must carry a visible watermark; SI audio, code and data must be acknowledged in descriptive text and metadata.

| Element | SI used? | How it is disclosed |
|---|---|---|
| Project idea, scope, decisions | No — team decision | — |
| Application code, tests, docs | Yes — AI assistant (Claude, Anthropic) helped write and review; reviewed by the team | README, this file, submission form |
| Health rules and thresholds | Written with AI assistance, every threshold tied to a cited public source and reviewed by the team | In-app references, `src/engine.js` SOURCES |
| AI model inside the app | **None** — the engine is rule-based and explainable | About page |
| Video narration (both videos) | **Yes — AI-generated voice**: Kokoro-82M TTS (open-weight, Apache-2.0), voice `af_heart`, run locally | On-screen text in closing scenes, MP4 metadata `comment`, YouTube description, `video/scripts/` |
| Team emblem (NYXARA NOVA) | **Yes — AI-generated image** (confirmed by team) | Visible label "AI-GENERATED TEAM EMBLEM" in the video; NASA insignia removed |
| Other visuals (Earth, astronaut, station, charts, logo) | No — original vector/HTML artwork drawn in code | Video credits |
| App footage | No — real screen recordings of the delivered app (Chrome DevTools screencast) | On-screen label "Real application capture" |
| Music | No — original procedural score synthesized by `video/edit.py` | Video credits |
| Video editing/assembly | Scripted with AI assistance (Playwright + FFmpeg pipeline) | This file |
| NASA data | Real, unmodified OSDR values (OSD-575, OSD-569) | NASA Data view, README |
