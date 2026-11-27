# Workshop L20 "Bonjour, Ville des Surprises !": asset contract (code ↔ Gemini)

Status: **agreed** with Gemini on 2026-11-27 (with Gemini's amendments, applied below). Team-lead decisions: egg piece = the final shell piece that completes the egg; FR story/gags + HE Bip hints; saves/progress may change; `?level=20` jumps to L20. Spec: `docs/specs/workshop-l20.md`; manifest: `src/content/workshopAssets.json` (47 keys, pinned by `tests/unit/workshop-l20.assets.test.ts`).
Gemini owns every media file listed here. Code builds against these keys and paths. Each key is drawn as a code placeholder until its file lands, and the final PR ships only with the real files.
Source of geometry: `src/games/mysteryEgg/workshop/l20Level.ts` (from the v4 simulator `l20.cjs` + `lib4.cjs`). A to-scale layout guide (world px, 1280×800) is kept next to the design files (`l20-layout-guide.png`); paint art over it so it matches the physics bodies.

## 1. Conventions (the same as `docs/specs/mystery-egg-assets.md`, the frozen 1.1 contract)

| Rule | Value |
|---|---|
| Art on disk | `public/art/mystery-egg/<key>.webp`, WebP with alpha, **2x** (file px = 2 × display px). Backgrounds are **1x** 1280×800, like `hub-bg`. |
| Audio on disk | `public/audio/mystery-egg/<key>.ogg`, Ogg Opus, mono, 48 kHz, peak about −3 dBFS, no leading or trailing silence over 50 ms. |
| Manifest | **New file `src/content/workshopAssets.json`**, the same zod schema as `mysteryEggAssets.json` (`path`, `kind` = `webp`/`sprite`/`vo`/`sfx`, `w`, `h`, `frames`, `fps`, `transcript`, `lang`). It is a separate file because the 1.1 manifest's 41 ids are pinned by `tests/unit/mystery-egg.assets.test.ts`. Existing keys are reused **by their existing key** from the old manifest, never copied. |
| Paths | relative to the app base, for example `art/mystery-egg/ws-sandbag.webp` (no leading `/`, no `public/`). |
| `w`,`h` | **display size in world px** (the board is 1280×800). |
| Anchor | **The image centre = the physics body centre** (the code positions by centre and rotates about it). Any exception is spelled out per row. |
| Sprites | horizontal strips, `frames` equal frames, `w`,`h` = one frame (display), with `fps`. |
| Key prefix | sfx keys start `sfx-ws-` and VO keys `vo-<lang>-ws-` (the existing `sfx-`/`vo-` prefixes kept); `ws-` = a Workshop part or character that later levels reuse; `ws-l20-` = only L20. Sleeper keys: `ws-sleeper-<id>-<state>`, with ids `moustache`, `bruno`, `plume`, `cocopom`, `pip`, `grandpere`. |
| Missing file | Placeholder per row (art: a code-drawn shape; sfx: a synth tone; VO: a chime plus a speech-bubble cue), never a crash. This is the existing `eggAssetLoader` / `playEggSfx` / voice behaviour. |
| Voice languages | v4 §1.6: **gags and story are French VO**; **Hebrew only for Bip's hints**, feminine singular, no child's name. |

## 2. Art: static images

| key | path | display w×h (file 2x) | anchor / placement (world px) | depicts | motion | placeholder |
|---|---|---|---|---|---|---|
| `ws-l20-bg-dawn` | art/mystery-egg/ws-l20-bg-dawn.webp | 1280×800 (1x) | full screen, top-left 0,0 | Workshop interior frame (ceiling beam y 40–60, side walls x 20–40 / 1250–1270, floor top y 700, warm floor strip y 700–800 for the tray) with a big window onto the **town square at dawn** (pale, sleepy blue-pink, empty streets, house facades). No characters, no machine parts, no bells. Leave the **six window spots** (§2.1) as plain wall: the frames are separate images. | static | Code-drawn sky gradient + simple roofs |
| `ws-l20-bg-morning` | art/mystery-egg/ws-l20-bg-morning.webp | 1280×800 (1x) | same frame as dawn, **pixel-for-pixel aligned** (derived from dawn) | Same picture, **full morning**: sun up, warm light, shutters open. It is crossfaded in on the win ("the town wakes"). | crossfade 1.2 s on the win | Brighter gradient |
| `ws-l20-fixtures` | art/mystery-egg/ws-l20-fixtures.webp | 1280×800 (2x file 2560×1600) | full screen, top-left 0,0; **one 2560×1600 layer composited (by Gemini, locally) onto the `l20.cjs` rects, ±1 px** | One transparent layer with every **static** body painted in place: the chute (walls x 152–158 and 242–248, y 40–150, with a trapdoor at the bottom), the sunk cup (lip x 268–300, y 560–624; floor x 280–390, y 600–624), the domino table (x 390–1100, y 560–584), the sand tray (x 720–900, top 420, lip x 720–732, y 380–420), the seesaw's ceiling bracket (x 996–1004, y 60–310), the ledge under the seesaw's right end (x 1150–1240, y 408–428), and the two rope anchor hooks at (640,60) and (860,60). Bodies are invisible rectangles in code, and this layer is what the child sees. | static | Code-drawn wood rectangles (palette brown) |
| `part-ball` (**reuse**) | existing | drawn at 68×68 (body r 34) | body centre | Red ball | rotates with the body | existing |
| `part-ramp` (**reuse**) | existing | 240×140 | the existing RAMP_POLY offset (unchanged), socket R1 (200,440), arrives ↘, tap flips | Blue ramp | existing tray/drag/snap tweens; flip = scaleX −1 | existing |
| `ws-domino` | art/mystery-egg/ws-domino.webp | 28×114 | body centre (the body is 20×110). Placed and fixed dominoes stand at y 505 on the table; slots 460/500/580/620; fixed at 400, 540, 700, 780, 860, 940 | A narrow cream domino with dots (the same style as `part-domino`, but slim: neighbours are only 40 px apart, so the 48 px-wide `part-domino` would overlap). | rotates with physics as it falls; tray: sway | Reuse `part-domino` squeezed to 28×114, else a drawn cream tile |
| `ws-seesaw` | art/mystery-egg/ws-seesaw.webp | 336×30 | **pivot = image centre** (1000,340); body 320×16, both arms 160; rests ≈ 25° right-end-down on the ledge | A wooden plank lever (the hammer) with a visible pivot bolt in the middle; the right end slightly thicker (the "hammer head"). | rotates with physics | Drawn brown bar + bolt |
| `ws-sandbag` | art/mystery-egg/ws-sandbag.webp | 84×96 | the **body circle** (r 36) centre sits at image (42,56); the tied neck fills the top 20 px; hangs at (860,200) | A burlap sandbag tied at the top (dots/shape only, **no "SABLE" label**, v4 §0.6). | swings and falls with physics; lands with a squash tween (scaleY 0.85 → 1, 150 ms) | Drawn tan sack |
| `ws-lantern` | art/mystery-egg/ws-lantern.webp | 56×76 | the body circle (r 24) centre sits at image (28,44); the hook ring at the top; hangs at (640,220) (decoy) | A small street lantern, warm glow. | swings and falls with physics; a soft glow pulse (alpha 0.8 ↔ 1, 1.6 s) while it hangs | Drawn lantern box + glow |
| `ws-rope` | art/mystery-egg/ws-rope.webp | 10×64 (manifest `h` = the tile; see §7.1) | **10×64 seamless vertical tile** (file 20×128); top-centre anchor; the code **tiles/crops it (TileSprite), never scaleY**. Ropes end at the image top of the hung object: **A 84 px (y 60→144), B 116 px (y 60→176)**, morning bell rope 60→bell image top | A vertical twisted rope, seamless tile. | after the snip: the top stub stays (tween shrink to 30 px), the bottom piece falls with the object | Code line, 4 px brown |
| `ws-scissors` | art/mystery-egg/ws-scissors.webp | 96×64 | centre; on a string socket the blades straddle the rope at **y 110 (the TOP of the rope, under the ceiling)**, never over the sack (fixes the mockup mismatch) | Kid-safe rounded scissors, open, grey blades, dark handles (as in the mockup tray). | tray sway; snap tween; snip = the strip below or, if missing, a scaleX squeeze (1 → 0.6 → 1, 160 ms) | Drawn X shape with two rings |
| `ws-string-socket` | none (code-only) | — | dashed circle r 26 at (640,110) and (860,110) | Socket marker | pulse | Code only, like the existing slot glow |
| `part-bell` (**reuse**) | existing | 96×110 | Coco's bell at (1050,470) (sensor r 44) | The small golden bell | ring shake ±14° (existing) | existing |
| `ws-bell-morning` | art/mystery-egg/ws-bell-morning.webp | 150×170 | the **bell body centre (sensor r 44) = image centre** (1150,230); the hook ring inside the **top 28 px**; swing origin **(0.5, 0.08)** (hook), offset so the body sits on the sensor at rest; the code draws `ws-rope` up to the ceiling | The **big town morning bell**: bronze, bigger and deeper-looking than `part-bell`. | ring: swing ±18° about the top hook, 3 swings 1.2 s, plus a sound-ring tween (2 expanding arcs) | Drawn bronze bell |
| `ws-window-frame` | art/mystery-egg/ws-window-frame.webp | **110×110** | centre at each window spot (§2.1), drawn **in front of** the sleeper | A house window frame with an open centre (transparent) and little open shutters on the sides. | static | Drawn frame |
| `ws-egg-piece` | art/mystery-egg/ws-egg-piece.webp | 110×110 | centre | **The end-of-world egg piece**, separate from the feather (v4 §0.8). Proposal: a glowing golden ribbon/star charm for the nest. Gemini picks the object and Maor confirms. | flies from the morning bell to the nest (arc, spin 720°, scale 1.2 → 0.6, 1.1 s, the same motion as the feather) | Drawn gold star |
| `egg-nest-N` (**reuse**) | existing | drawn at 0.35 (126×105) | **centre (380,98)**, scale 0.35 (centre anchor) | The nest + egg at the current glow | glow + wiggle on the win (existing tweens) | existing |
| `capybara` (**reuse**) | existing | drawn at 0.6 (132×168) | feet on the floor, centre (120,616) | The capybara | idle bob | existing |
| `ws-capybara-facepalm` (**optional**) | art/mystery-egg/ws-capybara-facepalm.webp | 220×280 (the same frame as `capybara`) | same as capybara | Optional for L20 (v4 uses it in L19): paw over eyes. | shown 1.5 s, then back to idle | Tween: capybara squash + tilt |
| `ws-capybara-ring` | art/mystery-egg/ws-capybara-ring.webp | 220×280 | same | Failure mime: "rings an imaginary bell" (raised paw, shaking, eyes closed, mouth "ding"). | shake tween ±8°, 4×, then idle | Tween on `capybara` |
| `ws-capybara-cheer` | art/mystery-egg/ws-capybara-cheer.webp | 220×280 | same | Win: arms up (like the mockup's solved frame). | hop tween | Tween hop on `capybara` |

### 2.1 Window sleepers (six friends, each with an asleep and an awake still = 12 images)

Window spots (AGREED; centre, world px; frames 110×110, busts 92×92, scenery behind the machines, all inside y 140–380): moustache (300,195), bruno (460,195), pip (760,195), grandpere (300,325), cocopom (460,325), plume (620,325). The code reads them from the level data.

| key | display (file 2x) | depicts |
|---|---|---|
| `ws-sleeper-<id>-asleep` | **92×92 (184×184)**, centre in the window | Head and shoulders in the window, eyes closed, nightcap or blanket, a small "z". Must read as the same character as the bed art of their own arc (Moustache = baker cat with chef hat, as in `cat-asleep`). |
| `ws-sleeper-<id>-awake` | **92×92 (184×184)** | The same framing, eyes open, smiling, **one paw/wing raised to wave**. |

ids: `moustache` (baker cat), `bruno` (postman bear), `plume` (goose teacher), `cocopom` (the twin ducklings together in one window), `pip` (penguin captain), `grandpere` (Grand-père Ours, an old bear with glasses). Placeholders: code-drawn coloured circles with closed/open eyes.

## 3. Animations: frames or tweens

| Moment | How | Asset |
|---|---|---|
| Sleepers breathe while asleep | tween (scaleY 1 → 1.03, 1.4 s yoyo, phase per friend) | `-asleep` stills |
| Mid-run twitch when **one** bell rings (v4 §1.7, cosmetic) | tween (hop 6 px + "z" puff), the stills stay asleep | none new |
| Win "everyone wakes and waves" | **tween-only**: a squash-stretch pop (0.9 → 1.1 → 1), swap asleep → awake at the peak, then a wave = angle tween ±8° (3 cycles), staggered 150 ms per window | `-asleep` / `-awake` stills |
| Failure "friends who woke fall asleep again" (one bell only) | tween: awake swap for 0.8 s, then a slow droop (y +6, scaleY 0.95) and a swap back to asleep | stills |
| Town wakes | crossfade `ws-l20-bg-dawn` → `ws-l20-bg-morning` 1.2 s + confetti (reuse `confetti`) | bgs |
| Scissors snip | **frames** (optional) `ws-scissors-snip`: sprite, **2 frames** 96×64 (open, closed), 12 fps, plays open→closed→open at Play; scaleX squeeze tween fallback | strip |
| Bell rings | tweens (§2) | — |
| Egg glow + wiggle, piece flies to the nest | existing tweens (feather motion) | `ws-egg-piece` |
| Dominoes, seesaw, sandbag, lantern, ball | physics only | — |
| Optional later | `ws-sleeper-<id>-wake` strips (4 frames, 8 fps) can replace the swap tween with **no code change** (the code checks the manifest); **not required for L20** | — |

## 4. SFX (all new unless marked reuse)

| key | duration | when | placeholder |
|---|---|---|---|
| `sfx-ball-roll` (**reuse**) | — | Play (the trapdoor opens) | existing |
| `sfx-ws-trapdoor` (**optional**) | ≈ 0.15 s wood click | the chute opens at Play | synth click / skip |
| `sfx-ws-snip` | ≈ 0.25 s | scissors cut at Play | synth click pair |
| `sfx-ws-rope-swish` | ≈ 0.3 s | the cut rope piece falls (optional) | none |
| `sfx-ws-domino-clack` | ≈ 0.12 s, dry wood tick | every domino that tips (`domino:<id>:fallen`); the code varies the pitch ±8% so the row sounds like a cascade | synth tick |
| `sfx-ws-sandbag-thump` | ≈ 0.4 s, soft heavy thud | the sandbag hits the seesaw (the catapult) | synth low thump |
| `sfx-ws-seesaw-creak` | ≈ 0.4 s | the seesaw swings up | none |
| `sfx-bell` (**reuse**) | ≈ 1 s | Coco's bell (the small bell) | existing |
| `sfx-ws-bell-morning` | ≈ 2.0 s, deep warm "dong" with a tail | the morning bell | synth low sine ring |
| `sfx-ws-lantern-clonk` | ≈ 0.4 s, light metal clonk | the lantern hits the floor (wrong string) | synth tick |
| `sfx-ws-town-wake` | ≈ 2.5 s, a morning flourish (birds, shutters opening, a little "ta-da") | the win, with the crossfade | `sfx-success` |
| `sfx-ws-yawn` | ≈ 1 s, a cute yawn chorus | friends wake and fall asleep again (failure) | none |
| `sfx-ws-snore` | ≈ 1.2 s, soft, loopable | ambient while asleep (low volume, stops on the win) | none |
| `sfx-pop` (**reuse**) | — | a part snaps; confetti | existing |
| `sfx-success` (**reuse**) | — | 0.6 s after the second bell | existing |

No buzzer or "wrong" sound (v4 §1.8): the failure is told through the yawn, the capybara mime and the hint voice.

## 5. VO lines

Proposed lines. The French lines follow v4 §1.6 (gags and story in French); the Hebrew lines are Bip's hints, feminine singular. "New" means Gemini records it.

| key | lang | speaker | when | transcript (proposed) | status |
|---|---|---|---|---|---|
| `vo-fr-ws-l20-story` | fr | Lumi (hero) | level intro | « Toute la ville dort encore ! Il faut sonner les deux cloches ! » | **new** |
| `vo-he-ws-l20-goal` | he | Bip | ear button, any time; the 2nd failed run (goal hint, never the solution) | « בואי נעיר את כל העיר! צריך לצלצל בשני הפעמונים, les cloches: בפעמון הקטן וגם בפעמון הגדול. » | **new** |
| `vo-he-ws-dominoes-gap` | he | Bip | hint when the domino row stopped (from the v4 L5 kid rule "no big hole") | « בשורת הדומינו אסור שיהיה חור גדול. » | **new**, reused by L5 |
| `vo-he-ws-scissors-which` | he | Bip | hint when the morning bell did not ring | « איזה חוט מחזיק את השק? את החוט הזה גוזרים, עם המספריים. » | **new**, reused by L13/L15 |
| `vo-he-robot-help-2` (**reuse**) | he | Bip | rung 3, the glowing socket (ramp) | « שימי את הרמפה במקום שזוהר. » | existing |
| `vo-he-robot-breathe` (**reuse**) | he | Bip | after 3 failed runs | « קחי נשימה, תחשבי, ותנסי שוב! » | existing |
| `vo-fr-robot-regarde` (**reuse**) | fr | Bip | break-point marker shown | « Regarde ici ! » | existing |
| `vo-fr-robot-aide` (**reuse**) | fr | Bip | rung 5 (Bip places one part; allowed in L20) | « Je t'aide un peu ! » | existing |
| `vo-fr-presque` (**reuse**) | fr | Lumi | failure with exactly one bell rung | « Presque ! » | existing |
| `vo-fr-ws-l20-one-bell` | fr | **Moustache** (Algieba voice; name-free line) | failure, one bell only (gag) | « Mmm… encore une cloche… Zzz… » | **new** |
| `vo-fr-ws-l20-bonjour` | fr | everyone (chorus: **one layered clip**) | the win, as the windows wake (v4 §L20 reaction) | « Bonjour, Ville des Surprises ! » | **new** (the text is from the v4 spec) |
| `vo-fr-ws-l20-success` | fr | Lumi | after the chorus, as the egg piece flies | « Bravo ! Tu as réveillé toute la ville ! » | **new** (`vo-fr-success` names Moustache, so it can't be reused) |
| `vo-he-ws-egg-piece` | he | **Bip** | the piece lands in the nest (optional) | « חתיכה חדשה לקן של הביצה! » | **new, optional** |

Hebrew check: בואי / שימי / קחי / תחשבי / תנסי are feminine singular; the others are impersonal.

## 6. Open points (resolved or tracked in `docs/PENDING-DECISIONS.md`)

1. Approve a **new manifest file** (`src/content/workshopAssets.json`) rather than growing the pinned 1.1 manifest.
2. **One `ws-l20-fixtures` layer** versus one image per fixture. The layer is simpler and matches the physics exactly when it is painted over the guide; per-part images are reusable in L1–L19. Proposal: the layer for L20 now, and a per-part split when levels 1–19 are built.
3. The window spots and the egg-nest spot (§2.1) are a proposal.
4. What the egg piece is (`ws-egg-piece`): Maor confirms.
5. The French vs Hebrew split follows v4 §1.6. If Maor wants the gag/story lines in Hebrew too, the keys stay the same with `-he-` (for example `vo-he-ws-l20-story`).
6. The stage drawing scale (v4 §6.1, window 0.75) is not decided. All sizes here are world px, so they hold either way.

## 7. Agreed amendments (Gemini, 2026-11-27) and code asks
1. Ropes end at the object image top: A 84 px (60→144), B 116 px (60→176). `ws-rope` = seamless 10×64 tile; TileSprite/crop, never scaleY.
2. `ws-bell-morning`: body centre (sensor) = image centre; hook in the top 28 px; swing origin (0.5, 0.08).
3. Windows 110×110, busts 92×92 at the spots in §2.1; nest centre (380,98) scale 0.35.
4. `ws-scissors-snip`: 2 frames (open, closed), 12 fps.
5. `ws-l20-fixtures`: one 2560×1600 layer composited onto the `l20.cjs` rects.
6. `ws-l20-bg-morning` aligns pixel-for-pixel with dawn.
7. VO: `vo-he-ws-egg-piece` is Bip; `vo-fr-ws-l20-one-bell` is Moustache; `vo-fr-ws-l20-bonjour` is one layered clip.
8. Optional keys (placeholder/skip when missing): `sfx-ws-trapdoor`, `ws-capybara-facepalm`.
Code side (done): both bgs are in the 1x list (`WORKSHOP_ONE_X_ART_IDS`); `sfx-ws-*` joined the sfx union and the synth map (`eggSound.ts`, `placeholderSfx.ts`). Gemini delivers on branch `media/workshop-l20` (off ef95e3d): SFX Fri ~13:00, VO Fri ~15:00, art Sat ~20:00 (Israel).

## 8. New ids (the manifest, 47)

- **Art (28):** `ws-l20-bg-dawn`, `ws-l20-bg-morning`, `ws-l20-fixtures`, `ws-domino`, `ws-seesaw`, `ws-sandbag`, `ws-lantern`, `ws-rope`, `ws-scissors`, `ws-scissors-snip` (sprite, 2 frames, 12 fps), `ws-bell-morning`, `ws-window-frame`, `ws-egg-piece`, `ws-capybara-facepalm` (optional), `ws-capybara-ring`, `ws-capybara-cheer`, and `ws-sleeper-<id>-asleep|awake` for `moustache`, `bruno`, `plume`, `cocopom`, `pip`, `grandpere`.
- **SFX (11):** `sfx-ws-trapdoor` (optional), `sfx-ws-snip`, `sfx-ws-rope-swish`, `sfx-ws-domino-clack`, `sfx-ws-sandbag-thump`, `sfx-ws-seesaw-creak`, `sfx-ws-bell-morning`, `sfx-ws-lantern-clonk`, `sfx-ws-town-wake`, `sfx-ws-yawn`, `sfx-ws-snore`.
- **VO (8):** `vo-fr-ws-l20-story`, `vo-he-ws-l20-goal`, `vo-he-ws-dominoes-gap`, `vo-he-ws-scissors-which`, `vo-fr-ws-l20-one-bell`, `vo-fr-ws-l20-bonjour`, `vo-fr-ws-l20-success`, `vo-he-ws-egg-piece` (optional).
- Code only (no file): `ws-string-socket`. Reused by their existing key: `part-ball`, `part-ramp`, `part-bell`, `egg-nest-N`, `capybara`, `confetti`, `sfx-ball-roll`, `sfx-bell`, `sfx-pop`, `sfx-success`, `vo-he-robot-help-2`, `vo-he-robot-breathe`, `vo-fr-robot-regarde`, `vo-fr-robot-aide`, `vo-fr-presque`.
- Optional keys (`sfx-ws-trapdoor`, `ws-capybara-facepalm`, `vo-he-ws-egg-piece`) are used when present and replaced by a placeholder (synth click, tween, chime) when absent; nothing breaks.
- Note: the rope tile's manifest size is 10×64 (the agreed seamless tile), not the 10×200 of the first proposal (§7.1 wins).
