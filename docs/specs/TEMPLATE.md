# Spec template

Copy this file to `docs/specs/<game-id>.md` (use the content id, for example `animal-restaurant.md`). Write the spec in English. Fill every section. Mark anything Maor has not decided as **Open decision for the owner**. Do not start implementation until Maor has approved the spec.

---

# `<game-id>` — `<display name>`

Status: **draft — pending owner approval** / **approved** (keep one).

## Summary

One short paragraph: what the child does, what she learns, and which world the game sits in.

## Learning goals

- **Age 2:**
- **Age 5:**

## World and why

- **World** (Language House, Number Garden, Nature Lab, Art Studio, or Leisure Corner):
- **Why this game belongs there:**
- Link to the relevant section of `docs/WORLDS.md` if one exists.

## Mechanic

How a round works: the child's action, feedback on a correct answer, feedback on a wrong answer (hint or retry), how a round ends, and how she leaves the game. Note the input mode (tap, drag) per age track if they differ.

## Difficulty curve

- **Levels:** a table or list of levels and the levers that change (choice count, request type, scaffolding, and so on). Follow the adaptive-engine contract in `docs/adaptive-engine.md` unless this spec documents a justified exception.
- **Age-2 start level:**
- **Age-5 start level:**
- **Min / max** (including whether age 2 has a ceiling):
- **Adaptive rules** (defaults or overrides: `upCleanStreak`, `downMisses`, `downWindow`, `trialsPerRound`, `maxChangesPerRound`, when the level may change):

## Player journey from the map

Step by step, with the real UI the child uses: choose a profile → tap this world building on the map → enter the game → play a round → exit back to the map. Name the test handles (`data-testid` or equivalent) the journey will use, including the map building.

## Acceptance criteria

Numbered, each one testable, each one mapped to a unit or e2e test name that will exist before implementation. Add game-specific criteria as needed. Keep at least:

1. The game opens only from the correct world building on the map. — e2e: `<test-name>`
2. A correct answer gives the specified feedback and advances the game. — e2e: `<test-name>`
3. A wrong answer gives the specified hint or retry, and never reduces the leisure balance. — e2e and/or unit: `<test-name>`
4. Difficulty rises after successes and drops after misses, using the rules in this spec. — unit: `<test-name>` (e2e if a journey can show a level change)
5. A new age-2 profile starts at the age-2 start level; a new age-5 profile starts at the age-5 start level. — unit and e2e: `<test-name>`
6. Leisure time accrues as defined in this spec and in the leisure policy. — unit and/or e2e: `<test-name>`
7. Exit returns the child to the map. — e2e: `<test-name>`
8. Voice and on-screen text use the correct language for the round. — e2e: `<test-name>`
9. The game is playable in landscape (`1280x800`) and portrait (`800x1280`). — e2e: `<test-name>`
10. The game works offline. — e2e: `<test-name>`
11. The parent area stays gated. — e2e: `<test-name>`

## Test plan

List the tests that will be written first (TDD). Journey tests use real taps: profile, the world building on the map, then the game. Do not use `__testHooks__.goToScreen` in a journey test. Seed and inspect hooks under `?e2e=1` are allowed for setup and assertions. Implementers add `data-testid` and other stable handles where needed.

### Unit (Vitest)

- `<file and test name>` — what it asserts

### UI e2e (Playwright)

- `<test name>` — what it asserts, and whether it runs in both orientations

## Art and audio needs

- Art (characters, props, scene layers, FX), and which orientation backgrounds are required.
- Audio: device TTS is enough for the first playable version unless this spec says otherwise; list line ids and any later recorded-voice or animation polish.

## Out of scope

What this change will not include (deferred levels, parent tools, extra languages, polish passes, and so on).

## Open decisions for the owner

List every question that still needs Maor's decision. Mark each item clearly:

- **Open decision for the owner:** …
