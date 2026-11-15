# Publication Report — ASTRA VITAL (NYXARA NOVA)

Date: 2026-11-15 (America/Lima). The official NASA Space Apps form was **not** submitted (requires the owner's explicit action).

| # | Task | Status | URL / location | Evidence |
|---|---|---|---|---|
| 1 | Project audit | ✅ Done | — | Entry point index.html (= dist/index.html, built by build.py). Unit tests 10/10, end-to-end 27/27, 0 console errors. No external resource loads, no fetch/XHR calls, no secrets or personal e-mails in tracked files. Synthetic vitals labeled in UI; OSDR datasets labeled as pre/post-flight lab data. |
| 2 | Production prep | ✅ Done | repo root | .gitignore excludes intermediates (video/parts, mixes, WAV music); original emblem with NASA insignia excluded; README in English with features, architecture, run steps, data sources, limitations, AI disclosure, screenshots (media/screens). License: MIT for the team's own code (team-authored); NASA data credited, not relicensed. |
| 3 | GitHub repository | ✅ Public | https://github.com/Etner249/astra-vital | GitHub API (anonymous): visibility "public", default branch main, README endpoint 200. Single non-forced push. |
| 4 | Web app (GitHub Pages) | ✅ Live | https://etner249.github.io/astra-vital/ | Opened in browser over HTTPS: title correct, dashboard renders (9 alerts, status priority — the synthetic scenario), deep link #nasa opens NASA Data, 28 OSDR rows loaded, favicon present, localStorage persistence works, 0 console errors, 0 external requests. Deployed file SHA-256 2f0c62f7…4019713 identical to repo index.html (108,732 bytes). |
| 5 | 30 s demo video | ✅ Public | https://youtu.be/lxITVao2RmQ | See YOUTUBE_PUBLICATION_REPORT.md (anonymous playability OK, not private/unlisted, captions present, 30 s). |
| 6 | Extended presentation | ✅ Public | https://youtu.be/sz9qzXasEKc | Same checks, 107 s. |
| 7 | Cross-links | ✅ | README, SUBMISSION_LINKS.md, docs/SUBMISSION.md, YouTube descriptions | YouTube descriptions link to the app and repo; README links to app and both videos. |
| 8 | Documentation | ✅ | SUBMISSION_LINKS.md, docs/ | Submission texts, AI disclosure, brand guidelines, video production report, credits. |
| 9 | App ↔ source coherence | ✅ | — | Byte-identical deployed file (task 4). |

## Requires the owner
1. Paste docs/SUBMISSION.md fields + links into the Space Apps project page and click **Submit for Judging** before 23:59 (Trujillo time).
2. Decide whether to delete the private duplicate draft of the 30 s video in YouTube Studio.
3. Optional: FortiGuard web-filter classification for the GitHub Pages URL (recommended by Space Apps).
