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

Added 2026-11-26 for `docs/specs/game-shell.md` (the map, the slides and the progression). **38 new ids** (79 in total; a unit test pins the list: `tests/unit/game-shell.assets.test.ts`). Same paths, formats and 2x rule as above, with these additions:

- **`pending: true`** (new optional manifest field): the entry's file has not been delivered yet. The code never reads it (a missing file already falls back to a placeholder); only the files guard (`tests/unit/mystery-egg.files.test.ts`) does: a **missing file is allowed only for a `pending` entry**. When a file lands, nothing has to change; removing `"pending": true` from the entry is optional tidying.
- **1x files:** `hub-bg`, `map-bg` and the six slide images are 1280×800 files at 1x (display 1280×800). Everything else is 2x (file = 2 × display).
- **Placeholders** (file missing): art is drawn by `shellArt.ts` (storybook meadow, simple houses with a padlock, a sleeping animal or fog, a cobble patch, drawn pieces); voice is the chime plus a speech-bubble cue; sfx are synthesized.

| id | path | kind | display px (file px) | depicts | transcript + lang (`vo-*`) | where it is used | placeholder |
|---|---|---|---|---|---|---|---|
| `map-bg` | `art/mystery-egg/map-bg.webp` | webp | 1280×800 (1x) | Soft pastel storybook ground for the map: meadow, flowers, a few clouds. No buildings, no paths, no characters (the code draws the nest, worlds and paths on top). Keep the middle clear for the nest. | — | the map scene backdrop (replaces `hub-bg` there) | Drawn pastel sky and meadow. |
| `map-path` | `art/mystery-egg/map-path.webp` | webp | 96×96 (192×192) | ONE cobblestone patch (a few round beige stones with mortar), centred, soft edges, transparent outside. The code stamps it along each path every ~56 px with a small random rotation, so it must tile visually in any rotation. | — | cobblestone paths from the nest to each world | Drawn beige cobble ellipse. |
| `world-workshop` | `art/mystery-egg/world-workshop.webp` | webp | 340×280 (680×560) | Machine Workshop house, OPEN and glowing: wooden house with gear decorations, warm light in the arched door (see `map-v1.jpg`). Door at the bottom centre. | — | the Workshop on the map; wiggle on tap | Drawn brown house, glowing door. |
| `world-bakery` | `art/mystery-egg/world-bakery.webp` | webp | 340×280 (680×560) | Pink bakery with a striped awning, OPEN look (awake baker-cat in the window). Not shown until the world unlocks. | — | future open look | Drawn pink house. |
| `world-bakery-locked` | `art/mystery-egg/world-bakery-locked.webp` | webp | 340×280 (680×560) | The same bakery closed in a cute way: a sleeping baker-cat with a chef hat in the window, "z z z". | — | the locked bakery | Drawn pink house, sleeping cat, z's. |
| `world-owl-house` | `art/mystery-egg/world-owl-house.webp` | webp | 340×280 (680×560) | Purple house, OPEN look (clear door, no fog). | — | future open look | Drawn purple house. |
| `world-owl-house-locked` | `art/mystery-egg/world-owl-house-locked.webp` | webp | 340×280 (680×560) | The purple house with a padlock sign hanging by the door and an owl in a foggy doorway. | — | the locked owl house | Drawn purple house, padlock, fog. |
| `world-jungle` | `art/mystery-egg/world-jungle.webp` | webp | 340×280 (680×560) | Jungle arch of vines, OPEN look (clear green forest inside). | — | future open look | Drawn vine arch. |
| `world-jungle-locked` | `art/mystery-egg/world-jungle-locked.webp` | webp | 340×280 (680×560) | The jungle arch full of mist with a sleeping owl on top. | — | the locked jungle | Drawn arch, mist, sleeping owl. |
| `world-garden` | `art/mystery-egg/world-garden.webp` | webp | 340×280 (680×560) | Garden door in a hill, OPEN look (door ajar, flowers blooming). | — | future open look | Drawn round door. |
| `world-garden-locked` | `art/mystery-egg/world-garden-locked.webp` | webp | 340×280 (680×560) | The garden door tied shut with flowers, a watering can beside it. | — | the locked garden | Drawn round door with a flower tie. |
| `frog` | `art/mystery-egg/frog.webp` | webp | 140×160 (280×320) | The baby frog friend, standing, happy, bib. Same character scale as `robot`. | — | walks with the friends on the age-2 profile; idle bob | Green rounded body, big eyes. |
| `piece-knit-square` | `art/mystery-egg/piece-knit-square.webp` | webp | 120×120 (240×240) | Nest piece: a small knitted purple square (placeholder id; bakery). | — | rests in the nest; flies in when earned | Purple square with stitches. |
| `piece-pebble` | `art/mystery-egg/piece-pebble.webp` | webp | 120×120 (240×240) | Nest piece: a smooth speckled pebble (owl house). | — | same | Grey ellipse. |
| `piece-leaf` | `art/mystery-egg/piece-leaf.webp` | webp | 120×120 (240×240) | Nest piece: a big green leaf (jungle). | — | same | Green leaf. |
| `piece-flower` | `art/mystery-egg/piece-flower.webp` | webp | 120×120 (240×240) | Nest piece: a flower (garden). | — | same | Pink flower. |
| `icon-skip` | `art/mystery-egg/icon-skip.webp` | webp | 96×96 (192×192) | Picture-only skip icon: a round button with a "next, next" double arrow (no text). | — | the skip button of the slide player | Drawn round button with a double arrow. |
| `slide-intro-1` | `art/mystery-egg/slide-intro-1.webp` | webp | 1280×800 (1x) | Film scene 1: sunny town square, the speckled egg has rolled in and glows, Lumi and Bip run up, surprised. | — | intro slide 1 | Pastel card with a drawn egg. |
| `slide-intro-2` | `art/mystery-egg/slide-intro-2.webp` | webp | 1280×800 (1x) | Scene 2: close on Bip, five empty heart slots on the tummy panel, Lumi kneeling beside him. | — | intro slide 2 | Pastel card with a drawn robot panel. |
| `slide-intro-3` | `art/mystery-egg/slide-intro-3.webp` | webp | 1280×800 (1x) | Scene 4: the storybook map from above, the nest in the middle, five worlds, the Workshop door glowing. | — | intro slide 3 | Pastel card with five dots round a nest. |
| `slide-intro-4` | `art/mystery-egg/slide-intro-4.webp` | webp | 1280×800 (1x) | Scene 5: a heart gear clicks into Bip's panel; a feather and a knitted square fly into the glowing nest. | — | intro slide 4 | Pastel card with a gear and a feather. |
| `slide-workshop-1` | `art/mystery-egg/slide-workshop-1.webp` | webp | 1280×800 (1x) | Entry scene 1: the friends at the open Workshop door, warm light, ramps, red ball, gears inside. | — | Workshop entry slide 1 | Pastel card with a drawn door. |
| `slide-workshop-2` | `art/mystery-egg/slide-workshop-2.webp` | webp | 1280×800 (1x) | Entry scene 4: a laugh-light runs into Bip's first heart gear; a nest piece flies to the egg; Lumi ready to play. | — | Workshop entry slide 2 | Pastel card with a gear and a heart. |
| `vo-fr-intro-1` | `audio/mystery-egg/vo-fr-intro-1.ogg` | vo | Opus mono | Lumi (hero), French, surprised and warm. | “Oh ! Un œuf ! Il est tout chaud…” (`fr`) | intro slide 1, first | chime + bubble |
| `vo-he-intro-1` | `audio/mystery-egg/vo-he-intro-1.ogg` | vo | Opus mono | Bip (Puck, +8% pitch), Hebrew. | “ביצה? איזו הפתעה… יש מישהו בפנים.” (`he`) | intro slide 1, after the French line | chime + bubble |
| `vo-fr-intro-2` | `audio/mystery-egg/vo-fr-intro-2.ogg` | vo | Opus mono | Lumi, French, kind. | “Mon petit robot… tu ne sais pas encore sentir.” (`fr`) | intro slide 2 | chime + bubble |
| `vo-he-intro-2` | `audio/mystery-egg/vo-he-intro-2.ogg` | vo | Opus mono | Bip, Hebrew. | “אני יודע לחשוב ולבנות. אבל הלב שלי עוד ריק. אני לא יודע להרגיש.” (`he`) | intro slide 2 | chime + bubble |
| `vo-fr-intro-3` | `audio/mystery-egg/vo-fr-intro-3.ogg` | vo | Opus mono | Lumi, French. | “Regarde ! Il y a des mondes à explorer.” (`fr`) | intro slide 3 | chime + bubble |
| `vo-he-intro-3` | `audio/mystery-egg/vo-he-intro-3.ogg` | vo | Opus mono | Bip, Hebrew. | “זאת המפה. בכל עולם יש משחק אחר. אפשר ללכת לשם עם החברים, על השביל.” (`he`) | intro slide 3 | chime + bubble |
| `vo-fr-intro-4` | `audio/mystery-egg/vo-fr-intro-4.ogg` | vo | Opus mono | Lumi, French. | “Des cœurs pour mon robot… et des trésors pour le nid.” (`fr`) | intro slide 4 | chime + bubble |
| `vo-he-intro-4` | `audio/mystery-egg/vo-he-intro-4.ogg` | vo | Opus mono | Bip, Hebrew (the longest line, about 12 s). | “כשמסיימים משחק, אני מקבל גלגל לב ולומד להרגיש. ואחרי כמה משחקים בעולם, הביצה מקבלת חלק חשוב לקן. ככה היא תוכל לבקוע.” (`he`) | intro slide 4 | chime + bubble |
| `vo-fr-workshop-entry-1` | `audio/mystery-egg/vo-fr-workshop-entry-1.ogg` | vo | Opus mono | Lumi, French. | “Voici l'atelier ! Ici, on construit des machines.” (`fr`) | Workshop entry slide 1 | chime + bubble |
| `vo-he-workshop-entry-1` | `audio/mystery-egg/vo-he-workshop-entry-1.ogg` | vo | Opus mono | Bip, Hebrew. | “זאת הסדנה! כאן בונים מכונות מצחיקות, אחת אחרי השנייה, כמו שרשרת.” (`he`) | Workshop entry slide 1 | chime + bubble |
| `vo-fr-workshop-entry-2` | `audio/mystery-egg/vo-fr-workshop-entry-2.ogg` | vo | Opus mono | Lumi, French, excited. | “Clic, clac… boum ! On y va ?” (`fr`) | Workshop entry slide 2 | chime + bubble |
| `vo-he-workshop-entry-2` | `audio/mystery-egg/vo-he-workshop-entry-2.ogg` | vo | Opus mono | Bip, Hebrew. | “כשמצליחים, אני מקבל קצת צחוק לגלגל הלב. ואחרי כמה משחקים, הביצה מקבלת חלק חשוב. יאללה, בואו נשחק!” (`he`) | Workshop entry slide 2 | chime + bubble |
| `vo-he-robot-locked` | `audio/mystery-egg/vo-he-robot-locked.ogg` | vo | Opus mono, short | Bip, Hebrew, **feminine singular**, gentle. **A proposal: the scripts have no locked line (pending Maor).** | “העולם הזה עוד ישן. בואי נלך לסדנה!” (`he`) | a tap on a locked world | chime + bubble next to the robot |
| `sfx-locked` | `audio/mystery-egg/sfx-locked.ogg` | sfx | Opus mono, short | A sleepy, soft "zzz" / low yawn-like boop (about 0.6 s). | — | a tap on a locked world | Synthesized low two-note sine. |
| `sfx-walk` | `audio/mystery-egg/sfx-walk.ogg` | sfx | Opus mono, short | A light, cheerful footstep patter (about 0.5 s, played once as the walk starts). | — | the friends start walking | Synthesized three soft pops. |

**Notes for Gemini (shell):** the hero lines (French) and robot lines (Hebrew) are copied exactly from `design/game-shell-scripts.md`, minus the guillemets. The Hebrew robot lines of the script use the robot's own voice (masculine "אני") and plural addresses; the only child-facing line the code agent wrote (`vo-he-robot-locked`) is feminine singular. The map is landscape-first; `map-bg` is letterboxed in portrait like `hub-bg`. World art is centred on its canvas with the door at the bottom centre; the code tints nothing and wiggles the whole image.
