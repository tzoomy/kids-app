# Progress: adaptive-difficulty engine (issue #16)

Branch: `feat/difficulty-engine` (from `main` at 7284b0e). Issue: https://github.com/tzoomy/kids-app/issues/16

## Done
- Issue #16 opened.
- Baseline on `main` verified green: `npm test` 143/143 unit tests (18 files), `npm run build` OK, `npm run test:e2e` 14/14 passed.
- Session A (`claude-opus-5-5`): design doc written and committed as `docs/adaptive-engine.md` (types, engine API, level descriptor for all 8 games, per-profile persistence, age-track policy, leisure isolation proof, restaurant integration plan, unit test plan, file list, owner decisions).

## Not done (blocked)
- Session B (`claude-sonnet-5-5`) stopped on its first turn with "You've hit your 5-hour limit · resets 12:10am (Asia/Jerusalem)". It had only read files; no source code was written.
- Engine implementation, unit tests, restaurant migration, e2e verification, review pass, and the PR are still open.

## Claude sessions
| Session | Model | Session id | Peak context (last turn) | Status |
|---|---|---|---|---|
| A (design) | claude-opus-5-5 | 5847834f-cbec-4eb2-ae6c-a2ac3ba16090 | ~105k tokens | complete |
| B1 (implement, phase 1) | claude-sonnet-5-5 | 2b1cc766-5cd3-4eaa-9104-7f8595c3dcbe | ~61k tokens | stopped by the usage limit; no edits |

Both model names were accepted by the CLI (v2.1.322).

## Next steps to resume
1. After the limit resets, resume session B1 (`claude -p "<continue prompt>" --resume 2b1cc766-5cd3-4eaa-9104-7f8595c3dcbe --model claude-sonnet-5-5 --output-format json --permission-mode acceptEdits` with Read/Glob/Grep/Write/Edit and `npm test` / `npx tsc` / `npx vitest` allowed). Phase 1: `src/core/adaptive/*`, `src/core/storage/adaptiveSchema.ts` + `adaptiveStore.ts`, content schema changes, the engine unit tests from design section 8, and `npm test` green.
2. Phase 2, same session: migrate the restaurant (`choiceServe.ts`, `RestaurantScene.ts`, `animal-restaurant.json`, `appContext.ts`) and update the existing unit tests. Run `npm test`, `npm run build`, and `npm run test:e2e`, all green.
3. Optional: a short `claude-opus-5-5` review of the diff, with fixes made in sonnet.
4. Check context after each turn and keep every session under 300k tokens. Compact or start a fresh session from the notes at about 250k.
5. Push and open a PR to `main` that links #16. Do not merge it.
