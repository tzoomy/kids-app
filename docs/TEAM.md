# Development team and way of working

Status: most of the workflow below is a **proposal — pending owner approval**. The tools themselves (Claude Code and Antigravity/Gemini on the work machine, `gh` connected to the `tzoomy/kids-app` repository) are already available. Maor approves direction, tests with the girls, and merges meaningful changes.

The spec-driven and test-driven cycle for new games and features is **approved**. Follow `docs/PROCESS.md`. Each game has a spec in `docs/specs/` (template: `docs/specs/TEMPLATE.md`). Maor approves the spec before any code, and approves the merge to `main`.

The repository is public. Do not upload secrets, keys, the girls' real names, or usage data.

---

## Language

All code, comments, documentation, commit messages, issue and pull request titles and descriptions, and all prompts to Claude, Gemini, or any other agent must be in English only. Kid-facing app UI strings stay in Hebrew (learning content may also include English and French). Hebrew is used only in conversation between Maor and Grok Bot, not in the repository and not in work among agents.

---

## Roles

| Role | Who | What they do |
|---|---|---|
| Product manager and team lead | Grok Bot (the conversation with Maor) | Writes tasks, opens issues, assigns work, summarizes reviews, updates Maor, and does not merge a meaningful change without his approval |
| Lead developer | Claude Code (`claude`) | Implements tasks on a dedicated branch, may launch sub-agents within the task, opens or updates a PR, does not merge to `main` alone |
| Architecture, code, and design reviewer | Gemini via Antigravity CLI (`agy`) | Independent review of every PR and of foundation documents, including reading screenshots and graphics; does not implement the same PR it is reviewing, unless asked for a pointed fix after the review |
| Automated tests | GitHub Actions | Unit tests, build, and tablet-sized screenshots on every PR |
| Approver and home tester | Maor | Approves the plan, merges important changes, tests on the tablet with the girls, and sets the conversion ratio, caps, and world order |

The role split is a **proposal — pending owner approval**. It can be swapped: Claude reviews and Gemini implements, or both implement different tasks in parallel, as long as two agents are not writing the same files on the same branch without coordination.

---

## GitHub workflow

**proposal — pending owner approval.**

1. **One issue per task.** In the title and body: the goal, what is in scope and what is not, a completion criterion, and a link to the relevant document. A large task (for example the move to Phaser) is split into several issues.
2. **One branch per task.** Proposed names: `docs/…`, `feat/…`, `fix/…`, `chore/…`. Do not work directly on `main`.
3. **Pull request.** The description is in English. The PR links to the issue, explains how to test, and states whether the change will affect the live site after merge.
4. **Gemini review.** After there is a stable diff (or already on a document, as now), run `agy -p` with a read-only review prompt in English. Save the raw review under `docs/reviews/`. Fix what is convincing, and document disagreements in the PR body or in an updated review.
5. **CI.** Tests and screenshots must pass, or be marked explicitly as not relevant to a documentation task.
6. **Merge.** A meaningful change (engine, game, graphics, leisure behavior, parent area, or replacing the live site) waits for Maor's approval. Small documentation fixes or CI fixes can be merged after review, unless Maor asks to approve those as well. **Do not merge this PR** — it is submitted for approval only.
7. **Publish.** After the move to Vite, a merge to `main` triggers a build and publish to GitHub Pages. Until then the live site is the prototype files at the root of `main`. Do not change them in a documentation task.

Do not force-push a shared branch, and do not rewrite `main`.

---

## How to run the agents

From the machine where the tools are installed, inside the repository, with `PATH` including `~/.npm-global/bin` and `~/.local/bin` as needed.

- Claude, an implementation or review task:
  `claude -p "…"`
  Prompts must be in English. For a review only, state explicitly: read, do not change files, and print the review.
- Gemini, review or planning:
  `agy -p "…" --dangerously-skip-permissions`
  Prompts must be in English. You can use `--mode plan` for planning, and `--output-format text` (or `json`) for stable output.

Both tools work without a UI, and GitHub authentication is the same `gh` login. Do not paste keys into chat or into an issue.

---

## Convention files at the repository root

- `AGENTS.md` — working rules for every agent: live site, privacy, branches, language, and the approved development process.
- `CLAUDE.md` — notes for Claude as lead developer (tests-first work and UI e2e).
- `GEMINI.md` — notes for Gemini as reviewer and as owner of art, animation, voice, and visual code.
- `docs/PROCESS.md` — the approved spec-driven and test-driven cycle.
- `docs/specs/TEMPLATE.md` — template for each game spec; filled specs live in `docs/specs/<game-id>.md`.

If a rule appears in `AGENTS.md`, there is no need to repeat it at length; the dedicated files only add the role.

---

## What is expected in every meaningful PR

- A change in one clear place, with no free-ranging refactor outside the scope.
- For a new game or feature: an approved spec in `docs/specs/`, tests written first from its acceptance criteria, and a review against that spec (see `docs/PROCESS.md`).
- New or updated tests when there is logic (especially the leisure engine).
- CI screenshots when there is a visual change (both orientations for a game that must pass the ready-for-tablet gate).
- A Gemini review stored in `docs/reviews/` or linked from the PR.
- A short English description for Maor: what changed, how to test on the tablet, and what remains open.
