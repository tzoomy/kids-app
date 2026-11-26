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
- E2E: a temporary Playwright config outside the repo (testDir `tests/e2e`, port 4391, landscape 1280x800, webServer `npm run build && npm run preview -- --port 4391 --strictPort` with `cwd` the repo); run it with the command under "Follow-up" below. Pass the spec file path: a bare `mystery-egg` pattern also matches the worktree directory name and selects the whole suite.

## Gotchas

- Matter is enabled for `MysteryEggBuildScene` only (scene config `physics.matter`, `autoUpdate: false`); `update()` steps the engine at a fixed 60 Hz, at most 6 steps per frame. Outcomes depend on step counts, not frame times.
- Do not use Phaser's audio loader for these sfx: a missing file makes `decodeAudioData` reject unhandled. Sfx and voice use audio elements and fall back to synthesized sounds.
- `vite preview` answers a missing file with `index.html` (200), so "missing" shows up as a decode/processing error, not a 404. Both paths are handled.
- Both scenes call `shell.clearChrome()`: the map's DOM chrome (top bar, world labels, egg button) otherwise stays on top of the canvas.
- Sprite frame width comes from the loaded texture width / manifest `frames`, so a 1x or 2x strip both work.

## Follow-up (2026-11-25): aligned with Gemini's media PR #108

Manifest now has 41 ids (display w/h = half of the 2x files, hub-bg 1x; `cat-wake` 6 frames at 8 fps, `robot-blink` 4 frames at 10 fps, `confetti` a 6-frame particle strip without fps; verified transcripts; extras `vo-fr-story`, `vo-fr-presque`, `vo-fr-robot-regarde`, `vo-fr-robot-aide`, `vo-he-robot-breathe`, `sfx-success`, `sfx-pop`). Heart-panel sockets from `layout.ts` (`heartSlotCentres`). Robot idle = `robot-blink` frame 0, `robot` only for cheers. The branch has no media files; the fallbacks still apply. The sprite code paths were checked once in a browser with throwaway fake strips copied into the git-ignored `dist/` (nothing committed).

Run only the new e2e spec: `NODE_PATH=<repo>/node_modules npx playwright test -c /tmp/pw-mystery-egg.config.ts tests/e2e/mystery-egg.journey.spec.ts --project=landscape-1280x800`.

## Tablet fixes (branch fix/tablet-feedback, 2026-11-26)

- AC-21 (one voice at a time): `AudioManager.playQueued()` (waits for the current clip to end; an interrupting `play()` or `stopAll()` drops the queue), `speech.ts` (`voicePlayMode`: only `vo-fr-success` queues), unit `mystery-egg.voiceQueue.test.ts`, e2e `[AC-21] [AC-23]` in `mystery-egg.journey.spec.ts` (a passive spy on the real audio elements: the cat clip must end by itself, no two voice clips overlap). What was heard at the cat wake: `vo-fr-success` (feather lands, about 3.3 s after the bell) CUT the 6.0 s `vo-fr-cat-croissants` after about 3.4 s, over the bell, success and pop sfx. Two voice clips never overlapped before (the manager already stopped the previous one); the voice provider now also mutes a cut clip.
- AC-23 (1.2x): `speech.ts` (`GAME_SPEECH_RATE`, `SLIDE_SPEECH_RATE`, `eggSpeechRequest`), `voiceProvider.ts` applies `playbackRate` and `preservesPitch = true`; `getSpokenLines` entries carry `rate`.
- AC-22 (ramp): `RAMP_POLY` (layout.ts) is the measured silhouette of `part-ramp.webp`; the old wedge sat about 34 px (one ball radius) below the painted top surface (the body did line up with the art centre: the centre-of-mass compensation in `Machine.placeRamp` was right and is still pinned). `BALL_ART_SCALE`: the ball art's visible disc is 59 of 64 px, scaled to the physics diameter. `RAMP_ART_TOP` in `mystery-egg.physics.test.ts` holds the measured samples: **re-measure it and `RAMP_POLY` when `part-ramp` or `part-ball` is re-delivered** (alpha >= 128 on the 2x file; display = file / 2, relative to the slot centre).
- Run: `npx vitest run tests/unit/mystery-egg tests/unit/game-shell tests/unit/audio` and the two Playwright specs (see game-shell.progress.md).

## Open (needs Maor)

See the `2026-11-25` "Mystery Egg" rows in `docs/PENDING-DECISIONS.md` (names, entry placement, hint timing, heart mapping, tray decoys, missing-media behaviour, progress storage, orientation).

## Next step

Merge Gemini's assets PR, then Maor's tablet check (AC-17). Pass 2 only after Maor approves Pass 1.

## #117 additions

- AC-24 ramp placeholder (`rampPlaceholderShape` in `layout.ts`), AC-25 truthful speech spy (`AudioProvider.playedSource`, `SpeechObserver.onOutcome`), AC-26 Continue after Bravo (`successTiming.ts`, e2e in `mystery-egg.journey.spec.ts`). The Continue wait is a team-lead default (pending decision row).

## e2e hardening and #117 nits (branch fix/e2e-harden)

- AC-27: `showContinueAfterVoice` returns `cancel`; the losing timer is cleared on either path and the scene cancels both on shutdown and restart (fake-timer unit tests count `vi.getTimerCount()`).
- AC-28 (the lost Continue tap): root cause = Phaser lists a new interactive object for hit tests only at the scene's NEXT pre-update, so a tap in the frame of the button's creation is lost, while the hook reported the rect at once. `EggButton.ready` is set on the scene's next `update`; both scenes' hooks report only ready buttons. The e2e dispatches one mouse event in the same task as the first report (reproduced 7 of 8 before the fix, 0 after); every other tap stays a real click.
- Gotcha: after this, a re-placed button (the map's back button after a resize) is absent from the hook for one frame: waits must treat a missing rect as "not yet", not as a crash.
