# `mystery-egg` — Mystery Egg (Workshop mission 1.1 prototype)

Status: **approved** (Maor approved this one-mission prototype task on 2026-11-25 20:57 Asia/Jerusalem; the brief is the spec).
Pass in progress: **1** (read by `npm run check:ac`).

Design sources (kept outside the repo): the story bible and the Workshop GDD v0.3 (mission 1.1, "the sleeping baker cat"). The lighthouse ring in the old mockups is replaced by nest, egg, and robot heart.

## Summary

A one-mission, tablet-first prototype of the Machine Workshop. The child sees the Mystery Egg in its nest, opens the Workshop, meets a sleeping baker cat (Monsieur Moustache), and builds a tiny chain-reaction machine: she drags the missing ramp piece into the one glowing slot, presses the big green Play button, and the ball rolls down the ramp and rings the bell that wakes the cat. Success lights exactly one of the robot's five heart slots, puts a feather in the nest, and makes the egg glow brighter. The game needs no reading; the French request and the Hebrew robot help are voice only.

## Learning goals

- **Age 2:** none (the Workshop is Elli's world; Shai's playroom is a separate, later design). The entry is a single prototype button for the age-5 profile's tablet check; both profiles can open it.
- **Age 5:** cause and effect (a rolling ball rings a bell), spatial reasoning (which piece fits the gap), persistence after a failed run, and French listening ("Monsieur Moustache dort ! Il doit faire les croissants !"). The Hebrew robot help explains the request, never the solution.

## World and why

- **World:** none yet. This is a separate prototype entry on the map (a big egg button), not one of the worlds in `src/content/worlds.json`, so no existing world, picker, or station changes. **Open decision for the owner:** where the Workshop world lives on the map once the prototype is accepted (see `docs/PENDING-DECISIONS.md`).
- **Why:** it is the frame story's first playable slice (`docs/WORLDS.md` direction pending).

## Mechanic

One mission (id `1.1`), four views:

1. **Hub** (`MysteryEggScene`): the egg in its nest (art id `egg-nest-N`, `N` = glow level), the bunny (Lumi, placeholder), the robot (Bip, placeholder), the capybara, the 5-slot robot heart panel, and one big Workshop button. A back button returns to the map.
2. **Intro** (first overlay of `MysteryEggBuildScene`): the sleeping cat and the picture-only goal card (ball, dotted arrow, bell, awake cat). The French request line plays. A big go button starts the build.
3. **Build** (Matter.js scene, physics enabled for this scene only): a fixed shelf, a fixed bell, a bed, and ONE glowing empty slot. A tray at the bottom holds three big parts: red ball, ramp piece, bell. The child drags a part with a real pointer drag. **Forgiving snap:** a part dropped within a generous radius (160 game px) of the compatible slot snaps in. A part dropped elsewhere, or a part the slot does not accept, glides back to the tray (harmless, no penalty). Only the ramp piece fits the slot; the ball and the bell in the tray are decoys in mission 1.1 (the ball and bell already sit on the board, as in the GDD). A placed ramp can be dragged out again (it returns to the tray or re-snaps).
4. **Play:** the big green Play button runs the physics at a fixed 60 Hz timestep (deterministic: outcomes depend on step counts, not on frame times). The ball rolls off the shelf; with the ramp placed it rolls down the ramp and rings the bell. Failure (the ball misses, falls out, stops, or times out after 10 s of simulated time) resets the ball to the shelf; placed parts stay where they are. No buzzer, no "wrong" message.

**Help ladder (explicit order):** the robot ear button is always visible (intro and build) and gives **Hebrew help** at any time: it plays the goal hint `vo-he-robot-help-1` (decided 2026-11-25; it is not a ladder step, so it never counts as a failed run and never shows the pointer). The intro's own automatic French story and request lines are unchanged. Failed runs cost nothing. The **2nd failed run** plays the Hebrew *goal hint* `vo-he-robot-help-1` (feminine singular, explains the request, never the solution; no pointer). The **next failed run, and every later one,** plays the *glowing-slot hint* `vo-he-robot-help-2` (the GDD's hint step 3; it stays the last rung) together with a visual pointer pulsing at the empty slot; the pointer stays until the ramp is placed. A failed run that passed close to the bell and has no hint due plays `vo-fr-presque`.

