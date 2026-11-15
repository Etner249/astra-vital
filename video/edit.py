"""Final edit for both ASTRA VITAL videos: narration timeline, original music, ducking, subtitles, framing, crossfades.
Usage: python3 edit.py short|ext"""
import json, sys, subprocess, pathlib, re
import numpy as np, soundfile as sf
ROOT = pathlib.Path(__file__).resolve().parent
LINES = json.load(open(ROOT / 'audio/lines.json'))
FONT = '/usr/share/fonts/opentype/inter/Inter-Regular.otf'
SR = 24000; XF = 0.4

CFG = {
 'short': dict(name='ASTRA_VITAL_NASA_DEMO_30S', end=29.6, lead=0.2, gap=0.35, key='short', srt='ASTRA_VITAL_NASA_DEMO',
   cuts=[('m_problem', 'm', 0.0), ('m_logo', 'm', 4.25), ('s_dash', 'a', 9.25), ('s_intel', 'a', 15.05), ('s_sync', 'a', 20.15), ('m_close', 'm', 26.25)]),
 'ext': dict(name='ASTRA_VITAL_EXTENDED_PRESENTATION', end=106.5, lead=0.6, gap=0.9, key='ext', srt='ASTRA_VITAL_EXTENDED',
   cuts=[('m_e_intro', 'm', 0.0), ('m_e_problem', 'm', 11.2), ('m_e_meet', 'm', 24.65), ('e_dash', 'a', 35.3), ('e_log_body', 'a', 43.2), ('e_alerts', 'a', 52.3),
         ('m_e_ridge', 'm', 63.5), ('e_risk', 'a', 69.5), ('e_sync', 'a', 76.0), ('e_nasa', 'a', 84.2), ('m_e_close', 'm', 95.8)]),
}

def dur(f): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)]).decode())

def narration(c):
    t = c['lead']; track = np.zeros(int(c['end'] * SR) + SR); cues = []
    for ln in LINES[c['key']]:
        a, _ = sf.read(ROOT / ln['file']); s = int(t * SR); track[s:s + len(a)] += a
        cues.append((t, t + len(a) / SR, ln['text'])); t += len(a) / SR + c['gap']
    assert t - c['gap'] <= c['end'] - 0.15, f'narration too long: {t}'
    track = track[:int(c['end'] * SR)]
    out = ROOT / f"audio/narration_{'30s' if c['key'] == 'short' else 'extended'}.wav"; sf.write(out, track, SR, subtype='PCM_16')
    return out, cues

def split_text(text, maxc=100):
    """Sentence-based cues; a sentence longer than two lines is split once at the most balanced clause boundary."""
    out = []
    for sent in re.split(r'(?<=[.:])\s+', text):
        if len(sent) <= maxc: out.append(sent); continue
        words = sent.split(); best = None
        for i in range(3, len(words) - 2):
            x, y = ' '.join(words[:i]), ' '.join(words[i:]); pen = abs(len(x) - len(y)) - (30 if x.endswith(',') else 0)
            if best is None or pen < best[0]: best = (pen, [x, y])
        out += best[1]
    return out

def wrap2(s, n=52):
    if len(s) <= n: return s
    words = s.split(); best = None
    for i in range(1, len(words)):
        a, b = ' '.join(words[:i]), ' '.join(words[i:]); sc = max(len(a), len(b))
        if best is None or sc < best[0]: best = (sc, a + '\n' + b)
    return best[1]

def srt(cues, name):
    def ts(x): h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60; return f'{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'.replace(',1000', ',999')
    out = []; i = 1
    for a, b, text in cues:
        parts = split_text(text); tot = sum(len(p) for p in parts); t = a
        for p in parts:
            d = (b - a) * len(p) / tot; out.append(f'{i}\n{ts(t)} --> {ts(min(t + d, b) - 0.02)}\n{wrap2(p)}\n'); t += d; i += 1
    f = ROOT / f'subtitles/{name}.en.srt'; f.write_text('\n'.join(out)); return f

