"""Records REAL interactions with the built ASTRA VITAL app (dist/index.html) using the Chrome DevTools
screencast (JPEG q92, 1920x1080). Each segment becomes a constant-30fps MP4 of exact duration.
A visible cursor overlay is injected so viewers can follow the clicks. Demo vitals are the app's synthetic set."""
import sys, base64, subprocess, pathlib, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent
APP = (ROOT.parent / 'dist/index.html').as_uri()
OUT = ROOT / 'parts'; OUT.mkdir(exist_ok=True)
CURSOR = """
(() => { const add = () => { if (document.getElementById('__cur')) return;
  const c = document.createElement('div'); c.id='__cur';
  c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 9-7 1.6L8.6 20z" fill="#fff" stroke="#070B14" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  c.style.cssText='position:fixed;left:0;top:0;z-index:99999;pointer-events:none;transform:translate(720px,420px);filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))';
  document.documentElement.appendChild(c);
  document.addEventListener('mousemove', e => { c.style.transform = `translate(${e.clientX-4}px,${e.clientY-2}px)`; }, true);
  document.addEventListener('mousedown', e => { const r=document.createElement('div');
    r.style.cssText=`position:fixed;left:${e.clientX-18}px;top:${e.clientY-18}px;width:36px;height:36px;border-radius:50%;border:2px solid #36D6E7;z-index:99998;pointer-events:none;transition:all .45s ease-out;opacity:1`;
    document.documentElement.appendChild(r); requestAnimationFrame(()=>{r.style.transform='scale(1.8)';r.style.opacity='0'}); setTimeout(()=>r.remove(),500); }, true);
  const st=document.createElement('style'); st.textContent='html{scroll-behavior:auto!important}'; document.head.appendChild(st);
}; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add(); })();
"""

class Rec:
    def __init__(self, browser):
        self.ctx = browser.new_context(viewport={'width': 1440, 'height': 810}, device_scale_factor=4/3)
        self.ctx.add_init_script(CURSOR)
        self.p = self.ctx.new_page(); self.mx, self.my = 720, 420
    def open(self, h):
        self.p.goto(APP + h); self.p.wait_for_timeout(500); self.p.mouse.move(self.mx, self.my); self.p.evaluate(CURSOR); self.p.wait_for_timeout(100)
    def start(self):
        self.frames = []; self.cdp = self.ctx.new_cdp_session(self.p)
        def on(ev):
            self.frames.append((time.time(), base64.b64decode(ev['data'])))
            try: self.cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']})
            except Exception: pass
        self.cdp.on('Page.screencastFrame', on)
        self.cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 92, 'maxWidth': 1920, 'maxHeight': 1080, 'everyNthFrame': 1})
        self.t0 = time.time(); self.wait(0.15)
    def wait(self, s): self.p.wait_for_timeout(int(s * 1000))
    def until(self, t):  # wait until t seconds since start
        d = t - (time.time() - self.t0)
        if d > 0: self.wait(d)
    def glide(self, x, y, dur=0.55):
        n = max(8, int(dur * 45)); sx, sy = self.mx, self.my
        for i in range(1, n + 1):
            k = i / n; e = k * k * (3 - 2 * k)
            self.p.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e); self.p.wait_for_timeout(int(dur * 1000 / n))
        self.mx, self.my = x, y
    def to(self, sel, dur=0.55, dx=0.5, dy=0.5):
        el = self.p.locator(sel).first; el.scroll_into_view_if_needed(); b = el.bounding_box()
        self.glide(b['x'] + b['width'] * dx, b['y'] + b['height'] * dy, dur)
    def click(self, sel, dur=0.55, dx=0.5, dy=0.5):
        self.to(sel, dur, dx, dy); self.p.mouse.down(); self.wait(0.07); self.p.mouse.up(); self.wait(0.12)
    def scroll(self, px, dur=1.2):
        self.p.evaluate("""([px,ms]) => new Promise(r => { const y0=scrollY, t0=performance.now();
          const f=t=>{ const k=Math.min(1,(t-t0)/ms), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2; scrollTo(0,y0+px*e); k<1?requestAnimationFrame(f):r(); }; requestAnimationFrame(f); })""", [px, int(dur * 1000)])
    def type(self, text, delay=0.11):
        for ch in text: self.p.keyboard.type(ch); self.wait(delay)
    def stop(self, name, dur, fps=30):
        self.wait(0.6); dur = max(dur, time.time() - self.t0)  # natural length; editor retimes to the slot
        self.until(dur + 0.1)
        self.cdp.send('Page.stopScreencast'); self.wait(0.1)
        fr = self.frames; assert fr, 'no frames'
        tmp = OUT / f'{name}.tmp.mp4'
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-',
            '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', '-r', str(fps), str(tmp)], stdin=subprocess.PIPE)
        j = 0
        for k in range(int(round(dur * fps))):
            t = self.t0 + k / fps
            while j + 1 < len(fr) and fr[j + 1][0] <= t: j += 1
            ff.stdin.write(fr[j][1])
        ff.stdin.close(); assert ff.wait() == 0
        tmp.rename(OUT / f'{name}.mp4'); print(name, dur, 's,', len(fr), 'source frames')
        self.ctx.close()