**Success:** the cat wakes (sprite strip `cat-wake` or a tween), croissants and confetti are drawn, a feather flies to the nest, the egg glows brighter, and exactly one robot heart lights up. Progress is saved the moment the bell rings, then a big continue button returns to the hub, which shows the lit heart, the brighter egg, and the feather in the nest. Replaying the mission never lights more than one heart.

**Input mode:** drag (build), tap (everything else). Tap targets are at least 96 px in game coordinates on a 1280x800 canvas.

**Missing media:** all art and voice files belong to the Gemini agent's PR (`feat/mystery-egg-assets`). Until they land, the game draws placeholder shapes, plays short synthesized chimes for sfx, and plays a short chime plus a visual cue (a pulsing speech bubble) for missing voice lines. The loader tolerates missing files without errors, so the real files drop in with no code change. Contract: `docs/specs/mystery-egg-assets.md`.

## Difficulty curve

Not adaptive in this prototype (fixed Tier 1, one mission). No leisure earning, no learning session, no adaptive skill key. The help ladder is a fixed default (see Mechanic).

## Leisure

The prototype neither earns nor spends leisure time (no `LearningSession`, no `LeisureSession`, `earnsLeisure` not applicable).

## Player journey from the map

Profile → tap the big egg button on the map → hub → tap Workshop → intro → tap go → drag the ramp into the glowing slot → tap Play → success → tap continue → hub with 1 lit heart → back to the map.

- Map building hit target: not used (the entry is a DOM button, like the wardrobe; no `getBuildingHit`).
- `data-testid`s (DOM): `mystery-egg-btn` (big egg button on the map HUD).
- Seed and read hooks under `?e2e=1` (seed persisted state or read state only; no game actions, no scene navigation):
  - `getMysteryEggInfo()`: read-only snapshot of the active Mystery Egg scene (view, hearts, egg level, feather, failed runs, hint state, slot state, part positions, and page-CSS-px rectangles of every tappable target: `workshopBtn`, `backBtn`, `goBtn`, `playBtn`, `earBtn`, `continueBtn`, `slot`, and the tray parts `ball`, `ramp`, `bell`); `null` when no Mystery Egg scene is active.
  - `seedMysteryEggProgress(seed)`: writes the active profile's Mystery Egg progress key only (seed only; call on the map).
  - Existing shared hooks used: `getActiveScenes`, `getSpokenLines`, `getGameSize`.
