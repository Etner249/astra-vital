"""Generates the female English narration with Kokoro-82M (ONNX, local, Apache-2.0), voice af_heart.
Model files: github.com/thewh1teagle/kokoro-onnx releases (model-files-v1.0)."""
import json, sys, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
MODEL = '/home/claude/tts/kokoro-v1.0.onnx'; VOICES = '/home/claude/tts/voices-v1.0.bin'
VOICE = 'af_heart'
FIX = [('ASTRA VITAL', 'Astra Vital'), ('NYXARA NOVA', 'Nixara Nova'), ('Inspiration4', 'Inspiration Four'), ('2026', 'twenty twenty-six')]
SHORT = [
 'Beyond Earth, monitoring astronaut health becomes a critical mission challenge.',
 'Meet ASTRA VITAL, an intelligent health monitoring prototype by NYXARA NOVA.',
 'It helps crew members track health indicators, understand trends, and identify concerning changes.',
 "An explainable alert engine connects health monitoring with NASA's five spaceflight hazards.",
 'Offline-first records support continuity, alongside documented Inspiration4 research data.',
 'ASTRA VITAL. Protecting human health beyond Earth.']
EXT = [
 'Human exploration beyond Earth brings extraordinary challenges. During long-duration space missions, understanding changes in astronaut health becomes essential.',
 "Spaceflight can affect cardiovascular function, bone and muscle health, sleep, behavior, and the body's response to its environment. Astronauts need clear information to monitor these changes.",
 'ASTRA VITAL is an offline-first astronaut health monitoring prototype developed by NYXARA NOVA for the NASA Space Apps Challenge 2026.',
 'The Mission Dashboard brings health records, recent measurements, alerts, and trends into one clear operational view.',
 'Crew members can record physiological and behavioral indicators, explore related body systems, and review their personal health history.',
 'Its transparent, rule-based engine identifies unusual changes and explains why an alert appears, what it means, and when medical attention should be considered.',
 "ASTRA VITAL connects health indicators with NASA's five human spaceflight hazards: space radiation, isolation, distance from Earth, gravity fields, and hostile environments.",
 'Designed for intermittent connectivity, it stores records locally and queues synchronization when a connection becomes available.',
 "The prototype also explores real laboratory datasets from NASA's Inspiration4 research, while keeping demonstration vital signs clearly labeled as synthetic.",
 'ASTRA VITAL. Clearer health insights for human exploration beyond Earth. NYXARA NOVA. We control the unseen.']
def spoken(t):
    for a, b in FIX: t = t.replace(a, b)
    return t
k = Kokoro(MODEL, VOICES)
out = {}
speed = {'short': float(sys.argv[1]) if len(sys.argv) > 1 else 1.0, 'ext': float(sys.argv[2]) if len(sys.argv) > 2 else 1.0}
for name, lines in (('short', SHORT), ('ext', EXT)):
    out[name] = []
    for i, t in enumerate(lines):
        s, sr = k.create(spoken(t), voice=VOICE, speed=speed[name], lang='en-us')
        # trim leading/trailing silence
        idx = np.where(np.abs(s) > 0.01)[0]; s = s[max(0, idx[0] - 600): idx[-1] + 2400]
        f = f'audio/lines/{name}_{i+1:02d}.wav'; sf.write(f, s, sr)
        out[name].append({'text': t, 'spoken': spoken(t), 'file': f, 'dur': round(len(s) / sr, 3), 'sr': sr})
        print(name, i + 1, out[name][-1]['dur'])
json.dump(out, open('audio/lines.json', 'w'), indent=1)
