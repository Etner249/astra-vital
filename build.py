"""Builds index.html (GitHub Pages entry point) and dist/index.html — one self-contained file.

Academic edition: the page talks to the ASTRA VITAL Flask + SQLite API on Render.
API base URL: argument --api URL, or env AV_API_BASE, default = production backend.
The version submitted to NASA Space Apps 2026 is kept unchanged in nasa-2026/index.html (never rebuilt).
"""
import os
import pathlib
import sys
import urllib.parse

DEFAULT_API = 'https://astra-vital-academic.onrender.com/api/v1'
root = pathlib.Path(__file__).parent
api = os.environ.get('AV_API_BASE', DEFAULT_API)
if '--api' in sys.argv:
    api = sys.argv[sys.argv.index('--api') + 1]
api = api.rstrip('/')
u = urllib.parse.urlsplit(api)
if u.scheme not in ('https', 'http') or not u.netloc or '"' in api or ' ' in api:
    sys.exit(f'Invalid API base URL: {api!r}')
origin = f'{u.scheme}://{u.netloc}'

t = (root/'src/index.html').read_text()
t = t.replace('/*FAVICON*/', 'data:image/svg+xml,' + urllib.parse.quote((root/'assets/brand/astra-vital-favicon.svg').read_text().strip()))
t = t.replace('/*API_ORIGIN*/', origin)
t = t.replace('/*API_BASE*/', api)
t = t.replace('/*STYLES*/', (root/'src/styles.css').read_text())
t = t.replace('/*OSDR*/', (root/'data/osdr_i4_subset.json').read_text())
t = t.replace('/*ENGINE*/', (root/'src/engine.js').read_text())
t = t.replace('/*APP*/', (root/'src/app.js').read_text())
out = pathlib.Path(os.environ.get('AV_OUT_DIR', root))
(out/'dist').mkdir(parents=True, exist_ok=True)
(out/'dist/index.html').write_text(t)
(out/'index.html').write_text(t)  # GitHub Pages entry point
print('index.html', len(t), 'bytes · API', api)
