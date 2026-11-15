# ASTRA VITAL — Brand Guidelines (v1.0)

ASTRA VITAL is an independent project by team **NYXARA NOVA** (NASA Space Apps Challenge 2026, Trujillo, Peru). It is **not an official NASA product**. Never use NASA logos, the NASA "meatball"/"worm", flags or mission patches with this brand.

## 1. Symbol (original, preserved)
The symbol was extracted unchanged from the application (`src/app.js`, `.brand`). Geometry (viewBox 0 0 40 40):
- **Orbit ring** — circle r=18, stroke #36D6E7 (cyan), 1.5
- **Orbital trajectory** — ellipse rx=18 ry=6, rotated −25°, stroke #3B82F6 (blue), 1.2
- **Pulse signal** — path `M8 21h6l3-7 4 13 3-9 2 3h6`, stroke #E8EEF8, 2, round caps/joins

Meaning: human health (pulse) inside the space-exploration context (orbit + trajectory).

| File | Use |
|---|---|
| `assets/brand/astra-vital-logo.svg` | Primary horizontal logo: symbol + ASTRA VITAL + descriptor. Dark backgrounds. |
| `assets/brand/astra-vital-logo-white.svg` | One-color white version for photos, colored or busy backgrounds. |
| `assets/brand/astra-vital-symbol.svg` | Symbol only (app icon, avatars, small sizes ≥ 24 px). |
| `assets/brand/astra-vital-favicon.svg` | Symbol on #070B14 rounded square (browser tab; used by the app). |

Rules: keep proportions (scale uniformly); clear space ≥ ½ symbol height on all sides; minimum symbol size 24 px (favicon 16 px allowed); do not recolor single strokes, add effects, rotate or redraw. Wordmark text uses Inter Bold with wide tracking (0.14–0.2 em); the SVG wordmark uses live text with Inter → Segoe UI → Arial fallback — outline it before print production.

## 2. Color palette (from `src/styles.css`)
| Token | Hex | Use |
|---|---|---|
| Background | #070B14 | Main background |
| Background secondary | #0B1220 | Inputs, wells |
| Panel | #0F1828 | Cards |
| Panel secondary | #132036 | Hover, active nav |
| Cyan | #36D6E7 | Accent, focus, symbol ring |
| Blue | #3B82F6 | Secondary accent, trajectory |
| Text | #E8EEF8 | Primary text |
| Muted | #8FA3C2 | Secondary text |
Status colors (always paired with icon + text, never color alone): Nominal #3CCF91 · Follow-up #F2B440 · Priority #FF5D6C · Informative #7AA7FF. Hazard accents (RIDGE): R #FF8A5B · I #B48CFF · D #7AA7FF · G #36D6E7 · E #3CCF91.

## 3. Typography
Inter (Regular 400 / Medium 500 / SemiBold 600 / Bold 700–800). Labels: uppercase, 0.08–0.3 em tracking. Numbers: tabular figures. Code/data: system monospace.

## 4. Imagery and motion
- Deep-space backgrounds with a night-side Earth limb (city lights), a stylized astronaut and real application captures. All illustrations are original vector artwork; real UI captures are labeled; demo vital signs are always labeled **synthetic**.
- Motion: subtle (fade/rise 0.8–1.2 s, symbol "draw-on", slow drift). No glitch effects, no heavy holograms, no lens flares.
- Avoid: childish styles, generic "AI brain" visuals, illegible type, NASA branding.

## 5. Templates in this repo
| Asset | File |
|---|---|
| Video cover / thumbnail | `video/final/ASTRA_VITAL_THUMBNAIL.png` (1920×1080) and `_1280x720.png` |
| Intro screen | `video/assets/intro_card.png` |
| Closing screen | `video/assets/closing_card.png` |
| Team identity screen | `video/assets/team_identity.png` |
| Social media template (1080×1080, placeholders) | `video/assets/social_template_1080.png` — source `video/scenes/scenes.html?scene=social` |
| Motion scenes source | `video/scenes/scenes.html` |

## 6. Team identity
Team name **NYXARA NOVA**, slogan **WE CONTROL THE UNSEEN.** The team emblem (`assets/brand/team/`) is **AI-generated artwork** and must carry an "AI-generated" label wherever it appears in Space Apps materials. The original emblem contains the NASA insignia and **must not be used** in the submission (it is intentionally not stored in this repository); use `nyxara-nova-emblem-no-nasa-logo.png` (NASA insignia removed for this use).
