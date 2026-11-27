# workshop-l20 — progress

Spec: `docs/specs/workshop-l20.md` (draft, Pass 1). Branch `feat/workshop-l20-final`.

## Log

- 2026-11-27: AC-01 to AC-16 done earlier (physics, sockets, finale, failure feedback, hint steps, break-point marker; AC-16 is the device check).
- 2026-11-27: AC-17 done: rung-2 trajectory (`workshop/l20Trajectory.ts`, scene dots, hook `trajectory`); ladder reordered to 3 glow / 4 trajectory / 5 ghost / 6 Bip (`RUNG_*` in `l20Hints.ts`; AC-13/AC-14 now at 5 and 6 failed runs).

## Pending

- Maor's tablet check (AC-16); the media from Gemini's `media/workshop-l20`; the map entry for L20 (`docs/PENDING-DECISIONS.md`).

## Gotchas

- E2E: use an external Playwright config (own port), never the full suite; one spec walks fails 1-6 on an empty board (about 45 s).
- `hintRung` is the ladder step (failed runs up to 6), not v4's rung number.
