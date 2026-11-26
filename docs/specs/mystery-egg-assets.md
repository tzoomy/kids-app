# `mystery-egg` — asset contract (code agent ↔ Gemini agent)

Status: **approved** (agreed between the code agent and the Gemini agent as part of Maor's approved task of 2026-11-25; the "Game shell assets" section at the end was added 2026-11-26 for `docs/specs/game-shell.md`, which is still a draft).
Pass in progress: **1** (same pass as the main spec; this file has no acceptance criteria of its own, its checks are AC-14 and AC-15 in `docs/specs/mystery-egg.md`).
Companion of `docs/specs/mystery-egg.md`. Ids, paths, and kinds below are **frozen**: changing one is a spec change.

## Who owns what

- **Code (this PR, `feat/mystery-egg-proto`):** the manifest `src/content/mysteryEggAssets.json`, its zod validation and typed lookups (`src/games/mysteryEgg/assets.ts`), the loader, the placeholders, and the tween motions. **No media files are in this PR.**
- **Gemini agent (PR `feat/mystery-egg-assets`):** every media file: art, sprites, voices, sfx. Drop the files at the manifest paths. **No code change is needed** when they land.

## Paths, formats, sizes

| What | Location on disk | Format |
|---|---|---|
| Static art and sprite strips | `public/art/mystery-egg/<id>.webp` | WebP with alpha, **2x** |
| Voice lines and sfx | `public/audio/mystery-egg/<id>.ogg` | Ogg Opus, mono |

- **Manifest** `src/content/mysteryEggAssets.json`: `{ "<id>": { "path": string, "kind": "svg"|"webp"|"sprite"|"vo"|"sfx", "w"?: number, "h"?: number, "frames"?: number, "fps"?: number, "transcript"?: string, "lang"?: "fr"|"he" } }`.
- **Paths** in the manifest are relative to the app base (Vite `import.meta.env.BASE_URL`, `/kids-app/` on the live site), never absolute and never starting with `public/`. A file on disk at `public/art/mystery-egg/hub-bg.webp` is `art/mystery-egg/hub-bg.webp` in the manifest.
- **`w` and `h` are the DISPLAY size in game px** (the game board is 1280×800) and equal **half of the file pixels** Gemini delivers in PR #108: files are 2x, so a 360×300 entry is a 720×600 file. The one exception is `hub-bg`, a 1x file (1280×800 file, 1280×800 display). The code draws each image at `w`×`h` with `setDisplaySize` (scenes then apply their own layout scale on top), so a 1x or 3x file also works, only sharper or softer.
- **All non-sprite art uses `kind: "webp"`** (static, alpha). There are no `.svg` paths.
- **Sprites** (`kind: "sprite"`) are **horizontal strips**: `frames` equal-width frames side by side. `w`,`h` are the **single-frame** display size (half of the 2x frame px). The code reads `frames`, `fps`, `w` and `h` from the manifest (never hardcoded) and takes the real frame width from the loaded texture width ÷ `frames`, so a strip works at any file scale. There are three strips (final values from PR #108):
  - `cat-wake`: 6 frames of 640×640 (2x) → 320×320 display, 8 fps. Plays once when the cat wakes, holds the last frame about 0.5 s, then the code swaps to `cat-awake`.
  - `robot-blink`: 4 frames of 280×360 (2x) → 140×180 display, 10 fps. Frame 0 (open eyes) is the robot's idle still; the blink plays every 3-5 s, then holds frame 0.
  - `confetti`: 6 frames of 64×64 (2x) → 32×32 display, **no fps** (the strip is a set of particle pieces, not an animation). The 6 frames are used as particle emitter frames 0-5.
- **`robot` vs `robot-blink`:** `robot.webp` has closed, cheering eyes, so it is used only for cheer moments (success). The idle robot is `robot-blink` frame 0. If `robot-blink` is missing, `robot` (or its drawn placeholder) is the idle still.
- **Heart panel geometry** (PR #108): `heart-panel` is 320×80 display (1x). Socket centres are at x = 40/100/160/220/280, y = 40 on the 1x panel; `slot-empty`/`slot-filled` are 48×48 at 1x, centred on the sockets. The app draws the panel and slots at 1.5x (`layout.ts`, `heartSlotCentres`).
- **Voice lines** (`kind: "vo"`) must have `transcript` and `lang`. Hebrew lines are **feminine singular** and do not name the child. `vo-he-robot-help-1` is the goal hint (explains the request, never the solution); `vo-he-robot-help-2` is the glowing-slot hint (GDD hint step 3; it says where the ramp goes and is played together with the pulsing slot pointer: pending Maor decision). The transcripts below are the ones Gemini verified in PR #108 (the Hebrew lines do not name the child, because names are chosen at first launch).
- **Sfx** (`kind: "sfx"`) have no size fields.

## Placeholder behaviour (a file is missing)

- **Art:** the loader (`eggAssetLoader.ts`) queues every art file; a Phaser `loaderror` marks the key missing, and that image is drawn as a simple Phaser shape instead (`art.ts`, `drawPlaceholder`). Nothing throws, offline works, and a file that arrives later is used the next time the scene opens.
- **Sprites:** with no strip the code uses a tween on the static image (the cat stretches, the robot squashes).
- **Sfx:** a short synthesized WebAudio beep, chime, or ring (`placeholderSfx.ts`).
- **Voice:** a short chime plus a speech-bubble cue next to the speaker. There is no device-TTS fallback for these ids. The speech spy still records every requested line id and language.
- A missing file is requested once per page session, then skipped.

## Manifest ids

All 41 ids, exactly (a unit test pins this list: `tests/unit/mystery-egg.assets.test.ts`). The *Motion* column lists the Phaser tweens used on the whole image; the *Placeholder* column says what is drawn until the file exists.

| id | path | kind | size / frame spec | depicts | transcript + lang (`vo-*`) | motion (tweens) | placeholder |
|---|---|---|---|---|---|---|---|
| `hub-bg` | `art/mystery-egg/hub-bg.webp` | webp | 1280×800 display px (file 1280×800, 1x) | Soft meadow behind the nest, bright and calm (no characters). The only 1x image. | — | none (static) | Full-screen drawn sky and two green hills. |
| `egg-nest-0` | `art/mystery-egg/egg-nest-0.webp` | webp | 360×300 display px (file 720×600, 2x) | Speckled egg in a twig nest, no glow (start). | — | tiny idle wiggle (angle ±1.5°), pop-in on entry; tap: wiggle | Drawn nest + egg, no halo. |
| `egg-nest-1` | `art/mystery-egg/egg-nest-1.webp` | webp | 360×300 display px (file 720×600, 2x) | Same egg and nest, first soft glow (after mission 1.1). | — | idle wiggle (angle ±2.3°); success view: pop (scale 1.18 → 1) | Drawn nest + egg with a warm halo and one spark. |
| `egg-nest-2` | `art/mystery-egg/egg-nest-2.webp` | webp | 360×300 display px (file 720×600, 2x) | Brighter glow (two nest treasures). | — | idle wiggle (±3.1°) | Drawn, bigger halo, two sparks. |
| `egg-nest-3` | `art/mystery-egg/egg-nest-3.webp` | webp | 360×300 display px (file 720×600, 2x) | Brighter glow (three treasures). | — | idle wiggle (±3.9°) | Drawn, bigger halo, three sparks. |
| `egg-nest-4` | `art/mystery-egg/egg-nest-4.webp` | webp | 360×300 display px (file 720×600, 2x) | Very bright glow (four treasures). | — | idle wiggle (±4.7°) | Drawn, bigger halo, four sparks. |
| `egg-nest-5` | `art/mystery-egg/egg-nest-5.webp` | webp | 360×300 display px (file 720×600, 2x) | Brightest glow, ready to hatch (five treasures). | — | idle wiggle (±5.5°) | Drawn, biggest halo, five sparks. |
| `bunny` | `art/mystery-egg/bunny.webp` | webp | 200×300 display px (file 400×600, 2x) | Lumi the bunny hero (placeholder name), goggles and overalls, standing. | — | bob (floatIdle, 8 px) in the hub; tap: wiggle | White ellipses, long ears, purple goggles. |
| `robot` | `art/mystery-egg/robot.webp` | webp | 140×180 display px (file 280×360, 2x) | Bip the robot (placeholder name): CLOSED, cheering eyes. Used only for cheer moments (success bounce); the idle still is `robot-blink` frame 0. | — | cheer: bounce (y -22, 160 ms yoyo ×4) on success; idle bob (floatIdle) is on the container; hub tap / ear tap: wiggle (angle ±5°) | Rounded boxes with cyan eyes and an antenna. |
| `capybara` | `art/mystery-egg/capybara.webp` | webp | 220×280 display px (file 440×560, 2x) | The capybara buddy, calm, sitting. | — | bob (floatIdle); tap: wiggle | Brown rounded body and head. |
| `cat-asleep` | `art/mystery-egg/cat-asleep.webp` | webp | 320×220 display px (file 640×440, 2x) | Monsieur Moustache, the baker cat, asleep in his bed under a pink blanket, chef hat on, "z z z". | — | breathing (scaleY 1 → 1.025, 1.4 s yoyo); replaced when he wakes | Drawn bed, blanket, orange cat with closed eyes. |
| `cat-awake` | `art/mystery-egg/cat-awake.webp` | webp | 320×320 display px (file 640×640, 2x) | Monsieur Moustache awake, paws up, chef hat, happy face (same 640x640 frame as `cat-wake`). | — | shown after the wake-up; stretch tween (scaleY 0.85 → 1.12 → 1) only when `cat-wake` is missing | Drawn orange cat with open eyes and a smile. |
| `heart-panel` | `art/mystery-egg/heart-panel.webp` | webp | 320×80 display px (file 640×160, 2x) | The robot's chest heart panel: a plate with 5 round sockets; socket centres at x = 40/100/160/220/280, y = 40 (1x). Drawn at 1.5x in the app. | — | none | Lavender rounded plate. |
| `slot-empty` | `art/mystery-egg/slot-empty.webp` | webp | 48×48 display px (file 96×96, 2x) | One empty, dark, unlit heart slot (round socket), centred on a socket. | — | none | Grey-violet circle. |
| `slot-filled` | `art/mystery-egg/slot-filled.webp` | webp | 48×48 display px (file 96×96, 2x) | The same slot lit: a glowing pink heart. | — | lit slots pulse (scale 1.12, 0.7 s yoyo); lighting: pop (scale 0.2 → 1.15) | Pink heart on a yellow glow. |
| `part-ball` | `art/mystery-egg/part-ball.webp` | webp | 64×64 display px (file 128×128, 2x) | Red ball with lighter dots (the rolling ball, the tray part at 1.6x, the goal card icon). | — | rolls by physics (rotation follows the body) | Red circle with pink dots. |
| `part-ramp` | `art/mystery-egg/part-ramp.webp` | webp | 240×140 display px (file 480×280, 2x) | Blue wooden ramp piece, long board with a support block. | — | tray: gentle sway (angle 3°); drag: scale ×1.1; snap: back-out ease to the slot, then sfx-pop | Blue slanted board. |
| `part-bell` | `art/mystery-egg/part-bell.webp` | webp | 96×110 display px (file 192×220, 2x) | Golden bell with a clapper (tray part, hanging bell on the board, goal card icon). | — | rings on success: angle ±14° shake (110 ms yoyo × 6) | Golden rounded bell. |
| `part-domino` | `art/mystery-egg/part-domino.webp` | webp | 48×110 display px (file 96×220, 2x) | Domino (listed for later missions; not used in 1.1). | — | none | Cream tile with dots. |
| `part-spring` | `art/mystery-egg/part-spring.webp` | webp | 80×110 display px (file 160×220, 2x) | Golden spring (listed for later missions; not used in 1.1). | — | none | Stacked gold rings. |
| `feather` | `art/mystery-egg/feather.webp` | webp | 120×120 display px (file 240×240, 2x) | Teal nest-treasure feather. | — | flies cat → nest (arc, spin 720°, scale 1.2 → 0.8, 1.1 s); rests on the nest rim (angle -35°) | Teal leaf shape with a quill line. |
| `vo-fr-instruction` | `audio/mystery-egg/vo-fr-instruction.ogg` | vo | Opus mono, short line | Hero: the request. Plays automatically once after `vo-fr-story` in the intro; at build start if Go cut the story (story cut, never doubled); and on every bunny tap (not on the ear button). | “Réveille Monsieur Moustache ! Fais rouler la balle pour sonner la cloche.” (`fr`) | — | Chime + speech-bubble cue above the cat. |
| `vo-fr-story` | `audio/mystery-egg/vo-fr-story.ogg` | vo | Opus mono, short line | Hero: the story beat. Plays first in the intro, then `vo-fr-instruction`. | “Oh non ! Monsieur Moustache dort, et il n'y a pas de croissants !” (`fr`) | — | Chime + speech-bubble cue above the cat. |
| `vo-fr-success` | `audio/mystery-egg/vo-fr-success.ogg` | vo | Opus mono, short line | Hero: success line after the feather reaches the nest. | “Bravo ! Tu as réveillé Monsieur Moustache !” (`fr`) | — | Chime + speech-bubble cue above the cat. |
| `vo-fr-presque` | `audio/mystery-egg/vo-fr-presque.ogg` | vo | Opus mono, short line | Hero: gentle near-miss line after a failed run in which the ball passed close to the bell (and no hint is due). | “Presque !” (`fr`) | — | Chime + speech-bubble cue above the cat. |
| `vo-fr-cat-croissants` | `audio/mystery-egg/vo-fr-cat-croissants.ogg` | vo | Opus mono, short line | Cat (Algieba): wakes up and cheers. The “(Mmm,)” parts are as recorded. | “(Mmm,) Mes croissants ! (Mmm,) Merci beaucoup !” (`fr`) | — | Chime + speech-bubble cue above the cat. |
| `vo-he-robot-help-1` | `audio/mystery-egg/vo-he-robot-help-1.ogg` | vo | Opus mono, short line | Bip (Puck, +8% pitch), Hebrew, feminine singular: explains the goal, never the solution. The GOAL hint: ladder rung 1 (2nd failed run) and every robot ear-button tap. | “בואי נעיר אותו! הכדור, la balle, צריך לצלצל בפעמון, la cloche!” (`he`) | — | Chime + speech-bubble cue next to the robot; no pointer. |
| `vo-he-robot-help-2` | `audio/mystery-egg/vo-he-robot-help-2.ogg` | vo | Opus mono, short line | Bip, Hebrew, feminine singular: points at the glowing slot (GDD hint step 3). Ladder rung 2 and the last rung, the GLOWING-SLOT hint (3rd failed run and every later one), played together with the pulsing slot pointer. | “שימי את הרמפה במקום שזוהר.” (`he`) | — | Chime + speech-bubble cue next to the robot; the slot pointer pulses. |
| `vo-he-robot-breathe` | `audio/mystery-egg/vo-he-robot-breathe.ogg` | vo | Opus mono, short line | Bip, Hebrew, feminine singular: the breathing/resilience line (GDD section 8, after 3 failed runs). Listed only, not wired in this prototype. | “קחי נשימה, תחשבי, ותנסי שוב!” (`he`) | — | n/a |
| `vo-fr-robot-regarde` | `audio/mystery-egg/vo-fr-robot-regarde.ogg` | vo | Opus mono, short line | Bip, French: “Look here!”. Listed only, not wired in this prototype. | “Regarde ici !” (`fr`) | — | n/a |
| `vo-fr-robot-aide` | `audio/mystery-egg/vo-fr-robot-aide.ogg` | vo | Opus mono, short line | Bip, French: “I'll help a bit!”. Listed only, not wired in this prototype. | “Je t'aide un peu !” (`fr`) | — | n/a |
| `sfx-robot-beep-1` | `audio/mystery-egg/sfx-robot-beep-1.ogg` | sfx | Opus mono, short sound | Short friendly robot beep (hint, hub robot tap). | — | — | Synthesized two-note square beep. |
| `sfx-robot-beep-2` | `audio/mystery-egg/sfx-robot-beep-2.ogg` | sfx | Opus mono, short sound | Rising sweep (ear button, hub egg tap). | — | — | Synthesized one-note square beep. |
| `sfx-robot-beep-3` | `audio/mystery-egg/sfx-robot-beep-3.ogg` | sfx | Opus mono, short sound | Happy 3-note arpeggio (a heart lights). | — | — | Synthesized three-note square beep. |
| `sfx-bell` | `audio/mystery-egg/sfx-bell.ogg` | sfx | Opus mono, short sound | The bell ringing (a bright single ring, about 1 s). | — | — | Synthesized sine ring. |
| `sfx-ball-roll` | `audio/mystery-egg/sfx-ball-roll.ogg` | sfx | Opus mono, short sound | A soft ball roll (about 1.4 s, played at Play). | — | — | Synthesized low rumble. |
| `sfx-success` | `audio/mystery-egg/sfx-success.ogg` | sfx | Opus mono, short sound | 4-note success chime. Plays 0.6 s after the bell on success. | — | — | Synthesized four-note triangle chime. |
| `sfx-pop` | `audio/mystery-egg/sfx-pop.ogg` | sfx | Opus mono, short sound | Soft pop. Plays when a part snaps into the slot and when the confetti bursts. | — | — | Synthesized two-tone pop. |
| `cat-wake` | `art/mystery-egg/cat-wake.webp` | sprite | single frame 320×320 display px (file frame 640×640); 6 frames, 8 fps (strip 3840×640) | Sprite strip: asleep → eye opens → yawn → stretch → rubs eye → awake, paws up. | — | plays once at the manifest fps when the cat wakes, holds the last frame 0.5 s, then swaps to `cat-awake`. Without it: the stretch tween on `cat-awake` | None: tweens on the static art. |
| `robot-blink` | `art/mystery-egg/robot-blink.webp` | sprite | single frame 140×180 display px (file frame 280×360); 4 frames, 10 fps (strip 1120×360) | Sprite strip: the robot with open eyes, blinking: open → half → closed → half. Frame 0 is the robot's idle still. | — | plays every 3-5 s (random) on the idle robot, then holds frame 0. Without it: the `robot` art is the idle still and a blink is a squash (scaleY 0.92, 80 ms yoyo) | None: squash tween on the static art. |
| `confetti` | `art/mystery-egg/confetti.webp` | sprite | single frame 32×32 display px (file frame 64×64); 6 frames, no fps (particle frames) (strip 384×64) | Sprite strip of 6 confetti particle pieces (not an animation): pink rect, mint rect, lavender curl, yellow star, turquoise dot, pink heart. | — | particle explosion on success; the 6 frames are the emitter frames 0-5 (spun and shrunk by the emitter) | Generated white rectangle, tinted. |

## Help ladder (order, frozen in code: `src/games/mysteryEgg/run.ts`, `HINT_LADDER`)

| Trigger | What plays | Pointer at the slot |
|---|---|---|
| Bunny tap, any time (intro and build) | `vo-fr-instruction` (cuts any playing line first) | no |
| Go tapped before the story ended | story cut, `vo-fr-instruction` once at build start | no |
| Robot ear button, any time (intro and build); not a ladder step | `vo-he-robot-help-1` (Hebrew goal hint) + `sfx-robot-beep-2` | no |
| 2nd failed run | `vo-he-robot-help-1` (goal hint) + `sfx-robot-beep-1` | no |
| 3rd failed run and every later one | `vo-he-robot-help-2` (glowing-slot hint) + `sfx-robot-beep-1` | yes, pulsing until the ramp is placed |
| A failed run that passed close to the bell, when no rung is due | `vo-fr-presque` | no |

## Wiring of the extras

Wired where cheap and natural: `vo-fr-story` (intro, before `vo-fr-instruction`), `vo-fr-presque` (a failed run that passed within twice the bell's reach, when no hint is due), `sfx-pop` (a part snaps; the confetti bursts), `sfx-success` (success, 0.6 s after the bell). Listed in the manifest only, not wired: `vo-fr-robot-regarde`, `vo-fr-robot-aide`, `vo-he-robot-breathe` (they belong to the fuller hint ladder, Pass 2).

## Notes for Gemini

- Keep the **centre** of each image at the visual centre: the code positions every image by its centre. `cat-wake` and `cat-awake` share one 640×640 frame (the code lines the cat's bottom up with the bed), and `robot`, `robot-blink` share one 280×360 frame.
- `egg-nest-0` … `egg-nest-5` must share the same canvas and egg position so the glow can step up in place.
- `part-ramp` (painterly, PR #110) is a solid wedge sloping down to the right (about 0.63 rad), 240×140 display. The code builds the physics body from a convex polygon in display px relative to the art centre (`layout.ts` `RAMP_POLY`: (-64,-52), (72,48), (32,65), (-82,26)), unrotated; the glow and the drawn placeholder use the same polygon. It is deliberately not the silhouette's peak (the ball would park on the crest). **If the ramp art is redrawn, keep that wedge geometry or update `RAMP_POLY`** so the drawn ramp and the solid ramp coincide.

## Game shell assets

Gemini's media contract for `docs/specs/game-shell.md` (their `game-shell/plan.md`, section (d)), adopted 2026-11-26. **37 ids**, kept in the sibling manifest **`src/content/gameShellAssets.json`** (verbatim from Gemini's snippet) and merged with `mysteryEggAssets.json` at load time into one manifest (78 ids; the same id in both files is an error: `tests/unit/game-shell.assets.test.ts` pins this list). `mysteryEggAssets.json` and the files under `art/mystery-egg` and `audio/mystery-egg` are unchanged.

- **Paths:** `public/art/game-shell/<id>.webp` and `public/audio/game-shell/<id>.ogg`, in the manifest as `art/game-shell/<id>.webp` and `audio/game-shell/<id>.ogg` (relative to the app base).
- **Sizes:** manifest `w`,`h` are the 1x display size (a sprite entry gives the single-frame size). File pixels: 2x for tiles, friends and the nest, **1x for `map-bg` and the six `shell-*` slide images** (display 1280×800). A walk strip is `frames × w × 2` wide.
- **Missing files:** these files arrive with Gemini's media PR. Until then the code draws placeholders (art), or plays a chime with a speech-bubble cue (voice); the files guard (`tests/unit/mystery-egg.files.test.ts`) accepts a missing `game-shell` file and still checks any that exist (sizes and listing).
- **Code only (no id):** the skip button, the path glow, the nest glow around `map-nest-home` that grows with the egg level, and the earned nest-piece placeholders (the feather reuses `art/mystery-egg/feather.webp`; the other pieces are drawn shapes). A closed world only wiggles: no voice and no sfx id.
- **Voice:** two-clip slides play the French hero clip, then the Hebrew clip after a 400 ms gap; ws-2 has the robot clip only. **Clip lengths at 1.0x** (PR #115, natural speed; replaces the earlier 15–20 s intro and ~10 s entry targets): intro-1 1.53 + 2.15 s, intro-2 2.63 + 3.21, intro-3 1.72 + 4.31, intro-4 3.61 + 6.91, ws-1 2.86 + 3.41, ws-2 5.51; the intro speaks 26.06 s (27.66 s with the four gaps) and the Workshop entry 11.77 s (12.17 s with its gap). The code has no duration fields and never auto-advances, so a re-recorded clip needs no code change. No names in the voice-over this pass. Hebrew clips are feminine singular where they address the child.
- **Anchors** (tile centres, 1280×800 board): nest-home (640,420), workshop (220,230), bakery (640,180), detective (1060,230), jungle (220,650), garden (1060,650).

| id | path | kind | size | depicts | transcript + lang (`vo-*`) |
|---|---|---|---|---|---|
| `shell-intro-1` | `art/game-shell/shell-intro-1.webp` | webp | 1280×800 display | Intro beat 1: the egg is found in the sunny square; friends run up, surprised and glad. | — |
| `shell-intro-2` | `art/game-shell/shell-intro-2.webp` | webp | 1280×800 display | Intro beat 2: close on the robot looking at its 5 empty heart slots; the bunny kneels beside it. | — |
| `shell-intro-3` | `art/game-shell/shell-intro-3.webp` | webp | 1280×800 display | Intro beat 3: the friends tuck a blanket and a feather around the egg in a cozy nest. | — |
| `shell-intro-4` | `art/game-shell/shell-intro-4.webp` | webp | 1280×800 display | Intro beat 4: the storybook map, Workshop open, the others cutely closed; a heart-glow and a treasure hint. | — |
| `shell-ws-1` | `art/game-shell/shell-ws-1.webp` | webp | 1280×800 display | Workshop entry 1: the friends at the open door; Monsieur Moustache asleep through a side window. | — |
| `shell-ws-2` | `art/game-shell/shell-ws-2.webp` | webp | 1280×800 display | Workshop entry 2: ramp, red ball rolling toward a bell; a glow toward the first heart slot. | — |
| `map-bg` | `art/game-shell/map-bg.webp` | webp | 1280×800 display | Ground and the five cobblestone paths from the centre clearing to five clearings (opaque, 1x file). No buildings, nest or characters. | — |
| `map-nest-home` | `art/game-shell/map-nest-home.webp` | webp | 360×300 display | Map-scale cozy nest with the speckled egg, blanket and feather (transparent, 2x file). Do not reuse `egg-nest-*`. | — |
| `map-world-workshop-open` | `art/game-shell/map-world-workshop-open.webp` | webp | 320×260 display | World tile `workshop`, open look (transparent, 2x file); anchor in the layout table. | — |
| `map-world-workshop-closed` | `art/game-shell/map-world-workshop-closed.webp` | webp | 320×260 display | World tile `workshop`, closed look (transparent, 2x file); anchor in the layout table. | — |
| `map-world-bakery-open` | `art/game-shell/map-world-bakery-open.webp` | webp | 320×260 display | World tile `bakery`, open look (transparent, 2x file); anchor in the layout table. | — |
| `map-world-bakery-closed` | `art/game-shell/map-world-bakery-closed.webp` | webp | 320×260 display | World tile `bakery`, closed look (transparent, 2x file); anchor in the layout table. | — |
| `map-world-detective-open` | `art/game-shell/map-world-detective-open.webp` | webp | 320×260 display | World tile `detective`, open look (transparent, 2x file); anchor in the layout table. | — |
| `map-world-detective-closed` | `art/game-shell/map-world-detective-closed.webp` | webp | 320×260 display | World tile `detective`, closed look (transparent, 2x file); anchor in the layout table. | — |
| `map-world-jungle-open` | `art/game-shell/map-world-jungle-open.webp` | webp | 320×260 display | World tile `jungle`, open look (transparent, 2x file); anchor in the layout table. | — |
| `map-world-jungle-closed` | `art/game-shell/map-world-jungle-closed.webp` | webp | 320×260 display | World tile `jungle`, closed look (transparent, 2x file); anchor in the layout table. | — |
| `map-world-garden-open` | `art/game-shell/map-world-garden-open.webp` | webp | 320×260 display | World tile `garden`, open look (transparent, 2x file); anchor in the layout table. | — |
| `map-world-garden-closed` | `art/game-shell/map-world-garden-closed.webp` | webp | 320×260 display | World tile `garden`, closed look (transparent, 2x file); anchor in the layout table. | — |
| `map-bunny-idle` | `art/game-shell/map-bunny-idle.webp` | webp | 160×200 display | Friend at rest, 3/4 pose facing slightly right (transparent, 2x file). | — |
| `map-bunny-walk` | `art/game-shell/map-bunny-walk.webp` | sprite | single frame 160×200 display; 4 frames, 8 fps | Walk strip: 4 equal frames side by side, facing right (the code flips it when going left); 8 fps. | — |
| `map-robot-idle` | `art/game-shell/map-robot-idle.webp` | webp | 120×150 display | Friend at rest, 3/4 pose facing slightly right (transparent, 2x file). | — |
| `map-robot-walk` | `art/game-shell/map-robot-walk.webp` | sprite | single frame 120×150 display; 4 frames, 8 fps | Walk strip: 4 equal frames side by side, facing right (the code flips it when going left); 8 fps. | — |
| `map-capybara-idle` | `art/game-shell/map-capybara-idle.webp` | webp | 160×190 display | Friend at rest, 3/4 pose facing slightly right (transparent, 2x file). | — |
| `map-capybara-walk` | `art/game-shell/map-capybara-walk.webp` | sprite | single frame 160×190 display; 4 frames, 8 fps | Walk strip: 4 equal frames side by side, facing right (the code flips it when going left); 8 fps. | — |
| `map-frog-idle` | `art/game-shell/map-frog-idle.webp` | webp | 110×130 display | Friend at rest, 3/4 pose facing slightly right (transparent, 2x file). | — |
| `map-frog-walk` | `art/game-shell/map-frog-walk.webp` | sprite | single frame 110×130 display; 4 frames, 8 fps | Walk strip: 4 equal frames side by side, facing right (the code flips it when going left); 8 fps. | — |
| `vo-shell-intro-1-hero` | `audio/game-shell/vo-shell-intro-1-hero.ogg` | vo | Opus mono | Voice clip. | “Oh ! Un œuf !” (`fr`) |
| `vo-shell-intro-1-narr` | `audio/game-shell/vo-shell-intro-1-narr.ogg` | vo | Opus mono | Voice clip. | “ביצה חמה התגלגלה לכיכר!” (`he`) |
| `vo-shell-intro-2-hero` | `audio/game-shell/vo-shell-intro-2-hero.ogg` | vo | Opus mono | Voice clip. | “Mon petit robot… tu ne sais pas encore sentir.” (`fr`) |
| `vo-shell-intro-2-robot` | `audio/game-shell/vo-shell-intro-2-robot.ogg` | vo | Opus mono | Voice clip. | “הלב שלי עוד ריק. אני לא יודע להרגיש.” (`he`) |
| `vo-shell-intro-3-hero` | `audio/game-shell/vo-shell-intro-3-hero.ogg` | vo | Opus mono | Voice clip. | “On va t'aider, petit œuf. Promis !” (`fr`) |
| `vo-shell-intro-3-robot` | `audio/game-shell/vo-shell-intro-3-robot.ogg` | vo | Opus mono | Voice clip. | “נבנה לך קן חם, un nid. וגם אני אלמד להרגיש.” (`he`) |
| `vo-shell-intro-4-hero` | `audio/game-shell/vo-shell-intro-4-hero.ogg` | vo | Opus mono | Voice clip. | “Regarde ! Des cœurs… et des trésors pour le nid.” (`fr`) |
| `vo-shell-intro-4-narr` | `audio/game-shell/vo-shell-intro-4-narr.ogg` | vo | Opus mono | Voice clip. | “מצליחים — הרובוט מקבל לב, un cœur. כמה משחקים — מתנה לקן. ככה הביצה תבקע!” (`he`) |
| `vo-shell-ws-1-hero` | `audio/game-shell/vo-shell-ws-1-hero.ogg` | vo | Opus mono | Voice clip. | “Voici l'atelier ! Monsieur Moustache dort !” (`fr`) |
| `vo-shell-ws-1-narr` | `audio/game-shell/vo-shell-ws-1-narr.ogg` | vo | Opus mono | Voice clip. | “החתול האופה ישן. בואי נעיר אותו!” (`he`) |
| `vo-shell-ws-2-robot` | `audio/game-shell/vo-shell-ws-2-robot.ogg` | vo | Opus mono | Voice clip. | “שמים חלקים, לוחצים על נגן, והכדור, la balle, מתגלגל!” (`he`) |
