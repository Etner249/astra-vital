# Video Production Report — ASTRA VITAL (NYXARA NOVA)

## Deliverables (verified: full decode with FFmpeg, no errors)
| File | Duration | Video | Audio | Subtitles |
|---|---|---|---|---|
| `video/final/ASTRA_VITAL_NASA_DEMO_30S.mp4` | **29.60 s** (≤ 30 s ✔) | 1920×1080, H.264, 30 fps, CRF 18 (~1.5 Mb/s) | AAC 48 kHz 192 kb/s, −16.1 LUFS, peak −1.5 dBFS | English, burned in |
| `video/final/ASTRA_VITAL_NASA_DEMO_30S_NO_SUBS.mp4` | 29.60 s | same | same | none (use SRT) |
| `video/final/ASTRA_VITAL_EXTENDED_PRESENTATION.mp4` | **106.50 s** (90–120 s ✔) | same (~1.3 Mb/s) | AAC 48 kHz, −16.2 LUFS, peak −1.5 dBFS | English, burned in |
| `video/final/ASTRA_VITAL_EXTENDED_PRESENTATION_NO_SUBS.mp4` | 106.50 s | same | same | none |
| `video/subtitles/ASTRA_VITAL_NASA_DEMO.en.srt` | 7 cues | | | timed from the narration audio |
| `video/subtitles/ASTRA_VITAL_EXTENDED.en.srt` | 23 cues | | | |
| `video/audio/narration_30s.wav`, `narration_extended.wav` | voice-only tracks (24 kHz, 16-bit) | | | |
| `video/final/ASTRA_VITAL_THUMBNAIL.png` (+ 1280×720) | | | | |
Black-frame check: only the intentional 0.27 s fade-in at the start of the extended video. No silence gaps > 2 s.

## Narration
Engine: **Kokoro-82M** (ONNX, local, open weights, Apache-2.0) via `kokoro-onnx`; voice **af_heart** (female, US English). Speed 1.2 for the 30 s video (to fit the official limit), 1.0 for the extended video. Pronunciations verified at phoneme level: "Astra Vital" /ˈæstrə ˈvaɪtəl/, "Nixara Nova" /nɪkˈsɑːrə ˈnoʊvə/, "Inspiration Four", NASA /ˈnæsə/. **This is an AI-generated voice, not a human recording** — disclosed on screen, in MP4 metadata and in the docs. Note: quality was checked technically (levels, timing, phonemes); a human should listen once before submitting.

## Visual pipeline
1. **Real app recordings** (`video/rec_app.py`): Playwright drives the built app (`dist/index.html`) in Chrome; frames captured with the DevTools screencast (JPEG q92, 1920×1080) and resampled to constant 30 fps. A visible cursor overlay shows clicks. Interactions recorded: Mission Dashboard + indicators, Astronaut Profile, logging a sleep value, Interactive Body (system selection), Health Intelligence (explainable alert with sources, filters), Mission Risk Center (five hazards), Sync (queued records → communication window → sync, log, Ground Console), NASA Data (OSD-575 / OSD-569, quality table). Segments are sped up at most ×1.19 to fit the narration.
2. **Motion graphics** (`video/scenes/scenes.html` + `render_scenes.py`): original HTML/SVG scenes (starfield, night-side Earth, astronaut, space station, health tiles, RIDGE cards, logo draw-on animation, team identity, closing card) rendered frame-by-frame deterministically at 30 fps.
3. **Edit** (`video/edit.py`): app footage framed at 1600×900 with a caption band (subtitles never cover the UI) and the label "Real application capture · demo vital signs are synthetic"; 0.4 s crossfades; original procedural music ducked under the voice (sidechain); loudness-normalized (EBU R128, −16 LUFS); subtitles burned with libass (Inter, boxed).

## Structure
**30 s:** Problem (Earth + astronaut) 0–4.25 · Intro logo 4.25–9.25 · Dashboard 9.25–15.05 · Body → Alerts → Risk Center 15.05–20.15 · Sync → NASA Data 20.15–26.25 · Closing 26.25–29.6.
**Extended:** Intro 0–11.2 · Problem 11.2–24.65 · Meet ASTRA VITAL + team 24.65–35.3 · Dashboard/Profile 35.3–43.2 · Log + Body 43.2–52.3 · Health Intelligence 52.3–63.5 · Five hazards (motion + Risk Center) 63.5–76.0 · Offline sync 76.0–84.2 · NASA Data 84.2–95.8 · Final 95.8–106.5.

## App changes for branding (no functional change)
Single source for the original symbol in `src/app.js`; favicon (`assets/brand/astra-vital-favicon.svg`, inlined by `build.py`); logo on the About page; logo header on exported/printed reports; chart axis end labels no longer clipped ("Day 41" was cut to "Day 4"). Engine rules, NASA data, validations, persistence, routes and tests unchanged. Tests after changes: **10/10 unit, 27/27 end-to-end, 0 console errors**.

## Reproduce
```bash
python3 build.py && python3 video/render_all_scenes.py
python3 video/rec_app.py s_dash:5.8 s_intel:5.1 s_sync:6.1 e_dash:7.9 e_log_body:9.1 e_alerts:11.2 e_risk:6.5 e_sync:8.2 e_nasa:11.6
python3 video/narration.py 1.2 1.0 && python3 video/edit.py short && python3 video/edit.py ext
```

## Known limitations
- Voice is synthetic (AI); a human-recorded narration could replace `audio/narration_*.wav` (same timings) and `edit.py` re-mixes it.
- Earth, astronaut and station are stylized vector illustrations, not photographs (no licensed NASA imagery could be downloaded in this environment).
- The "offline" scene uses the app's in-app link simulation (LOS/AOS) — the app makes no network calls, so there is no real remote server to disconnect from; the video does not claim a real connection to a station or medical server.
