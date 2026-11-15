"""Builds dist/index.html — a single self-contained file (no external requests, works offline)."""
import pathlib
root = pathlib.Path(__file__).parent
t = (root/'src/index.html').read_text()
import urllib.parse
t = t.replace('/*FAVICON*/', 'data:image/svg+xml,' + urllib.parse.quote((root/'assets/brand/astra-vital-favicon.svg').read_text().strip()))
t = t.replace('/*STYLES*/', (root/'src/styles.css').read_text())
t = t.replace('/*OSDR*/', (root/'data/osdr_i4_subset.json').read_text())
t = t.replace('/*ENGINE*/', (root/'src/engine.js').read_text())
t = t.replace('/*APP*/', (root/'src/app.js').read_text())
(root/'dist').mkdir(exist_ok=True)
(root/'dist/index.html').write_text(t)
(root/'index.html').write_text(t)  # GitHub Pages entry point
print('dist/index.html', len(t), 'bytes')
