# `shadow-match` — Shadow Match

Status: **draft — pending owner approval**
Pass in progress: **1**

> Built under the team lead's continuous-development mode (2026-11-13). Maor approved the idea (`docs/WORLDS.md`, Nature Lab §5) but not this spec. Every choice he has not made is marked **Open decision for the owner:** and listed in `docs/PENDING-DECISIONS.md`; all are reversible.

## Summary

Dark silhouettes of the Nature Lab animals stand in the Who's Hiding? meadow. A voice gives a cue (the animal's sound, or its name, in English or French) and the child taps the matching silhouette; it turns back into the coloured animal, which says its name in the learning language and then in Hebrew.

## Fit with Who's Hiding? (the team lead asked to fold it in if it fits)

- **It fits as a variant, not as levels.** Shadow Match uses the same animals, names, sounds, look-alike groups, neighbour picker (`pickBushNeighbours`), trial tracker, hint flow and HUD as Who's Hiding?, and its code lives in `src/games/hiding/` (`ShadowScene.ts`, `shadowRound.ts`, `shadowLayout.ts`). Its content (`shadow-match.json`) has no animals of its own: `animalsFrom: "who-is-hiding"`.
- **Not as extra levels in the Who's Hiding? ladder:** that ladder is in an approved spec (8 levels, age-2 start L2); adding silhouette levels would change its meaning, its start levels and its stored progress (`nature-lab.who-is-hiding.<lang>`), which needs Maor's re-approval.
- **So Shadow Match is its own entry with its own levels and skill (`nature-lab.shadow-match.<lang>`),** opened from a Nature Lab picker card next to Who's Hiding?. **Open decision for the owner:** this split, and the Nature Lab picker (vs. the station trail). Reversible: remove the picker branch in `MapScene` to restore the direct Who's Hiding? entry.

## Learning goals

- **Age 2:** match an animal's sound to its shape: two silhouettes at first, the sound plays, touch to reveal; hear the animal's name.
- **Age 5:** more silhouettes and look-alike shapes (cat/lion, bear/panda, dog/rabbit); the cue is the sound only or the name only, in the learning language.

## World and why

- **World:** Nature Lab (creatures, curiosity). `docs/WORLDS.md` → Nature Lab → §5 Shadow Match.

## Mechanic

- A trial: 2–6 silhouettes pop in; the cue is spoken (and shown as an LTR prompt bubble): sound levels say "Meow, meow! Who is it?" / "Miaou, miaou ! Qui est-ce ?", name levels say "Find the cat!" / "Trouve le chat !". A speaker button replays it (not a hint).
- **Correct tap:** the silhouette regains its colours (reveal), sparkles, a star flies to the HUD (star +1), the animal is happy and says "It's the cat!" / "C'est le chat !" (learning language), then "זה חתול!" (Hebrew). The other silhouettes fade. Every third win plays `he.praise.0`.
- **Wrong tap:** the silhouette wobbles and stays dark; nothing is revealed. Age 2: retry clip (first wrong tap) and a hint (the right silhouette pulses and sparkles, the cue repeats). Age 5: the first wrong tap repeats the cue after the retry clip; later ones show the hint. Age 2 also gets the idle hint after 6 s. A wrong tap cancels a pending idle hint (no double hint). Mistakes never cost leisure.
- **Names:** **Open decision for the owner:** on reveal, the name is spoken in the round's learning language and then in Hebrew (not EN + FR + HE in a row), on both tracks.
- Tap only on both tracks. `hud-back` returns to the map.

## Difficulty curve

| Level | Silhouettes | Distractors | Cue |
|---|---|---|---|
| L1 | 2 | far | sound |
| L2 | 3 | far | sound |
| L3 | 3 | same-category | sound |
| L4 | 4 | same-category | sound |
| L5 | 4 | same-category | name |
| L6 | 5 | same-category | sound |
| L7 | 5 | same-category | name |
| L8 | 6 | same-category | short sound |

- **Age 2:** start L1, min L1, max L4 (sound cue only). **Age 5:** start L5, min L4, max L8. **Open decision for the owner:** these bounds.
- `DEFAULT_RULES`; age 2 changes between rounds, age 5 after a trial. Items are animal ids.

## Leisure

Educational: earns through the shared `LearningSession`; wrong taps never reduce the balance.

## Language

Cue and reveal name follow the parent setting `settings.languages` (one language per round when `both`). The Hebrew name is spoken by device TTS from `namesHe` in the content.

## Player journey from the map

Profile → Nature Lab building → picker card `game-picker-shadow-match` → play → `hud-back` → map. Who's Hiding? is the first card (`game-picker-who-is-hiding`).

