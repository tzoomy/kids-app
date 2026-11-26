# game-shell — progress

Spec: `docs/specs/game-shell.md` (draft, Pass 1 in progress). Branch `feat/mystery-egg-shell`. Asset contract: `docs/specs/mystery-egg-assets.md` ("Game shell assets"; media are Gemini's, entries are `pending: true`).

## Done

- Spec, progress file, asset contract section, PENDING-DECISIONS rows (slice 1).

## Pending (ACs)

- AC-02, AC-04, AC-06, AC-09, AC-12, AC-13, AC-14, AC-15, AC-17 (unit); AC-01, AC-03, AC-05, AC-07, AC-08, AC-10, AC-11, AC-16 (e2e); AC-18 is a device check.

## Next step

Slices: (2) pure models + manifest + tests, (3) map scene + slide overlay, (4) e2e + mapping.

## How to run

- Unit: `npx vitest run tests/unit/game-shell tests/unit/mystery-egg tests/unit/affectedE2e.test.ts`.
- E2E: temp config outside the repo (`/tmp/pw-game-shell.config.ts`, copy from `/workspace/wt-game-shell-notes/pw-game-shell.config.ts`, port 4397): `npx playwright test -c /tmp/pw-game-shell.config.ts 'e2e/game-shell\.journey' 'e2e/mystery-egg\.journey'`.

## Gotchas

- Old save v1 seeds are written raw by the seed hook, so the migration runs on load; the intro and entry slides then still show (introSeen false): e2e must tap `skipBtn`.
- The map scene is `MysteryEggScene`; the Workshop game is `MysteryEggBuildScene`, unchanged.
