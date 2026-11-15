"""Deterministic frame-by-frame rendering of the HTML motion scenes (30 fps, 1920x1080) piped into FFmpeg."""
import sys, subprocess, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent
URL = (ROOT / 'scenes/scenes.html').as_uri()
SEEK = """t => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }); }"""
def render(page, scene, dur, out, arg=None, fps=30, stills=None):
    page.goto(URL + f'?scene={scene}' + (f'&arg={arg}' if arg else '')); page.wait_for_timeout(400)
    page.evaluate("document.fonts.ready")
    if stills:
        for t in stills:
            page.evaluate(SEEK, t * 1000); page.screenshot(path=str(out).replace('.mp4', f'_{t}.jpg'), type='jpeg', quality=90)
        return
    tmp = str(out).replace('.mp4', '.tmp.mp4')
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', str(fps), tmp], stdin=subprocess.PIPE)
    n = int(round(dur * fps))
    for f in range(n):
        page.evaluate(SEEK, f * 1000 / fps)
        ff.stdin.write(page.screenshot(type='jpeg', quality=92))
    ff.stdin.close(); assert ff.wait() == 0
    pathlib.Path(tmp).rename(out)
def browser(p):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--allow-file-access-from-files'])
    return b, b.new_page(viewport={'width': 1920, 'height': 1080})
if __name__ == '__main__':
    # usage: render_scenes.py scene dur out [arg] [--stills t1,t2]
    with sync_playwright() as p:
        b, pg = browser(p)
        a = sys.argv
        st = [float(x) for x in a[a.index('--stills') + 1].split(',')] if '--stills' in a else None
        arg = a[4] if len(a) > 4 and not a[4].startswith('--') else None
        render(pg, a[1], float(a[2]), a[3], arg, stills=st); b.close()
