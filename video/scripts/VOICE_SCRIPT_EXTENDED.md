# ASTRA VITAL — Voice script: Extended presentation — 90–120 s

Final duration: **106.5 s**. Voice: **Kokoro-82M (ONNX), voice `af_heart`** — female, US English, local open-weight TTS (Apache-2.0). Speed 1.0. This is an **AI-generated (synthetic) voice**, not a human recording.

| # | Time in video | Narration (as written / subtitles) | Text sent to TTS (pronunciation fixes) |
|---|---|---|---|
| 1 |   0.60– 10.75 s | Human exploration beyond Earth brings extraordinary challenges. During long-duration space missions, understanding changes in astronaut health becomes essential. | `Human exploration beyond Earth brings extraordinary challenges. During long-duration space missions, understanding changes in astronaut health becomes essential.` |
| 2 |  11.65– 24.20 s | Spaceflight can affect cardiovascular function, bone and muscle health, sleep, behavior, and the body's response to its environment. Astronauts need clear information to monitor these changes. | `Spaceflight can affect cardiovascular function, bone and muscle health, sleep, behavior, and the body's response to its environment. Astronauts need clear information to monitor these changes.` |
| 3 |  25.10– 34.88 s | ASTRA VITAL is an offline-first astronaut health monitoring prototype developed by NYXARA NOVA for the NASA Space Apps Challenge 2026. | `Astra Vital is an offline-first astronaut health monitoring prototype developed by Nixara Nova for the NASA Space Apps Challenge twenty twenty-six.` |
| 4 |  35.77– 42.73 s | The Mission Dashboard brings health records, recent measurements, alerts, and trends into one clear operational view. | `The Mission Dashboard brings health records, recent measurements, alerts, and trends into one clear operational view.` |
| 5 |  43.63– 51.82 s | Crew members can record physiological and behavioral indicators, explore related body systems, and review their personal health history. | `Crew members can record physiological and behavioral indicators, explore related body systems, and review their personal health history.` |
| 6 |  52.72– 63.08 s | Its transparent, rule-based engine identifies unusual changes and explains why an alert appears, what it means, and when medical attention should be considered. | `Its transparent, rule-based engine identifies unusual changes and explains why an alert appears, what it means, and when medical attention should be considered.` |
| 7 |  63.98– 75.40 s | ASTRA VITAL connects health indicators with NASA's five human spaceflight hazards: space radiation, isolation, distance from Earth, gravity fields, and hostile environments. | `Astra Vital connects health indicators with NASA's five human spaceflight hazards: space radiation, isolation, distance from Earth, gravity fields, and hostile environments.` |
| 8 |  76.30– 83.79 s | Designed for intermittent connectivity, it stores records locally and queues synchronization when a connection becomes available. | `Designed for intermittent connectivity, it stores records locally and queues synchronization when a connection becomes available.` |
| 9 |  84.69– 95.36 s | The prototype also explores real laboratory datasets from NASA's Inspiration4 research, while keeping demonstration vital signs clearly labeled as synthetic. | `The prototype also explores real laboratory datasets from NASA's Inspiration Four research, while keeping demonstration vital signs clearly labeled as synthetic.` |
| 10 |  96.26–103.80 s | ASTRA VITAL. Clearer health insights for human exploration beyond Earth. NYXARA NOVA. We control the unseen. | `Astra Vital. Clearer health insights for human exploration beyond Earth. Nixara Nova. We control the unseen.` |

Pronunciation fixes: ASTRA VITAL → "Astra Vital", NYXARA NOVA → "Nixara Nova" (/nɪkˈsɑːrə/), Inspiration4 → "Inspiration Four", 2026 → "twenty twenty-six". NASA is read as a word (/ˈnæsə/).

## Reproduce
```bash
pip install kokoro-onnx soundfile
# model files (GitHub release thewh1teagle/kokoro-onnx, model-files-v1.0): kokoro-v1.0.onnx, voices-v1.0.bin
python3 video/narration.py 1.2 1.0     # per-line WAVs in video/audio/lines/
python3 video/edit.py ext            # narration WAV, music, subtitles, final MP4s
```