def music(c, out):
    """Original ambient score (synthesized by this script — no third-party music)."""
    sr = 48000; T = c['end'] + 1; t = np.arange(int(T * sr)) / sr
    def note(f): return np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2 * f * t + 1) + .12 * np.sin(2 * np.pi * 3 * f * t + 2)
    hz = lambda n: 440 * 2 ** ((n - 69) / 12)
    chords = [[45, 52, 57, 60, 64], [41, 48, 57, 60, 65], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62]]  # Am F C G
    seg = 8.0; y = np.zeros_like(t)
    for k in range(int(T // seg) + 1):
        ch = chords[k % 4]; env = np.clip((t - k * seg) / 2.0, 0, 1) * np.clip((k * seg + seg + 2.0 - t) / 2.0, 0, 1)
        if env.max() == 0: continue
        for n in ch:
            for det in (-0.0015, 0.0015): y += env * note(hz(n) * (1 + det)) * (0.5 if n < 50 else 0.28)
    # sparse high "telemetry" blips
    rng = np.random.default_rng(4); blip = np.zeros_like(t)
    for st in np.arange(1.0, T - 1, 2.0):
        n = int(st * sr); L = int(.35 * sr); f = hz(rng.choice([76, 79, 81, 84]))
        blip[n:n + L] += np.sin(2 * np.pi * f * np.arange(L) / sr) * np.exp(-np.arange(L) / sr * 9) * .25
    y = y / np.abs(y).max() * .6 + blip
    # soft heartbeat during intro (first 4 s)
    hb = np.zeros_like(t)
    for st in np.arange(0.3, 4.2, 1.0):
        for o, a in ((0, 1), (.28, .6)):
            n = int((st + o) * sr); L = int(.25 * sr); hb[n:n + L] += a * np.sin(2 * np.pi * 52 * np.arange(L) / sr) * np.exp(-np.arange(L) / sr * 16)
    y += hb * .9
    # simple reverb (exponentially decaying noise impulse)
    ir = rng.standard_normal(int(1.6 * sr)) * np.exp(-np.arange(int(1.6 * sr)) / sr * 3.2); ir /= np.abs(ir).sum() / 6
    from numpy.fft import rfft, irfft
    N = 1 << int(np.ceil(np.log2(len(y) + len(ir)))); wet = irfft(rfft(y, N) * rfft(ir, N), N)[:len(y)]
    y = .6 * y + .4 * wet
    fade = np.clip(t / 1.5, 0, 1) * np.clip((c['end'] - t) / 2.5, 0, 1); y *= fade
    y = y / np.abs(y).max() * .9
    sf.write(out, np.stack([y, y], 1)[:int(c['end'] * sr)], sr, subtype='PCM_16')

def build(kind):
    c = CFG[kind]; parts = ROOT / 'parts'
    nar, cues = narration(c); s = srt(cues, c['srt'])
    mus = ROOT / f'assets/music/astra_vital_score_{kind}.wav'; music(c, mus)
    # mixed audio: music ducked under the voice, loudness-normalized
    mix = ROOT / f'audio/mix_{kind}.wav'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(nar), '-i', str(mus), '-filter_complex',
        '[0:a]aresample=48000,highpass=f=70,acompressor=threshold=0.1:ratio=2.5:attack=5:release=120,volume=1.0,asplit=2[v][sc];'
        '[1:a]volume=0.22[m];[m][sc]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=500[md];'
        '[v][md]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11',
        '-ar', '48000', '-t', str(c['end']), str(mix)], check=True)
    # video graph
    ins = []; fil = []; cuts = c['cuts']
    for i, (n, typ, start) in enumerate(cuts):
        end = cuts[i + 1][2] if i + 1 < len(cuts) else c['end']
        L = end - start + (XF if i + 1 < len(cuts) else 0)
        f = parts / f'{n}.mp4'; ins += ['-i', str(f)]; D = dur(f)
        if typ == 'a':
            spd = max(1.0, D / L)
            fil.append(f'[{i}:v]setpts=PTS/{spd:.4f},tpad=stop_mode=clone:stop_duration=3,trim=duration={L:.3f},setpts=PTS-STARTPTS,fps=30,'
                       f'scale=1600:900:flags=lanczos,pad=1920:1080:160:14:color=0x070B14,drawbox=x=157:y=11:w=1606:h=906:color=0x2A3D5E:t=3,'
                       f"drawtext=fontfile={FONT}:text='REAL APPLICATION CAPTURE · DEMO VITAL SIGNS ARE SYNTHETIC':fontsize=15:fontcolor=0x5F7394:x=160:y=1058,format=yuv420p[s{i}]")
            print(f'  {n}: natural {D:.2f}s -> slot {L:.2f}s (speed x{spd:.2f})')
        else:
            assert D >= L - 0.05, f'{n} too short {D} < {L}'
            fil.append(f'[{i}:v]tpad=stop_mode=clone:stop_duration=1,trim=duration={L:.3f},setpts=PTS-STARTPTS,fps=30,format=yuv420p[s{i}]')
    prev = 's0'
    for i in range(1, len(cuts)):
        o = cuts[i][2]; fil.append(f'[{prev}][s{i}]xfade=transition=fade:duration={XF}:offset={o:.3f}[x{i}]'); prev = f'x{i}'
    fil.append(f'[{prev}]trim=duration={c["end"]},setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.5,fade=t=out:st={c["end"] - 0.7}:d=0.7[vout]')
    style = 'FontName=Inter,FontSize=12,PrimaryColour=&H00FFFFFF,OutlineColour=&H200B0705,BackColour=&H200B0705,BorderStyle=3,Outline=5,Shadow=0,MarginV=16,Alignment=2'
    fil.append(f"[vout]split=2[vc][vb];[vb]subtitles={s}:force_style='{style}'[vsub]")
    fin = ROOT / 'final'; clean = fin / f"{c['name']}_NO_SUBS.mp4"; burned = fin / f"{c['name']}.mp4"
    cmd = ['ffmpeg', '-y', '-loglevel', 'error'] + ins + ['-i', str(mix), '-filter_complex', ';'.join(fil),
        '-map', '[vsub]', '-map', f'{len(cuts)}:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', str(c['end']), str(fin / 'tmp_burned.mp4'),
        '-map', '[vc]', '-map', f'{len(cuts)}:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', str(c['end']), str(fin / 'tmp_clean.mp4')]
    subprocess.run(cmd, check=True)
    (fin / 'tmp_burned.mp4').rename(burned); (fin / 'tmp_clean.mp4').rename(clean)
    print(burned, dur(burned)); print(clean, dur(clean))

if __name__ == '__main__': build(sys.argv[1])
