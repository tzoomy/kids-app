# Development team and way of working

Status: **approved** (team model approved by Maor on 2026-11-11). The tools (Claude Code and Antigravity/Gemini on the work machine, `gh` connected to the `tzoomy/kids-app` repository) are available. Maor approves direction and specs, decides product questions, new games, force-push, and disagreements, uses the build with the girls at home, does the functional tablet check, and reports feedback.

The development cycle, the roles table, and branch rules are in `docs/PROCESS.md`. Merge, force-push, and precedence rules are in [`AGENTS.md`](../AGENTS.md#cross-review-and-merge). Each game has a spec in `docs/specs/` (template: `docs/specs/TEMPLATE.md`).

The repository is public. Do not upload secrets, keys, the girls' real names, or usage data.

---

## Language

See `AGENTS.md`.

---

## Roles

See the roles table in [`docs/PROCESS.md` §1](PROCESS.md#1-team-roles-and-branches).

---

## GitHub workflow

1. **One issue per task.** In the title and body: the goal, what is in scope and what is not, a completion criterion, and a link to the relevant document. A large task (for example the move to Phaser) is split into several issues.
2. **One branch per task.** Names: `docs/…`, `feat/…`, `fix/…`, `chore/…`. Do not work directly on `main`.
3. **Pull request.** The description is in English. The PR links to the issue, explains how to test, and states whether the change will affect the live site after merge.
4. **Review.** Cross-review per [`AGENTS.md`](../AGENTS.md#cross-review-and-merge): a full review against the spec (the Gemini expert reviews Claude's PRs via `agy -p` with a read-only prompt in English; Claude reviews the Gemini expert's PRs with Claude Code). The verdict, APPROVE or blocking issues, is posted as a PR comment; a copy under `docs/reviews/` is optional. Fix what is convincing; unclear points and disagreements go to Maor via the team lead.
5. **CI.** Must be green. Scope: affected tests only, plus a smoke set (journey+hud) for shared code; full suite via `workflow_dispatch`. Docs-only changes skip CI. The full ready-for-merge gate is in `docs/PROCESS.md` §5.
6. **Merge.** See [`AGENTS.md`](../AGENTS.md#cross-review-and-merge).
7. **Publish.** A merge to `main` triggers a build and publish to GitHub Pages.

Do not rewrite `main`. Force-push rules: see [`AGENTS.md`](../AGENTS.md#cross-review-and-merge).

---

## How to run the agents

From the machine where the tools are installed, inside the repository. The Claude CLI is `/home/box/.local/bin/claude` (`PATH` may also include `~/.npm-global/bin` and `~/.local/bin`). The launching bot sets `--model`/`--effort` from its own memory.

- Claude, an implementation or review task:
  `claude -p "…"`
  Prompts must be in English. For a review only, state explicitly: read, do not change files, and print the review.
- Gemini, implementation, review, or planning:
  `agy -p "…" --add-dir <worktree>`, started from the task worktree (not `/tmp`).
  Prompts must be in English and name the exact files to read. Never pass `--dangerously-skip-permissions`. You can use `--mode plan` for planning, and `--output-format text` (or `json`) for stable output. Quota errors: see [`GEMINI.md`](../GEMINI.md#running-agy).

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
- New or updated tests when there is logic (especially the leisure engine), and a regression test for every fixed bug.
- Inspected in-game screenshots in both orientations when there is a visual change (ready-for-merge gate).
- A cross-review verdict (APPROVE or blocking issues) posted as a PR comment by the agent who is not the author; a copy in `docs/reviews/` is optional.
- A short English description for Maor: what changed, how to test on the tablet, and what remains open.
