# Development process

Status: **approved** (v2, with the owner's decisions of 2026-11-12). Every agent follows this cycle for every new game or feature and for every fix to a game. The spec is the source of truth.

Direction for worlds and architecture stays in `docs/WORLDS.md` and `docs/ARCHITECTURE.md`; tools and how to run the agents are in `docs/TEAM.md`. Precedence between these files, and the merge and force-push rules, are in [`AGENTS.md`](../AGENTS.md#cross-review-and-merge). The game spec template is `docs/specs/TEMPLATE.md`.

## Approval labels

Two labels mark something Maor has not approved; use only these in new and edited text:

- `Status: **draft — pending owner approval**` on a spec (or other document) that is not approved yet.
- `**Open decision for the owner:**` on a single undecided item.

Older direction documents (`docs/ARCHITECTURE.md`, `docs/WORLDS.md`) still say **proposal — pending owner approval**; treat that like an open decision. Do not treat any of these as approved.

One label marks an item Maor has resolved:

- `**Decided by the owner (YYYY-MM-DD):**` on a single resolved item. When Maor decides an open item, change `**Open decision for the owner:**` in place to this label with the decision date, keep the item's text (reworded only to state the decision), and add a line under the spec's `## Changelog`.

## 1. Team, roles, and branches

Approved by Maor on 2026-11-11.

| Who | Role |
|---|---|
| Grok Bot | Team lead: writes specs with Claude or Gemini, derives plans and tasks, opens issues, assigns work, summarizes reviews, updates Maor, and merges per [`AGENTS.md`](../AGENTS.md#cross-review-and-merge). |
| Claude (`claude`) | Logic, wiring, test handles and hooks, and tests-first work (Vitest and Playwright) on a dedicated branch; may launch sub-agents within the task. Cross-reviews the Gemini expert's PRs with Claude Code (full review). |
| Gemini expert (`agy`) | Art, SVG, animation, voice line design, and visual code. Cross-reviews Claude's PRs and the screenshots with `agy` (full review) against the spec and the visual bar in `GEMINI.md`. |
| GitHub Actions | CI on PRs: affected tests only, plus a smoke set (journey+hud) for shared code; full suite via `workflow_dispatch`; docs-only changes skip CI. Unit tests, AC coverage check, build, Playwright journeys, screenshots as an artifact. |
| Maor | Approves specs, decides product questions, new games, force-push, and disagreements, runs the functional tablet check, reports feedback from use at home, and sets the conversion ratio, caps, and world order. |

Branch rules:

- One branch per task (`docs/…`, `feat/…`, `fix/…`, `chore/…`); never work on `main` and never rewrite `main` history.
- Two agents must not write the same files on the same branch without coordination.
- Shared registries are merged **additively**: keep every game's entries, knobs, helpers, and tests. This covers `src/assets/art/manifest.ts`, `src/assets/art/rigs.ts`, `src/anim/profiles.ts`, `src/anim/artRegistry.ts`, `src/anim/registerArt.ts`, `src/anim/index.ts`, `src/anim/worldMotion.ts`, `tests/unit/artAssets.test.ts`, `src/content/schema.ts`, `src/content/loadContent.ts`, `src/content/worlds.json`, and `src/pwa/updatePolicy.ts`.
- The author of a PR is never its sole reviewer.
- Merge and force-push rules: see [`AGENTS.md`](../AGENTS.md#cross-review-and-merge).

## 2. Spec first

Every new game or feature starts with `docs/specs/<game-id>.md` (copied from the template), written by the team lead with Claude or Gemini as needed. Maor approves it **before any code**.

**Existing games** (Animal Restaurant, Kitchen Orchestra, Who's Hiding? from PR #29) get a retroactive spec, approved by Maor, before their next fix or feature PR.

**Spec changes.** Feedback and new requirements update the spec first, then the code in a fix PR. Every edit adds a line under the spec's `## Changelog`.

- A **substantive** change sets `Status` back to **draft — pending owner approval** and needs Maor's re-approval before code: learning goals, world, mechanic, difficulty curve or start levels, leisure rules, acceptance criteria added, removed, or changed in meaning, or scope (including what moves between Pass 1, Pass 2, and out of scope).
- A **minor** change (wording, clarification, a typo, a test name, a new hook listed for an existing criterion) does not need re-approval.

**Frozen at approval** so Claude and Gemini can work in parallel: asset paths and manifest keys, test ids and hooks (including `getBuildingHit(<id>)`), the art contract, and voice line ids. Changing any of these later is a spec change.

## 3. Two passes

Each spec is split into:

- **Pass 1 — working game:** the mechanic, adaptive difficulty, leisure, clean SVGs, **basic** animation (existing motion helpers and simple tweens), and **basic** voice: device TTS, or recorded clips that already exist. No new recordings and no polish.
- **Pass 2 — polish:** polished art and animation, and new recorded Gemini TTS clips (Leda; device TTS stays the fallback). Pass 2 starts only after Maor has approved the finished Pass 1.

**Decided by the owner (2026-11-13):** by default, a new game or a big change is built first with basic animation and basic voice (device TTS or existing recorded clips only). Polished animation and new recorded clips come only after the change is done and Maor approves it. This saves time and tokens. An explicit owner decision in a spec can override the default for a specific item. For example, Maor put the Animal Restaurant `attr.*`/`not.*` clips (#32 AC-41) and the Who's Hiding intro and help clips (#33 AC-34) in Pass 1 on 2026-11-13. Record such an override as a `**Decided by the owner (YYYY-MM-DD):**` item in the spec. In practice:

- **Spec approval (§2):** unless Maor has explicitly decided otherwise for an item, the approved spec lists polished animation and new clips under Pass 2 (or Out of scope), not under Pass 1, and a Pass-1 acceptance criterion does not require polished animation or a new recording.
- **Tests first and `Pass in progress` (§4):** `Pass in progress: 1` gates only the basic Pass-1 criteria. Pass-2 criteria (for example, "recorded clips exist for every line") get tests, and `Pass in progress` moves to `2`, only after Maor approves Pass 1 and the Pass-2 work starts.
- **Asset requests to the art and audio agent (Gemini):** in Pass 1, request new art or audio only when it is strictly needed for the game to function (for example, a prop the child must tap, or a background so the scene reads). Otherwise use placeholders: existing art, simple shapes, procedural fallbacks, or device TTS. Polished art, rig animation, and new Leda clips are requested only for Pass 2.
- **Big changes to an existing game** follow the same two steps: a basic working version first, polish after approval.

Each acceptance criterion names its pass. Each pass is gated only against its own criteria. The spec's `Pass in progress` line (`none`, `1`, or `2`) tells the AC coverage check which criteria must already have tests.

## 4. Plan, tests first, and parallel work

After approval the team lead splits tasks. Then, in parallel:

- **Claude** writes failing tests from the acceptance criteria, then implements logic until they pass, in vertical slices (one or a few ACs per commit).
- **Gemini** starts art, animation, and voice work right away, to the frozen paths, ids, and contract in the spec. Gemini does not wait for Claude's tests.

Prefer an existing game template and JSON content. Keep the leisure engine, storage, and audio in `src/core` without unnecessary Phaser dependence.

### Acceptance criteria and test mapping

- Every criterion has a stable id `AC-01`, `AC-02`, … that is never renumbered or reused. A removed criterion stays in the table, struck through (`~~AC-07~~`).
- The spec's table states for each criterion: Pass, Verified by (`unit`, `e2e`, `e2e+seed`, or `device`), Orientation, and Hooks used.
- Test titles start with the id: `test('[AC-04] level rises after 3 clean answers', …)`. One test may cover several ids.
- Tests for a game live in files named after the game id (`tests/e2e/<game-id>.spec.ts`, `tests/unit/<game-id>.<topic>.test.ts`) or in a `<game-id>/` folder, because AC ids repeat across specs.
- CI runs `npm run check:ac` (`scripts/check-ac-coverage.mjs`). It fails if a criterion of a pass at or below `Pass in progress`, verified by `unit`, `e2e`, or `e2e+seed`, has no non-skipped test titled with its tag in that game's test files. `device` criteria are exempt.

Default split of verification:

| Verified by | Use for |
|---|---|
| `unit` | Adaptive rules, start levels, leisure accrual and no penalty, content and language selection |
| `e2e` | Map entry, correct and wrong feedback, exit, voice (speech spy), a smoke test at both viewports, offline, the parent gate |
| `e2e+seed` | High levels, plus one real-tap level change at a low level |
| `device` | Touch, rotation, audible voice, visuals (Maor's tablet check, §7) |

### UI e2e rules

- **Real tap** means a pointer click on an on-screen element or a canvas hit target. Map buildings are Phaser canvas objects, so tests tap the centre of the rectangle returned by a `getBuildingHit(<id>)` hook under `?e2e=1` (implementers add it); DOM elements use a `data-testid`.
- **Hooks** under `?e2e=1` may only seed persisted state (level, balance) and read state. They never perform a game action or navigate between scenes. Every hook a criterion uses is listed in the spec.
- **One full journey per game** by real taps from the profile screen: profile → world building → game → play → exit to the map. Other criteria may seed state, but still enter the game through the map building.
- `__testHooks__.goToScreen` is not allowed in journey or AC tests. Screenshot and preview scripts may use it. Existing `goToScreen` tests are legacy: a PR that touches a game replaces that game's ones with map-entry journeys.
- **Parent-gate** tests run without `?e2e=1`, because `?e2e=1` bypasses the gate.
- **Voice:** assert through a speech spy that the correct line id and language were requested. Whether it is audible is checked on the device.
- **Orientation:** the game must be playable in both Playwright projects (`landscape-1280x800`, `portrait-800x1280`). Orientation-independent criteria may run in one project only; tag the title `@single-orientation`. Mid-game rotation is a device check.
- Implementers add `data-testid`s and hooks the tests need and never remove ones that tests rely on.

## 5. Ready-for-merge gate

A merge to `main` publishes to GitHub Pages, so this gate comes before merge. For the pass in progress:

- CI is green, including the Playwright journeys named in the spec and the AC coverage check.
- In-game screenshots (not only art-preview boards) at native `1280×800` and `800×1280`, each taken in a fresh page at that size (resizing a Phaser FIT canvas letterboxes): age-2 start, age-5 start if it looks different, one correct-feedback frame, and one hint or retry frame. Playwright writes them to `docs/screenshots/` and CI uploads them as the `screenshots` artifact; preview scripts write to `tools/art-preview/shots/`.
- A named reviewer has actually inspected the screenshots for contrast, Hebrew RTL chrome with LTR learning tokens, clipping and overlap, missing rig layers, and tap-target size. A file existing is not a review.
- The change has been cross-reviewed against the spec (a full review) by the agent who is not its author, and the reviewer posted APPROVE as a PR comment. A copy in `docs/reviews/` is optional.

### CI: affected tests

CI (`.github/workflows/ci.yml`) runs only what the change affects. PRs that touch only `*.md` or `docs/**` do not trigger it.

- **Unit tests:** `vitest run --changed <base>` (Vitest's own import graph). `<base>` is the PR base SHA on `pull_request`, and `github.event.before` on push to `main` (falling back to `HEAD~1` for a new branch). Zero related tests is fine; it never falls back to the full unit suite. `npm run check:ac` and `npm run build` always run in `test-and-build`.
- **E2E:** `scripts/affected-e2e.mjs` maps changed files to Playwright specs with an explicit table (`GAME_RULES`):
  - a game's folder, content JSON, unit tests and e2e helpers select that game's specs;
  - a changed spec selects itself;
  - shared code (`src/core`, `src/ui`, `src/game`, `src/worlds`, `src/anim`, `src/main.ts`, `web/`, `public/`, `package*.json`, configs, shared e2e helpers, the workflow) selects the smoke set only: `journey.spec.ts` and `hud.spec.ts`;
  - docs, markdown, prototype files and unit-only tests select nothing, and then Playwright is not installed or run.
  - A unit test (`tests/unit/affectedE2e.test.ts`) fails if a `tests/e2e/*.spec.ts` is not reachable from the map, so add every new spec to `GAME_RULES` (or the smoke set).
  - Try it locally: `node scripts/affected-e2e.mjs --base origin/main`, or `node scripts/affected-e2e.mjs --files src/games/sorting/sortingLogic.ts`.
- **Push to `main`:** `test-and-build` (related unit tests, check:ac, build) gates `deploy`. The affected-e2e job is separate and does not block deploy.
- **Playwright browsers** are cached (`~/.cache/ms-playwright`, keyed by OS and the installed `@playwright/test` version); on a cache hit only `playwright install-deps chromium` runs.
- **Full suite:** Actions tab → CI → "Run workflow" (`workflow_dispatch`: all unit tests, all e2e, build, check:ac; never deploys), or locally `npm test` and `npm run test:e2e`. Run it before a ready-for-merge gate when a PR touches shared code.

## 6. Merge

See [`AGENTS.md`](../AGENTS.md#cross-review-and-merge).

## 7. Functional tablet check and feedback

After merge, Maor runs a short functional check on the tablet: touch, rotation, audible voice, and visuals. There are no enjoyment metrics and no observational playtests. A failed check or feedback from use at home becomes a spec update first (§2), then a fix PR.
