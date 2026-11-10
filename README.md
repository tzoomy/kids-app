# kids-app — Vite + TypeScript + Phaser 3 skeleton

This is the P0 foundation for the next version of the learning app for Maor's
daughters: a Vite + TypeScript + Phaser 3 PWA, built beside the existing
prototype at the repository root.

**The live site at https://tzoomy.github.io/kids-app/ is still the old root
prototype** (`index.html`, `app.js`, `style.css`, `sw.js`). This new app does
not replace it yet — that requires the owner to merge this work to `main` and
then switch the GitHub Pages source from "deploy from a branch" to "GitHub
Actions" in the repository settings. Until that switch happens, the `deploy`
job in `.github/workflows/ci.yml` is prepared but has no visible effect.

See `docs/ARCHITECTURE.md`, `docs/WORLDS.md`, and `docs/TEAM.md` for the
product and technical direction, and `AGENTS.md` / `CLAUDE.md` for the rules
every agent working in this repository follows.

## Getting started

```bash
npm install
npm run dev       # Vite dev server, http://localhost:5173/kids-app/
npm run build     # type-check + production build to ./dist
npm run preview   # serve the production build locally
npm test          # Vitest unit tests
npm run test:e2e  # Playwright tablet-size journey + screenshots
```

Playwright needs a browser the first time: `npx playwright install chromium`
(add `--with-deps` on a fresh Linux machine/CI runner).

## Layout

```
web/index.html         Vite HTML entry (lang=he, dir=rtl)
src/                    TypeScript application
  core/leisure/         leisure-time engine (no Phaser dependency, unit-tested)
  core/storage/         schema v2 + one-way migration from the prototype's ar_state
  core/audio/           pluggable audio: device TTS now, static files later
  content/              content as data (JSON) + Zod schema validation
  game/, worlds/, games/, ui/   Phaser scenes + the Hebrew RTL DOM shell
public/                PWA manifest, icons, .nojekyll
tests/unit             Vitest
tests/e2e              Playwright (tablet-size journey + screenshots)
docs/screenshots/      Playwright screenshot output
```

The prototype files at the repository root (`index.html`, `app.js`,
`style.css`, `sw.js`, `manifest.json`, icons, `.nojekyll`) are untouched by
this app and keep working as before.

## Leisure policy (placeholders)

The conversion ratio and caps are **temporary defaults**, pending Maor's
decision, adjustable from the parent area:

- 10 minutes of learning → 5 minutes of leisure
- Daily earning cap: 30 leisure minutes
- Idle threshold: 20 seconds without interaction (listening/watching an
  animation does not count as idle)

Mistakes never reduce the leisure balance, and balances never transfer
between profiles.

## Audio

Device Web Speech API (TTS) is the working fallback today. `src/content/audio-manifest.json`
is the manifest format for static audio files to come later — any `lineId`
missing a file falls back to TTS automatically, so dropping in recordings
later needs no code changes.

## Privacy

Everything persists in `localStorage` on the device only — no account, no
cloud sync, no analytics. Clearing the browser's site data wipes all
progress and balances. The repository and its content contain no real names,
secrets, or usage data.