- Scene keys: `MysteryEggScene` (hub), `MysteryEggBuildScene` (intro, build, play, success).

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → egg button on the map → hub → Workshop → intro → go → drag the ramp into the glowing slot → Play → success → continue → hub with 1 lit heart, a brighter egg and a feather; the lit heart is still there after a reload | 1 | e2e | @single-orientation | `getMysteryEggInfo`, `getSpokenLines`, `getActiveScenes` |
| AC-02 | Snap: a part dropped within the generous radius of a compatible slot snaps to the nearest such slot | 1 | unit | @single-orientation | |
| AC-03 | Snap: a part dropped outside the radius, or a part the slot does not accept, is not placed and returns to the tray | 1 | unit | @single-orientation | |
| AC-04 | Persistence: save and load round-trip under a versioned, per-profile key | 1 | unit | @single-orientation | |
| AC-05 | Persistence: corrupt JSON, a wrong version, wrong types, or unknown mission ids fall back to the empty state or are repaired, and never throw | 1 | unit | @single-orientation | |
| AC-06 | Completing mission 1.1 lights exactly 1 heart and one feather; completing it again is idempotent (still 1 heart) | 1 | unit | @single-orientation | |
| AC-07 | Run tracker: each failed run increments the fail counter, the ladder rung is due on the 2nd failed run (help-1, no pointer) and on the 3rd and every later one (help-2, with the pointer), a success never counts as a failure, and the tracker does not touch the parts placement | 1 | unit | @single-orientation | |
| AC-08 | Run outcome: ringing the bell is a success; the ball leaving the board, coming to rest away from the bell, or running out of simulated time is a failed run | 1 | unit | @single-orientation | |
| AC-09 | Headless physics at a fixed 60 Hz step: the ramp in the slot rings the bell in every jittered run (±2 px); the empty slot never does; identical runs give identical results | 1 | unit | @single-orientation | |
| AC-10 | A failed run resets the ball to the shelf and moves no part (a placed ramp stays in the slot: unit; in the e2e every part stays in the tray). The help ladder is explicit: the 2nd failed run requests the Hebrew goal hint `vo-he-robot-help-1` (no pointer); the next failed run (and every later one) requests the glowing-slot hint `vo-he-robot-help-2` together with a pulsing pointer at the empty slot, which goes away once the ramp is placed | 1 | unit, e2e | @single-orientation | `getMysteryEggInfo`, `getSpokenLines` |
| AC-11 | The robot ear button is available in the intro and in the build view and gives Hebrew help: it plays `vo-he-robot-help-1` (speech spy), not the French instruction, and it is not a ladder step (failed-run counter and pointer untouched) | 1 | e2e | @single-orientation | `getMysteryEggInfo`, `getSpokenLines` |
| AC-12 | A part dropped far from the slot, or the ball or bell dropped on the slot, returns to the tray and the board is unchanged | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-13 | Replay: with a seeded completed mission the hub shows 1 lit heart, the brighter egg and the feather, and winning again keeps exactly 1 heart | 1 | e2e+seed | @single-orientation | `seedMysteryEggProgress`, `getMysteryEggInfo` |
| AC-14 | The asset manifest `src/content/mysteryEggAssets.json` parses with zod and contains exactly the agreed ids (41, incl. Gemini's extras from PR #108); every `vo-*` has a transcript and a language; the sprite entries have frames, w and h (fps for `cat-wake` and `robot-blink`); display sizes are half of the 2x file px; the heart-panel socket geometry | 1 | unit | @single-orientation | |
| AC-15 | The asset loader tolerates missing files: a failed key is marked missing, lookups fall back to placeholders without throwing, URLs respect the Vite base, and sprite frame data is read from the manifest, never hardcoded | 1 | unit | @single-orientation | |
| AC-16 | The existing map and games still open (the egg button is additive): the smoke journey passes and the egg button does not cover a world building | 1 | e2e | @single-orientation | `getBuildingHit` |
| AC-17 | Device check: touch drag and tap, 60 fps on the family tablet, audible voice once Gemini's files land, visuals | 1 | device | both | |

## Art, animation, and audio

All media belong to the Gemini agent (`feat/mystery-egg-assets`); this change adds code only. Paths, ids, kinds and sizes are frozen in `docs/specs/mystery-egg-assets.md` and `src/content/mysteryEggAssets.json`. Art: `public/art/mystery-egg/<id>.webp` (static WebP with alpha at 2x). Audio: `public/audio/mystery-egg/<id>.ogg` (Opus mono).

### Pass 1 — working game

- Placeholder behaviour for missing art: Phaser-drawn shapes. Missing sfx: short WebAudio synthesized beeps and chimes. Missing voice: a short chime plus a speech-bubble cue (no device TTS).
- Animation: idle and reaction motion are Phaser tweens on whole images (bob, squash, wiggle). If a manifest entry has `kind: "sprite"` with `frames` and `fps`, it is loaded as a horizontal strip spritesheet (`w`,`h` are the single-frame size) and played.
- **Voice table** (placeholder behaviour: a chime plus a speech-bubble cue until Gemini's file is in place; transcripts from PR #108, Hebrew lines are feminine singular and do not name the child):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `vo-fr-story` | fr | Oh non ! Monsieur Moustache dort, et il n'y a pas de croissants ! | Intro start |
| `vo-fr-instruction` | fr | Réveille Monsieur Moustache ! Fais rouler la balle pour sonner la cloche. | In the intro, after the story line (automatic; no longer on the ear button) |
| `vo-fr-presque` | fr | Presque ! | A failed run that passed close to the bell (no hint due) |
| `vo-fr-cat-croissants` | fr | (Mmm,) Mes croissants ! (Mmm,) Merci beaucoup ! | The cat wakes |
| `vo-fr-success` | fr | Bravo ! Tu as réveillé Monsieur Moustache ! | The feather reaches the nest |
| `vo-he-robot-help-1` | he | חתול המאפייה ישן, ואין קרואסונים. בואי נעיר אותו! הכדור צריך לצלצל בפעמון. | Goal hint: ladder rung 1 (the 2nd failed run) and every robot ear-button tap |
| `vo-he-robot-help-2` | he | שימי את הרמפה במקום שזוהר. | Glowing-slot hint, ladder rung 2 (with the pointer): the 3rd failed run and every later one |
| `vo-he-robot-breathe`, `vo-fr-robot-regarde`, `vo-fr-robot-aide` | he / fr / fr | Listed in the manifest only (fuller hint ladder, Pass 2) | not wired |

- **World and PWA wiring:** new `AppScreen` values `mystery-egg` and `mystery-egg-build` in `src/pwa/updatePolicy.ts` (unsafe for mid-game updates). No `entryGameId`, no `earnsLeisure` (not a world).

### Pass 2 — polish

Only after Maor approves the finished Pass 1: the real art, sprites, voices and sfx from the Gemini PR, polish of the tween motions, more missions, a deeper hint ladder (trajectory preview, ghost part, robot places a part), the naming moment, and the Workshop world on the map.

## Out of scope

Missions 1.2 to 1.7, rotation, the hint ladder beyond the two Hebrew hints (trajectory preview, ghost part, robot places a part, breathing line), the naming flow (Lumi and Bip are placeholders), Shai's playroom, the bonus goal, slow-motion replay, the parts book, generated challenges, sandbox, the hatching finale, recorded voices and art (Gemini's PR), and any change to existing games, worlds, or the picker.

## Open decisions for the owner

- **Decided by the owner (2026-11-25, via the team lead):** placeholder names Lumi (hero) and Bip (robot) are OK, until Elli chooses.
- **Decided by the owner (2026-11-25, via the team lead):** home entry placement: the big egg button on the map HUD stays as built.
- **Decided by the owner (2026-11-25, via the team lead):** the robot ear button gives Hebrew help (`vo-he-robot-help-1`) at any time; the automatic ladder stays: 2nd failed run = goal hint (help-1), 3rd and later = glowing-slot hint (help-2) with the pointer, and help-2 stays the last rung.
- **Decided by the owner (2026-11-25, via the team lead):** heart mapping, one heart per mission: this prototype lights one heart for mission 1.1; the GDD ties heart gears to episodes (one step per episode, the first heart slot after episode 5).
- **Decided by the owner (2026-11-25, via the team lead):** in mission 1.1 the tray's ball and bell stay as tray parts (decoys) (the GDD tray was ramp, domino, spring).

## Changelog

- `2026-11-25` — created from the approved task brief — substantive
- `2026-11-25` — manifest aligned with Gemini's media PR #108: sizes (display = half of the 2x files), `cat-wake` 6 frames at 8 fps, `robot-blink` 280x360 frames, `confetti` as a 6-frame particle strip, verified transcripts, 7 extra ids (`vo-fr-story`, `vo-fr-presque`, `vo-fr-robot-regarde`, `vo-fr-robot-aide`, `vo-he-robot-breathe`, `sfx-success`, `sfx-pop`), heart-panel socket geometry, robot idle = `robot-blink` frame 0 and `robot` for cheers; the voice table follows the new transcripts — minor (frozen ids extended additively, agreed with the Gemini agent)
- `2026-11-25` — Gemini's media PR #108 merged: the real files are wired (1x display, robot-blink frame 0 as the robot's idle still); the help ladder is explicit (2nd failed run: help-1 goal hint; 3rd and later: help-2 slot hint with the pointer; ear button replays the French instruction) — minor (hint timing was already an open decision)
- `2026-11-25` — the robot ear button now gives Hebrew help (`vo-he-robot-help-1`) instead of replaying `vo-fr-instruction` (AC-11 changed in meaning); the automatic ladder and the intro's French lines are unchanged; open decisions on names, entry placement, ladder, heart mapping and tray decoys marked decided — decided by Maor via the team lead, 2026-11-25; recorded without re-approval because the owner made the change