- Hooks under `?e2e=1` (seed/read only): `seedShadowLevel(level)`, `getShadowInfo(): ShadowInfo | null` (page CSS px: `shadows[].{animalId,hit,silhouette}`, `targetId`, `speak`, `level`, `language`, `skillKey`, `promptText`, `tries`, `hinted`, `correctCount`, `ready`, `replay`), plus `seedLanguageSetting`, `seedBalanceSec`, `getSpokenLines`.

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Nature Lab → picker (both cards; close stays on the map) → Shadow Match → one 3-trial round → `hud-back` to the map | 1 | e2e | both | `getBuildingHit`, `getShadowInfo` |
| AC-02 | A correct tap reveals only that silhouette, adds one star, and speaks the name in the learning language and then in Hebrew; the next trial starts with every choice a silhouette | 1 | e2e | @single-orientation | `getShadowInfo`, `getSpokenLines` |
| AC-03 | A wrong tap reveals nothing, counts one try, repeats the cue, and never reduces the leisure balance | 1 | e2e | @single-orientation | `getShadowInfo`, `seedBalanceSec`, `getSpokenLines` |
| AC-04 | Difficulty rises after 3 clean answers and drops after 2 misses in 3, within the track bounds | 1 | unit | @single-orientation | |
| AC-05 | One real-tap level change at a low level (age 2: L1 → L2 after a clean round) | 1 | e2e+seed | @single-orientation | `seedShadowLevel`, `seedLanguageSetting`, `getShadowInfo` |
| AC-06 | L8 (six silhouettes, short sound cue) plays correctly | 1 | e2e+seed | @single-orientation | `seedShadowLevel`, `getShadowInfo` |
| AC-07 | A new age-2 profile starts at L1 and a new age-5 profile at L5; age 2 never gets a name-only cue | 1 | unit | @single-orientation | |
| AC-08 | The game earns leisure; wrong taps never reduce the balance; its screen is unsafe for a mid-game PWA update | 1 | unit | @single-orientation | |
| AC-09 | Rounds build from content: the target is among distinct silhouettes, count and look-alikes follow the level, cues and reveal lines read correctly in EN/FR/HE, every animal has a Hebrew name | 1 | unit | @single-orientation | |
| AC-10 | The cue is spoken with line id `shadow.<animal>.<sound or name>[-short].<lang>` in the round language; the reveal with `shadow.<animal>.reveal.<lang>` then `he.shadow.<animal>` | 1 | e2e | @single-orientation | `seedLanguageSetting`, `getSpokenLines` |
| AC-11 | Smoke: playable at `1280x800` and `800x1280`, every silhouette tap target at least 64 CSS px and on screen | 1 | e2e | both | `getShadowInfo` |
| AC-12 | The game works offline | 1 | e2e | @single-orientation | `getShadowInfo` |
| AC-13 | The parent area stays gated (test runs without `?e2e=1`) | 1 | e2e | @single-orientation | |
| AC-14 | Device check: touch, rotation, audible EN/FR/HE voice, silhouettes read as dark shapes | 1 | device | both | |
| AC-15 | Recorded Leda clips for the voice table, with matching text hashes | 2 | unit | @single-orientation | |
| AC-16 | Layout: 2–6 silhouettes in both orientations, inside the screen, under the HUD, no overlap, clear of the speaker | 1 | unit | @single-orientation | |
| AC-17 | Who's Hiding? is unchanged: same content, levels and skill key; Shadow Match has its own skill key and reuses the Who's Hiding? animals | 1 | unit | @single-orientation | |
| AC-18 | Hints and help: an age-2 wrong tap during the intro or help still gets its retry line and hint once they end; the age-2 idle hint repeats while the child stays idle; a correct tap never starts the next trial behind the help card (it starts when the card closes) | 1 | e2e | @single-orientation | `getShadowInfo`, `getSpokenLines` |

## Art, animation, and audio

### Pass 1

- **Art:** no new files. Silhouettes are generated at runtime from the approved animal rig art (`src/anim/silhouette.ts`: each part texture is copied into a canvas and filled `#2e2a3a` with `source-in`, eyes and mouth hidden; works in Canvas and WebGL). Background: the existing hiding meadow. Picker card: placeholder.
- **Animation:** existing helpers only (`popIn`, `wobble`, `hintPulse`, `Juice`, `flyArc`, character `happy`/`talk`).
- **Voice table** (device TTS; no new recordings):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `shadow.<id>.sound[-short].<lang>` | en / fr | `{sound} Who is it?` / `{sound} Qui est-ce ?` | sound cue |
| `shadow.<id>.name.<lang>` | en / fr | `Find {name}!` / `Trouve {name} !` | name cue |
| `shadow.<id>.reveal.<lang>` | en / fr | `It's {name}!` / `C'est {name} !` | reveal |
| `he.shadow.<id>` | he | `זה {nameHe}!` | after the reveal line |
| `he.shadow.intro` / `he.shadow.help` | he | `introHe` / `helpTextHe` | first trial / help |
| `he.retry.0/1`, `he.praise.0` | he | existing clips | wrong tap / every 3rd win |

### Pass 2

Polished silhouette art and a reveal animation, picker card art, Leda clips.

## Out of scope

New animals or characters, animals without existing art, clue-only cues.

## Open decisions for the owner

- **Open decision for the owner:** Shadow Match as a separate picker entry reusing Who's Hiding? code, not levels inside Who's Hiding?.
- **Open decision for the owner:** Nature Lab picker vs. the station trail.
- **Open decision for the owner:** reveal name in the learning language plus Hebrew (not all three).
- **Open decision for the owner:** track bounds (age 2 L1–L4 sound only; age 5 L4–L8).
- **Open decision for the owner:** this spec (code built before approval).

## Changelog

- 2026-11-13 — created (Pass 1 built in the same PR under the continuous-development mode) — substantive
