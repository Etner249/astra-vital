# ASTRA VITAL — Voice script: NASA demo — 30 s

Final duration: **29.6 s**. Voice: **Kokoro-82M (ONNX), voice `af_heart`** — female, US English, local open-weight TTS (Apache-2.0). Speed 1.2. This is an **AI-generated (synthetic) voice**, not a human recording.

| # | Time in video | Narration (as written / subtitles) | Text sent to TTS (pronunciation fixes) |
|---|---|---|---|
| 1 |   0.20–  4.08 s | Beyond Earth, monitoring astronaut health becomes a critical mission challenge. | `Beyond Earth, monitoring astronaut health becomes a critical mission challenge.` |
| 2 |   4.43–  9.06 s | Meet ASTRA VITAL, an intelligent health monitoring prototype by NYXARA NOVA. | `Meet Astra Vital, an intelligent health monitoring prototype by Nixara Nova.` |
| 3 |   9.41– 14.83 s | It helps crew members track health indicators, understand trends, and identify concerning changes. | `It helps crew members track health indicators, understand trends, and identify concerning changes.` |
| 4 |  15.18– 19.96 s | An explainable alert engine connects health monitoring with NASA's five spaceflight hazards. | `An explainable alert engine connects health monitoring with NASA's five spaceflight hazards.` |
| 5 |  20.31– 26.04 s | Offline-first records support continuity, alongside documented Inspiration4 research data. | `Offline-first records support continuity, alongside documented Inspiration Four research data.` |
| 6 |  26.39– 29.18 s | ASTRA VITAL. Protecting human health beyond Earth. | `Astra Vital. Protecting human health beyond Earth.` |

Pronunciation fixes: ASTRA VITAL → "Astra Vital", NYXARA NOVA → "Nixara Nova" (/nɪkˈsɑːrə/), Inspiration4 → "Inspiration Four", 2026 → "twenty twenty-six". NASA is read as a word (/ˈnæsə/).

## Reproduce
```bash
pip install kokoro-onnx soundfile
# model files (GitHub release thewh1teagle/kokoro-onnx, model-files-v1.0): kokoro-v1.0.onnx, voices-v1.0.bin
python3 video/narration.py 1.2 1.0     # per-line WAVs in video/audio/lines/
python3 video/edit.py short            # narration WAV, music, subtitles, final MP4s
```
