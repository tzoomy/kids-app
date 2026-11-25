# mystery-egg — progress

Spec: `docs/specs/mystery-egg.md` (approved, Pass 1 in progress). Branch `feat/mystery-egg-proto`. Asset contract: `docs/specs/mystery-egg-assets.md` (media belong to the Gemini PR `feat/mystery-egg-assets`; this branch adds no media).

## Done (all ACs have tests)

- AC-02, AC-03: `src/games/mysteryEgg/snap.ts` (unit).
- AC-04, AC-05, AC-06: `progress.ts` (unit).
- AC-07, AC-08: `run.ts` (unit).
- AC-09, AC-10 (unit part): `layout.ts` + `machine.ts`, headless Matter (Phaser's bundled build) at a fixed 60 Hz (unit).
- AC-14, AC-15: `assets.ts`, `voiceProvider.ts`, `eggSound.ts`, `eggAssetLoader.ts` (unit).
- AC-16: affected-e2e rule (`scripts/affected-e2e.mjs`, `tests/unit/mystery-egg.affectedE2e.test.ts`) and the map button check.
- AC-01, AC-10, AC-11, AC-12, AC-13, AC-16 (e2e): `tests/e2e/mystery-egg.journey.spec.ts` (landscape only).
- AC-17: device check by Maor (touch, 60 fps, audible voice once Gemini's files land, visuals).

## How to run

- Unit: `npx vitest run tests/unit/mystery-egg` (add `tests/unit/pwaUpdatePolicy.test.ts`).
- E2E: a temporary Playwright config outside the repo (testDir `tests/e2e`, port 4391, landscape 1280x800, webServer `npm run build && npm run preview -- --port 4391 --strictPort` with `cwd` the repo) run with `NODE_PATH=<repo>/node_modules npx playwright test -c /tmp/pw-mystery-egg.config.ts 'e2e/mystery-egg\.journey'`. The plain pattern `mystery-egg` also matches the worktree directory name and selects the whole suite.

## Gotchas

- Matter is enabled for `MysteryEggBuildScene` only (scene config `physics.matter`, `autoUpdate: false`); `update()` steps the engine at a fixed 60 Hz, at most 6 steps per frame. Outcomes depend on step counts, not frame times.
- Do not use Phaser's audio loader for these sfx: a missing file makes `decodeAudioData` reject unhandled. Sfx and voice use audio elements and fall back to synthesized sounds.
- `vite preview` answers a missing file with `index.html` (200), so "missing" shows up as a decode/processing error, not a 404. Both paths are handled.
- Both scenes call `shell.clearChrome()`: the map's DOM chrome (top bar, world labels, egg button) otherwise stays on top of the canvas.
- Sprite frame width comes from the loaded texture width / manifest `frames`, so a 1x or 2x strip both work.

## Open (needs Maor)

See the `2026-11-25` "Mystery Egg" rows in `docs/PENDING-DECISIONS.md` (names, entry placement, hint timing, heart mapping, tray decoys, missing-media behaviour, progress storage, orientation).

## Next step

Merge Gemini's assets PR, then Maor's tablet check (AC-17). Pass 2 only after Maor approves Pass 1.
