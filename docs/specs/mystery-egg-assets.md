# `mystery-egg` — asset contract (code agent ↔ Gemini agent)

Status: **approved** (agreed between the code agent and the Gemini agent as part of Maor's approved task of 2026-11-25).
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
- **`w` and `h` are the DISPLAY size in game px** (the game board is 1280×800). Art files are drawn at **2x**: a 360×300 entry is a 720×600 file. The code draws the image at `w`×`h` with `setDisplaySize`, so a 1x or 3x file also works, only sharper or softer.
- **All non-sprite art uses `kind: "webp"`** (static, alpha). There are no `.svg` paths.
- **Sprites** (`kind: "sprite"`) are **horizontal strips**: `frames` equal-width frames side by side. `w`,`h` are the **single-frame** display size. The code reads `frames`, `fps`, `w` and `h` from the manifest (never hardcoded) and takes the real frame width from the loaded texture width ÷ `frames`, so the strip works at any file scale. There are exactly two sprite entries, `cat-wake` and `robot-blink`. **Their frame counts, fps and sizes are placeholders — TBD by Gemini's assets PR**: edit `frames`, `fps`, `w`, `h` in the manifest if the real strips differ (a data edit, not a code change).
- **Voice lines** (`kind: "vo"`) must have `transcript` and `lang`. Hebrew lines are **feminine singular**, addressing Elli, and the robot help lines **explain the request, never the solution**. The transcripts below are placeholders for Gemini to refine (changing a transcript is a manifest edit).
- **Sfx** (`kind: "sfx"`) have no size fields.

## Placeholder behaviour (a file is missing)

- **Art:** the loader (`eggAssetLoader.ts`) queues every art file; a Phaser `loaderror` marks the key missing, and that image is drawn as a simple Phaser shape instead (`art.ts`, `drawPlaceholder`). Nothing throws, offline works, and a file that arrives later is used the next time the scene opens.
- **Sprites:** with no strip the code uses a tween on the static image (the cat stretches, the robot squashes).
- **Sfx:** a short synthesized WebAudio beep, chime, or ring (`placeholderSfx.ts`).
- **Voice:** a short chime plus a speech-bubble cue next to the speaker. There is no device-TTS fallback for these ids. The speech spy still records every requested line id and language.
- A missing file is requested once per page session, then skipped.

## Manifest ids

All 34 ids, exactly (a unit test pins this list: `tests/unit/mystery-egg.assets.test.ts`). The *Motion* column lists the Phaser tweens used on the whole image; the *Placeholder* column says what is drawn until the file exists.

| id | path | kind | size / frame spec | depicts | transcript + lang (`vo-*`) | motion (tweens) | placeholder |
|---|---|---|---|---|---|---|---|
| `hub-bg` | `art/mystery-egg/hub-bg.webp` | webp | 1280×800 display px (file 2560×1600, 2x) | Soft meadow behind the nest, bright and calm (no characters). | — | none (static) | Full-screen drawn sky and two green hills. |
| `egg-nest-0` | `art/mystery-egg/egg-nest-0.webp` | webp | 360×300 display px (file 720×600, 2x) | Speckled egg in a twig nest, no glow (start). | — | tiny idle wiggle (angle ±1.5°), pop-in on entry; tap: wiggle | Drawn nest + egg, no halo. |
| `egg-nest-1` | `art/mystery-egg/egg-nest-1.webp` | webp | 360×300 display px (file 720×600, 2x) | Same egg and nest, first soft glow (after mission 1.1). | — | idle wiggle (angle ±2.3°); success view: pop (scale 1.18 → 1) | Drawn nest + egg with a warm halo and one spark. |
| `egg-nest-2` | `art/mystery-egg/egg-nest-2.webp` | webp | 360×300 display px (file 720×600, 2x) | Brighter glow (two nest treasures). | — | idle wiggle (±3.1°) | Drawn, bigger halo, two sparks. |
| `egg-nest-3` | `art/mystery-egg/egg-nest-3.webp` | webp | 360×300 display px (file 720×600, 2x) | Brighter glow (three treasures). | — | idle wiggle (±3.9°) | Drawn, bigger halo, three sparks. |
| `egg-nest-4` | `art/mystery-egg/egg-nest-4.webp` | webp | 360×300 display px (file 720×600, 2x) | Very bright glow (four treasures). | — | idle wiggle (±4.7°) | Drawn, bigger halo, four sparks. |
| `egg-nest-5` | `art/mystery-egg/egg-nest-5.webp` | webp | 360×300 display px (file 720×600, 2x) | Brightest glow, ready to hatch (five treasures). | — | idle wiggle (±5.5°) | Drawn, biggest halo, five sparks. |
| `bunny` | `art/mystery-egg/bunny.webp` | webp | 220×300 display px (file 440×600, 2x) | Lumi the bunny hero (placeholder name), goggles and overalls, standing. | — | bob (floatIdle, 8 px) in the hub; tap: wiggle | White ellipses, long ears, purple goggles. |
| `robot` | `art/mystery-egg/robot.webp` | webp | 200×260 display px (file 400×520, 2x) | Bip the robot (placeholder name): white and lavender, dark face screen with cyan eyes, antenna. | — | bob (floatIdle); blink = squash (scaleY 0.92) every 4.5 s; ear tap / hub tap: wiggle | Rounded boxes with cyan eyes and an antenna. |
| `capybara` | `art/mystery-egg/capybara.webp` | webp | 260×200 display px (file 520×400, 2x) | The capybara buddy, calm, sitting. | — | bob (floatIdle); tap: wiggle | Brown rounded body and head. |
| `cat-asleep` | `art/mystery-egg/cat-asleep.webp` | webp | 380×230 display px (file 760×460, 2x) | Monsieur Moustache, the baker cat, asleep in his bed under a pink blanket, chef hat on, "z z z". | — | breathing (scaleY 1 → 1.025, 1.4 s yoyo); replaced when he wakes | Drawn bed, blanket, orange cat with closed eyes. |
| `cat-awake` | `art/mystery-egg/cat-awake.webp` | webp | 300×340 display px (file 600×680, 2x) | Monsieur Moustache awake, standing and stretching, chef hat, happy face. | — | stretch on wake (scaleY 0.85 → 1.12 → 1, squash/stretch) when `cat-wake` is not available | Drawn orange cat with open eyes and a smile. |
| `heart-panel` | `art/mystery-egg/heart-panel.webp` | webp | 600×130 display px (file 1200×260, 2x) | The robot's chest heart panel: a plate with room for 5 round slots in a row (the slots are drawn on top). | — | none | Lavender rounded plate. |
| `slot-empty` | `art/mystery-egg/slot-empty.webp` | webp | 96×96 display px (file 192×192, 2x) | One empty, dark, unlit heart slot (round socket). | — | none | Grey-violet circle. |
| `slot-filled` | `art/mystery-egg/slot-filled.webp` | webp | 96×96 display px (file 192×192, 2x) | The same slot lit: a glowing pink heart. | — | lit slots pulse (scale 1.12, 0.7 s yoyo); lighting: pop (scale 0.2 → 1.15) | Pink heart on a yellow glow. |
| `part-ball` | `art/mystery-egg/part-ball.webp` | webp | 120×120 display px (file 240×240, 2x) | Red ball with lighter dots (the rolling ball, and the goal card icon). | — | rolls by physics (rotation follows the body) | Red circle with pink dots. |
| `part-ramp` | `art/mystery-egg/part-ramp.webp` | webp | 220×130 display px (file 440×260, 2x) | Blue wooden ramp piece, long board with a support block. | — | tray: gentle sway (angle 3°); drag: scale 1.1; snap: back-out ease to the slot | Blue slanted board. |
| `part-bell` | `art/mystery-egg/part-bell.webp` | webp | 120×140 display px (file 240×280, 2x) | Golden bell with a clapper (tray part, hanging bell on the board, goal card icon). | — | rings on success: angle ±14° shake (110 ms yoyo × 6) | Golden rounded bell. |
| `part-domino` | `art/mystery-egg/part-domino.webp` | webp | 120×120 display px (file 240×240, 2x) | Domino (listed for later missions; not used in 1.1). | — | none | Cream tile with dots. |
| `part-spring` | `art/mystery-egg/part-spring.webp` | webp | 100×140 display px (file 200×280, 2x) | Golden spring (listed for later missions; not used in 1.1). | — | none | Stacked gold rings. |
| `feather` | `art/mystery-egg/feather.webp` | webp | 80×110 display px (file 160×220, 2x) | Teal nest-treasure feather. | — | flies cat → nest (arc, spin 720°, scale 1.2 → 0.8, 1.1 s); rests on the nest rim (angle -35°) | Teal leaf shape with a quill line. |
| `confetti` | `art/mystery-egg/confetti.webp` | webp | 40×40 display px (file 80×80, 2x) | One small confetti piece (a particle texture; tinted in code). | — | particle explosion on success | Generated white rectangle, tinted. |
| `vo-fr-instruction` | `audio/mystery-egg/vo-fr-instruction.ogg` | vo | Opus mono, short line | Narrator/neighbour: the request that starts mission 1.1. | “Monsieur Moustache dort ! Il doit faire les croissants !” (`fr`) | — | Chime + speech-bubble cue above the cat. |
| `vo-fr-success` | `audio/mystery-egg/vo-fr-success.ogg` | vo | Opus mono, short line | Success line after the feather reaches the nest. | “Bravo ! Monsieur Moustache est réveillé !” (`fr`) | — | Chime + speech-bubble cue above the cat. |
| `vo-fr-cat-croissants` | `audio/mystery-egg/vo-fr-cat-croissants.ogg` | vo | Opus mono, short line | The cat wakes up and cheers. | “Mes croissants !” (`fr`) | — | Chime + speech-bubble cue above the cat. |
| `vo-he-robot-help-1` | `audio/mystery-egg/vo-he-robot-help-1.ogg` | vo | Opus mono, short line | Bip, in Hebrew (feminine singular, to Elli): explains the REQUEST, never the solution. First hint (after the 2nd failed run). | “Elli, החתול ישן והוא צריך להתעורר. תעזרי לכדור להגיע אל הפעמון.” (`he`) | — | Chime + speech-bubble cue next to the robot; the slot pointer pulses. |
| `vo-he-robot-help-2` | `audio/mystery-egg/vo-he-robot-help-2.ogg` | vo | Opus mono, short line | Bip, in Hebrew (feminine singular, to Elli): explains the REQUEST in other words, never the solution. Second hint (after the 4th failed run). | “Elli, נסי לחשוב איזה חלק חסר כדי שהכדור יוכל להמשיך הלאה.” (`he`) | — | Chime + speech-bubble cue next to the robot; the slot pointer pulses. |
| `sfx-robot-beep-1` | `audio/mystery-egg/sfx-robot-beep-1.ogg` | sfx | Opus mono, short sound | Short friendly robot beep (hint, hub robot tap). | — | — | Synthesized two-note square beep. |
| `sfx-robot-beep-2` | `audio/mystery-egg/sfx-robot-beep-2.ogg` | sfx | Opus mono, short sound | Short robot beep (ear button, egg tap). | — | — | Synthesized one-note square beep. |
| `sfx-robot-beep-3` | `audio/mystery-egg/sfx-robot-beep-3.ogg` | sfx | Opus mono, short sound | Rising three-note robot beep (a part snaps, a heart lights). | — | — | Synthesized three-note square beep. |
| `sfx-bell` | `audio/mystery-egg/sfx-bell.ogg` | sfx | Opus mono, short sound | The bell ringing (a bright single ring, about 1 s). | — | — | Synthesized sine ring. |
| `sfx-ball-roll` | `audio/mystery-egg/sfx-ball-roll.ogg` | sfx | Opus mono, short sound | A ball rolling on wood (short, about 0.5 s, played at Play). | — | — | Synthesized low rumble. |
| `cat-wake` | `art/mystery-egg/cat-wake.webp` | sprite | single frame 300×340 display px; 8 frames, 10 fps (file 4800×680 at 2x) — **TBD by Gemini's assets PR** | Sprite strip: the cat asleep, waking, then stretching (placeholder 8 frames). | — | plays once when the cat wakes; then the awake art stays. Without it: the stretch tween on `cat-awake` | None: tweens on the static art. |
| `robot-blink` | `art/mystery-egg/robot-blink.webp` | sprite | single frame 200×260 display px; 4 frames, 10 fps (file 1600×520 at 2x) — **TBD by Gemini's assets PR** | Sprite strip: the robot blinking (placeholder 4 frames). | — | plays every 4.5 s on the robot while it idles (hub and mission); without it the robot squashes (scaleY 0.92, 80 ms yoyo) | None: squash tween on the static art. |

## Notes for Gemini

- Style: warm pastel, dark-brown outline like the existing characters (`GEMINI.md`). The bunny, robot, capybara, and cat designs follow the approved character sheets in the story bible; Lumi and Bip are placeholder names.
- Keep the **centre** of each image at the visual centre: the code positions every image by its centre. The cat sprite and `cat-asleep`/`cat-awake` share one anchor (the bed), and `robot` and `robot-blink` share one anchor.
- `egg-nest-0` … `egg-nest-5` must share the same canvas and egg position so the glow can step up in place.
- `slot-empty` and `slot-filled` are 96×96 display px, five of them sit in `heart-panel` (600×130 display px) at 112 px spacing, centred.
- `part-ramp` is drawn sloping down to the right (as in the board), 220×130.
