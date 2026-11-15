from playwright.sync_api import sync_playwright
from render_scenes import render, browser
import time
JOBS = [('problem', 4.7, 'parts/m_problem.mp4', None), ('logo', 5.4, 'parts/m_logo.mp4', None), ('close', 3.8, 'parts/m_close.mp4', None),
        ('e_intro', 11.6, 'parts/m_e_intro.mp4', None), ('e_problem', 13.9, 'parts/m_e_problem.mp4', None), ('e_meet', 11.1, 'parts/m_e_meet.mp4', None),
        ('e_ridge', 6.4, 'parts/m_e_ridge.mp4', None), ('close', 11.1, 'parts/m_e_close.mp4', 'ext')]
with sync_playwright() as p:
    b, pg = browser(p)
    for sc, d, out, arg in JOBS:
        t = time.time(); render(pg, sc, d, out, arg); print(out, d, 's in', round(time.time() - t), 's', flush=True)
    b.close()
