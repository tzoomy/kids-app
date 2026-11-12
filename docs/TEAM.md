# Development team and way of working

Status: **approved** (team model approved by Maor on 2026-11-11). The tools (Claude Code and Antigravity/Gemini on the work machine, `gh` connected to the `tzoomy/kids-app` repository) are available. Maor approves direction, specs, and every merge, uses the build with the girls at home, does the functional tablet check, and reports feedback.

The development cycle, role split, and branch rules are in `docs/PROCESS.md`, which wins if this file disagrees. Each game has a spec in `docs/specs/` (template: `docs/specs/TEMPLATE.md`).

The repository is public. Do not upload secrets, keys, the girls' real names, or usage data.

---

## Language

All code, comments, documentation, commit messages, issue and pull request titles and descriptions, and all prompts to Claude, Gemini, or any other agent must be in English only. Kid-facing app UI strings stay in Hebrew (learning content may also include English and French). Hebrew is used only in conversation between Maor and Grok Bot, not in the repository and not in work among agents.

---

## Roles

| Role | Who | What they do |
|---|---|---|
| Product manager and team lead | Grok Bot (the conversation with Maor) | Writes tasks, opens issues, assigns work, summarizes reviews, updates Maor, and does not merge a meaningful change without his approval |
| Lead developer | Claude Code (`claude`) | Logic, wiring, test handles, and tests-first work on a dedicated branch; may launch sub-agents within the task; reviews Gemini's PRs for handles and registries; does not merge |
| Art, animation, and design | Gemini via Antigravity CLI (`agy`) | Implements art, animation, voice line design, and visual code to the approved spec; reviews Claude's PRs, documents, and screenshots; never the sole reviewer of its own PR |
| Automated tests | GitHub Actions | Unit tests, AC coverage check, build, Playwright journeys, and tablet-sized screenshots on every PR |
| Approver and home user | Maor | Approves specs and every merge, uses the build with the girls at home, does the functional tablet check, reports feedback, and sets the conversion ratio, caps, and world order |

The author of a PR is never its sole reviewer. Two agents must not write the same files on the same branch without coordination.

---

## GitHub workflow

1. **One issue per task.** In the title and body: the goal, what is in scope and what is not, a completion criterion, and a link to the relevant document. A large task (for example the move to Phaser) is split into several issues.
2. **One branch per task.** Names: `docs/…`, `feat/…`, `fix/…`, `chore/…`. Do not work directly on `main`.
3. **Pull request.** The description is in English. The PR links to the issue, explains how to test, and states whether the change will affect the live site after merge.
4. **Review.** A reviewer who is not the sole author reviews against the spec (Gemini via `agy -p` with a read-only prompt in English, or Claude for Gemini's PRs). Save the raw review under `docs/reviews/`. Fix what is convincing, and document disagreements in the PR body or in an updated review.
5. **CI.** Must be green: unit tests, the AC coverage check, build, and Playwright journeys. The full ready-for-merge gate is in `docs/PROCESS.md` §5.
6. **Merge.** No change of any size is merged without Maor's explicit approval.
7. **Publish.** A merge to `main` triggers a build and publish to GitHub Pages.

Do not rewrite `main`. Force-push only with `--force-with-lease` on your own task branch when rebasing; never on `main` or on a branch another agent uses.

---

## How to run the agents

From the machine where the tools are installed, inside the repository, with `PATH` including `~/.npm-global/bin` and `~/.local/bin` as needed.

- Claude, an implementation or review task:
  `claude -p "…"`
  Prompts must be in English. For a review only, state explicitly: read, do not change files, and print the review.
- Gemini, implementation, review, or planning:
  `agy -p "…" --add-dir <worktree>`, started from the task worktree (not `/tmp`).
  Prompts must be in English and name the exact files to read. Never pass `--dangerously-skip-permissions`. You can use `--mode plan` for planning, and `--output-format text` (or `json`) for stable output. On a quota error, stop and report.

Both tools work without a UI, and GitHub authentication is the same `gh` login. Do not paste keys into chat or into an issue.

---

## Convention files at the repository root

- `AGENTS.md` — working rules for every agent: live site, privacy, branches, language, and the approved development process.
- `CLAUDE.md` — notes for Claude as lead developer (tests-first work and UI e2e).
- `GEMINI.md` — notes for Gemini as implementer of art, animation, voice, and visual code, and as reviewer.
- `docs/PROCESS.md` — the approved spec-driven and test-driven cycle.
- `docs/specs/TEMPLATE.md` — template for each game spec; filled specs live in `docs/specs/<game-id>.md`.

If a rule appears in `AGENTS.md`, there is no need to repeat it at length; the dedicated files only add the role.

---

## What is expected in every PR

- A change in one clear place, with no free-ranging refactor outside the scope.
- For a game or feature: an approved spec in `docs/specs/`, tests titled `[AC-xx] …` written first from its acceptance criteria, and a review against that spec (see `docs/PROCESS.md`).
- New or updated tests when there is logic (especially the leisure engine).
- Inspected in-game screenshots in both orientations when there is a visual change (ready-for-merge gate).
- A review by someone other than the sole author, stored in `docs/reviews/` or linked from the PR.
- A short English description for Maor: what changed, how to test on the tablet, and what remains open.
