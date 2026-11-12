# Progress: adaptive-difficulty engine (issue #16)

Status: **implementation complete, PR open for review** (not merged).

## Done
- Design (`docs/adaptive-engine.md`), with the owner decisions of 2026-11-11 applied.
- Engine in `src/core/adaptive/`, on-device store in `src/core/storage/adaptive*.ts`, and the generic `adaptive` content block with `LevelDescriptor` in `src/content/schema.ts`.
- Animal Restaurant migrated to the engine: `choiceServe.ts`, `RestaurantScene.ts`, the new `trialTracker.ts`, `appContext.ts` and `animal-restaurant.json`.
- An opus review, with its fixes applied by sonnet.
- Verified: `npm test` passes all 241 unit tests in 25 files. `tsc` is clean, `npm run build` succeeds, and `npm run test:e2e` passes 14/14. No e2e or config files were changed.

## Claude sessions (peak context = max input + cache tokens of any turn)
| Session | Model | Session id | Peak context |
|---|---|---|---|
| A design | claude-opus-5-5 | 5847834f-cbec-4eb2-ae6c-a2ac3ba16090 | ~105k |
| B implement (phases 1-2, resumed after a usage-limit stop) | claude-sonnet-5-5 | 2b1cc766-5cd3-4eaa-9104-7f8595c3dcbe | ~161k |
| R review (read-only) | claude-opus-5-5 | 00fba285-2373-4a5d-a6d4-688bd4e8de3a | ~80k |
| C review fixes | claude-sonnet-5-5 | 5a4f04c0-d3be-4e6e-bb5a-4a4b5d7f9a73 | ~106k |

No session needed `/compact`.

## Curve shift (2026-11-12, owner-approved playtesting follow-up)
- The restaurant now has 9 levels: age 2 starts at L4 (today's game), age 5 starts at L5, both tracks have min 1 and max 9. L6 adds a colour word, L7 asks for two foods, L8 uses negation, and L9 is voice-only.
- Levels 6–9 are fully playable. New EN/FR lines use the device TTS.
- The e2e tests were updated for the L4 start, with new L7 and L9 cases.
- The other 7 games' level lists in the design doc were raised.
- Verified: 272 unit tests pass (26 files), tsc is clean, the build succeeds, and e2e passes 18/18 (run twice).

| Session | Model | Session id | Peak context |
|---|---|---|---|
| D curve shift | claude-sonnet-5-5 | ff0c6012-e1ee-4617-bc39-876fc87d3503 | ~173k |
| R2 review (read-only) | claude-opus-5-5 | 16592357-d9f3-4318-b095-bccb01ea70f4 | ~115k |
| E review fixes | claude-sonnet-5-5 | bdfc30a8-cca1-4c46-8a3a-bf9b12e9f5db | ~132k |

## L9 negation (2026-11-12, owner-approved)
- L9 is now the L8 negation request (one correct plate: the other colour) with every visual cue hidden: no bubble, 🔊 button, pointing, pulse or sparkle. Tapping the animal still replays the request and is not a hint.
- L9 is now strictly harder than L8, so a drop from 9 to 8 is a real easement. This resolves the earlier open question about L9.
- Verified: 276 unit tests pass (26 files), tsc is clean, the build succeeds, and e2e passes 18/18.
- Session: F (resumed E), claude-sonnet-5-5, bdfc30a8-cca1-4c46-8a3a-bf9b12e9f5db, peak ~156k.

## Open (needs owner input)
- L6–L8 lines play in the device TTS voice, which differs from the recorded clips.
- Start the idle auto-hint on the age-5 track. Today age 5 has no idle hint, so it never records an "assisted" outcome.
- Decide how strict to be with an unknown `targetId`, and whether to make storage read-only when a migration is missing.
- Visual QA of the 4-plate level (L5) in both orientations on the tablet.
- An e2e test that covers a level change.
- Deferred features from design section 1: parent view and override, 14-day decay, frustration guard, and response-time skip-ahead.