def queue_three(r):
    """Uses the real Log form (not recorded) so the sync queue holds 3 records."""
    r.open('#log?m=hr')
    for m, v in (('hr', '66'), ('temp', '36.7'), ('sleep', '6.1')):
        r.p.select_option('#metric', m); r.p.fill('#val', v); r.p.click('#f button[type=submit]'); r.wait(0.15)

def seg(b, name, dur):
    r = Rec(b)
    if name == 's_dash':
        r.open('#dashboard'); r.start(); r.to('a.card >> nth=0', .7); r.wait(.5); r.to('a.card >> nth=2', .7); r.wait(.5); r.scroll(560, 1.6); r.to('.card:has-text("Sleep trend")', .6, .5, .6)
    elif name == 's_intel':
        r.open('#body?s=cardio'); r.start(); r.click('g.zone[data-s=nervous]', .5); r.wait(.6)
        r.click('nav a[data-v=alerts]', .5); r.wait(.25); r.click('.alert.priority .head', .45); r.wait(.8)
        r.click('nav a[data-v=risk]', .5)
    elif name == 's_sync':
        queue_three(r); r.open('#sync'); r.start(); r.to('.pill:has-text("Queued")', .5); r.wait(.25)
        r.click('#link', .45); r.wait(.25); r.click('#sync', .4); r.wait(.9)
        r.click('nav a[data-v=nasa]', .5); r.wait(.5); r.click('.tab:has-text("Hemoglobin")', .5)
    elif name == 'e_dash':
        r.open('#dashboard'); r.start(); r.to('.status-hero', .7); r.wait(.4); r.to('a.card >> nth=4', .7); r.wait(.3); r.scroll(520, 1.5); r.wait(.4)
        r.click('nav a[data-v=profile]', .6); r.wait(.6); r.to('table >> nth=0', .7)
    elif name == 'e_log_body':
        r.open('#log?m=hr'); r.start(); r.click('#metric', .5); r.p.keyboard.press('Escape'); r.p.select_option('#metric', 'sleep'); r.wait(.4)
        r.click('#val', .5); r.type('6.4'); r.wait(.2); r.click('#f button[type=submit]', .5); r.wait(.9)
        r.click('nav a[data-v=body]', .5); r.wait(.5); r.click('g.zone[data-s=musculo]', .55); r.wait(.8); r.click('g.zone[data-s=nervous]', .55)
    elif name == 'e_alerts':
        r.open('#alerts'); r.start(); r.wait(.4); r.click('.alert.priority .head', .7); r.wait(1.2); r.scroll(260, 1.2); r.to('.alert.priority .src', .6); r.wait(1.2)
        r.click('.alert:has-text("Sleep duration") .head', .7); r.wait(.5); r.scroll(380, 1.3); r.wait(.8); r.click('.tab:has-text("Follow-up")', .7)
    elif name == 'e_risk':
        r.open('#risk'); r.start(); r.wait(.5); r.to('.hazard >> nth=0', .6); r.scroll(520, 2.2); r.to('.hazard >> nth=3', .6); r.scroll(420, 1.8)
    elif name == 'e_sync':
        queue_three(r); r.open('#sync'); r.start(); r.to('.pill:has-text("LOS")', .6); r.wait(.4); r.to('.pill:has-text("Queued")', .5); r.wait(.5)
        r.click('#link', .6); r.wait(.5); r.click('#sync', .5); r.wait(1.3); r.to('.log', .6); r.wait(.7); r.click('nav a[data-v=ground]', .6)
    elif name == 'e_nasa':
        r.open('#nasa'); r.start(); r.wait(.4); r.to('.card:has-text("Dataset") td >> nth=1', .7); r.wait(1.2); r.click('.tab:has-text("Hemoglobin")', .7); r.wait(1.1)
        r.to('.card:has-text("Dataset") td >> nth=1', .6); r.wait(.8); r.click('.tab:has-text("White blood cells")', .7); r.wait(.8); r.scroll(560, 1.6); r.to('.tablewrap tr >> nth=3', .6)
    r.stop(name, dur)

if __name__ == '__main__':
    # usage: rec_app.py name:dur [name:dur ...]
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for a in sys.argv[1:]:
            n, d = a.split(':'); seg(b, n, float(d))
        b.close()
