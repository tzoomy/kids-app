# Development process

Status: **approved**. Every agent follows this cycle for a new game or a meaningful feature. The spec is the source of truth.

Direction for worlds, architecture, and roles stays in `docs/WORLDS.md`, `docs/ARCHITECTURE.md`, and `docs/TEAM.md`. The game spec template is `docs/specs/TEMPLATE.md`.

## 1. Spec first

Every new game or feature starts with a spec at `docs/specs/<game-id>.md`, written by the team lead (Grok Bot), with Claude or Gemini as needed. Maor approves the spec **before any code**.

If requirements change — including feedback from tablet use at home — update the spec first, then change the code in a fix PR. Do not patch behaviour that contradicts the written spec.

## 2. Plan and tasks

After the spec is approved, the team lead derives a plan and a task split from it:

- **Claude** owns logic, wiring, tests, and review of the implementation.
- **Gemini** owns art, animation, voice, and visual code, and works to the approved spec.

One branch per task, as in `docs/TEAM.md`. Two agents must not write the same files on the same branch without coordination.

## 3. Tests first (TDD)

Claude writes failing tests from the spec's acceptance criteria, then implementation makes them pass.

- **Unit tests** (Vitest) for pure logic: game rules, adaptive difficulty, leisure, and state.
- **UI e2e tests** (Playwright) that simulate a child playing through the actual screens with real taps. They verify everything the spec requires, not only map routing.

### Journey and UI e2e rules

A journey test must:

1. Pick a profile with a real tap.
2. Tap the actual world building on the map (add a `data-testid` or other stable handle on the building if one is missing).
3. Enter the game from that building.
4. Play and assert the acceptance criteria on the real screens.

Do **not** use `__testHooks__.goToScreen` (or any other shortcut around the map) in a journey test. Seed and inspect hooks under `?e2e=1` are allowed for setup and assertions (for example seeding a level or reading round info).

Implementers must add `data-testid` attributes and other stable test handles where the tests need them, including map buildings, and must not remove handles that existing tests rely on.

Cover at least these cases, each mapped to a named test in the spec:

- The game opens from the correct world.
- A correct answer gives feedback and advances the game.
- A wrong answer gives the hint or retry defined in the spec.
- Difficulty rises after successes and drops after misses, using the adaptive rules in the spec.
- A new age-2 profile starts at the age-2 start level; a new age-5 profile starts at the age-5 start level.
- Leisure time accrues as defined (mistakes never reduce the balance; balances do not mix across profiles).
- Exit back to the map works.
- Voice and on-screen text use the correct language.
- The game works in both landscape and portrait (Playwright projects `landscape-1280x800` and `portrait-800x1280`).
- The game works offline.
- The parent area stays gated.

## 4. Parallel implementation

Claude and Gemini implement in parallel to the approved spec. Prefer an existing game template and JSON content over a new game from scratch. Keep the leisure engine, storage, and audio in `src/core` without unnecessary Phaser dependence.

## 5. Ready-for-tablet gate

No game goes to the tablet until all of the following are true:

- CI is green.
- Every test named in the spec passes.
- The change has been reviewed against the spec.
- Screenshots exist in both landscape and portrait.

## 6. Merge and tablet use

Merge to `main` only with Maor's explicit approval. After merge, the family uses the build on the tablet at home.

## 7. Feedback

There are no enjoyment metrics and no observational playtest steps in this process. Fixes come from real usage feedback, recorded on the go by updating the spec first, then landing the code in a fix PR.

## Fast build, then polish

Keep the existing strategy: ship a playable version with device TTS and basic animation first, then polish art, animation, and recorded voice in a later pass, still against the same spec (or an updated spec Maor has approved).
