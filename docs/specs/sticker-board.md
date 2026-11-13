# `sticker-board` — Sticker Board (`לוח מדבקות`)

Status: **draft — pending owner approval**
Pass in progress: **1**

**Basic-first rule (applies to this spec).** Pass 1 is a working game with basic animation and device TTS only (`docs/PROCESS.md` §3). No item in this spec needs an override.

**Origin.** Owner-approved idea 11 of 2026-11-13 ("Sticker Board and Finger Drawing", `docs/WORLDS.md`, Art Studio game 4). Written under the team lead's continuous-development mode: open points take a reversible default and are listed under [Open decisions for the owner](#open-decisions-for-the-owner) and in `docs/PENDING-DECISIONS.md`.

## Summary

A free creation board in the Art Studio. The child picks a background (space, jungle, or beach), taps a sticker in the tray to put it on the board, drags stickers around, and draws on the board with a finger in a few crayon colours. There is no wrong answer. At age 5 an optional request appears in the learning language ("Put the rocket in space!"), and she can save the board to a local album and reopen it later.

## Learning goals

- **Age 2:** Expression and fine motor skills: tap to add, drag to move, finger drawing. Cause and effect. No task.
- **Age 5:** The same, plus choice and secondary vocabulary: an optional spoken request in English or French names a sticker and a place, and a saved album of her boards.

## World and why

- **World:** Art Studio (`art-studio`, `סטודיו האמנות`). `docs/WORLDS.md` lists Sticker Board and Finger Drawing as Art Studio game 4.
- The Art Studio building opens the Sticker Board directly (it is the studio's only game for now): `worlds.json` sets `art-studio` to `status: "open"`, `entryGameId: "sticker-board"`. **Open decision for the owner:** opening the Art Studio building on the map with this game (default: open, direct entry, no picker).

## Mechanic

Round-free play; she stays until she taps `hud-back`.

- **Backgrounds.** Three backgrounds: `space`, `jungle`, `beach` (buttons `sticker-bg-<id>`). Changing the background keeps the stickers and the drawing (it is one board). Default `space`.
- **Stickers.** A tray of 12 stickers (`sticker-tray-<stickerId>`), 4 per theme: space (`rocket`, `planet`, `moon`, `star`), jungle (`palm-tree`, `banana`, `leaf`, `flower`), beach (`shell`, `starfish`, `umbrella`, `ball`). All 12 are offered on every background. Tapping a tray sticker places it on the board at the next free slot of a fixed slot grid (deterministic, no random), with a pop-in. At most **30** stickers on the board; a 31st drops the oldest.
- **Drag.** A press that starts on a placed sticker (topmost wins) drags it; the sticker stays inside the board and comes to the top. Moves under 8 CSS px count as a tap (no move).
- **Finger drawing.** A press that starts on the board but not on a sticker draws a stroke in the selected crayon colour (`sticker-crayon-<colorId>`, one is always selected, default `red`). Age 2 has 4 colours (red, yellow, blue, green); age 5 has 8 (plus purple, orange, brown, white). Stroke width 14 board px (age 2: 18). A tap without movement leaves a dot. Caps: 80 strokes (the oldest drops) and 400 points per stroke (later points are ignored).
- **Undo** (`sticker-undo`) reverts the last add, move, stroke, clear, or album load; in-memory, cap 30, disabled when empty. **Clear** (`sticker-clear`) removes every sticker and stroke in one undoable step, no confirm.
- **No wrong path.** No score, no stars, no failure sound.
- **Age 5 request (optional).** A request bubble (`sticker-request`) shows the sticker's picture and is spoken once by device TTS in the learning language. The request names a sticker of the current background's theme and that place. It is met when that sticker is placed (tap from the tray or dropped after a drag) while that background is shown. Then a sparkle, the praise line, and a new request after about 1.5 s. Ignoring the request has no effect. The toggle `sticker-request-toggle` turns requests off and on (on by default at age 5). Age 2 has no requests.
- **Language.** `settings.languages` `en` or `fr` uses that language; `both` alternates per request, starting with English.
- **Save and album (age 5).** `sticker-save` stores a copy of the board in the album (newest first, cap 12, the oldest drops) with a sparkle and a short Hebrew line. `sticker-album` opens the album view (`sticker-album-view`) with thumbnails (`sticker-album-item-<index>`) and a close button (`sticker-album-close`). Tapping a thumbnail loads that board onto the board (one undoable step) and closes the view. Age 2 has neither button; her board still autosaves.

## Difficulty curve

None. There is no adaptive engine and no skill key: this is free creation. Age differences are fixed (above).

## Leisure

The content JSON carries the Art Studio content mark `earnsLeisure`. When `true` and time earning is enabled, the scene runs a `LearningSession` (taps, drags, and strokes report interaction) and earns; when `false`, the scene neither earns nor spends. It never spends leisure (Art Studio is not the Leisure Corner). **Open decision for the owner:** default `earnsLeisure: false` for this free-creation board.

## Persistence

Separate `localStorage` key per profile: `kids-app-stickers:<profileId>`, schema `{ v: 1, current: Board, album: Board[] }`, `Board = { backgroundId, stickers: [{ stickerId, x, y }], strokes: [{ colorId, points: number[] }] }`. Coordinates are normalised to the board (0–1, flat `[x0, y0, x1, y1, …]` for points). Saved on every change and on exit. Loading is defensive (bad JSON, wrong `v`, unknown ids, out-of-range numbers are dropped, never throws). No change to `ProfileState` or `kids-app-state-v2`.

## Player journey from the map

Profile → Art Studio building → `StickerBoardScene` → add, drag, draw (age 5: request, save, album) → `hud-back` → map (iris transition both ways).

## Voice (Pass 1, device TTS only)

| Line id | Lang | Text |
|---|---|---|
| `sticker-board.intro.he` | he | `לוח מדבקות! בחרי מדבקה, ואפשר גם לצייר באצבע.` |
| `sticker-board.help.he` | he | `לחצי על מדבקה כדי לשים אותה על הלוח, וגררי אותה למקום. גררי אצבע על הלוח כדי לצייר.` |
| `sticker-board.praise.he` | he | `כל הכבוד!` |
| `sticker-board.saved.he` | he | `שמרנו באלבום!` |
| `sticker-board.request.<stickerId>.<lang>` | en / fr | `Put the rocket in space!` / `Mets la fusée dans l'espace !` (per sticker and theme, see `src/games/stickers/voice.ts`) |

## Test hooks (`?e2e=1`)

- `getStickerBoardInfo()` → `StickerBoardInfo | null` (`src/games/stickers/types.ts`): age track, background, placed stickers with page-CSS-px centres, stroke count and points, selected colour, request, met-request count, album count, board rect, `earnsLeisure`.
- `seedStickerBoardState(seed)` writes the save key only (call on the map, before entering).
- `getBuildingHit('art-studio')` (existing).
- `goToScreen('stickers')` for screenshot scripts only.

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Art Studio building → Sticker Board → tap a tray sticker (it appears on the board) → `hud-back` → map | 1 | e2e | both | `getBuildingHit`, `getStickerBoardInfo` |
| AC-02 | Tapping a tray sticker places it at the next free slot inside the board; the 31st sticker drops the oldest | 1 | unit | @single-orientation | |
| AC-03 | A drag that starts on a placed sticker moves it (clamped to the board, brought to the top); a move under 8 CSS px is a tap | 1 | unit, e2e | @single-orientation | `getStickerBoardInfo` |
| AC-04 | A drag that starts on empty board draws a stroke in the selected crayon colour; caps 80 strokes and 400 points per stroke | 1 | unit, e2e | @single-orientation | `getStickerBoardInfo` |
| AC-05 | Crayon palette per age: 4 colours at age 2, 8 at age 5; one is always selected (`aria-pressed`) | 1 | unit, e2e | @single-orientation | `getStickerBoardInfo` |
| AC-06 | Background buttons switch between space, jungle, and beach and keep the stickers and strokes | 1 | e2e | @single-orientation | `getStickerBoardInfo` |
| AC-07 | Undo reverts the last add, move, stroke, clear, or album load (cap 30, disabled when empty); clear empties the board in one undoable step | 1 | unit | @single-orientation | |
| AC-08 | Age 5 request: names a sticker of the current theme in the learning language (`both` alternates, starting with English), is met only by placing that sticker on that background, then praise and a new request; ignoring it changes nothing | 1 | unit | @single-orientation | |
| AC-09 | Age 5 request is spoken through the speech spy with the request line id and language, and placing the named sticker by real taps counts it as met | 1 | e2e | @single-orientation | `getStickerBoardInfo`, `getSpokenLines` |
| AC-10 | Age 2 has no request, no save and no album button | 1 | e2e | @single-orientation | `getStickerBoardInfo` |
| AC-11 | Age 5 save adds the board to the album (newest first, cap 12); the album view lists it and tapping a thumbnail loads it | 1 | unit, e2e | @single-orientation | `getStickerBoardInfo` |
| AC-12 | Autosave per profile under `kids-app-stickers:<profileId>`; a reload restores the board; loading is defensive and profiles are isolated | 1 | unit, e2e | @single-orientation | `getStickerBoardInfo`, `seedStickerBoardState` |
| AC-13 | Leisure follows the content mark: `earnsLeisure: false` neither earns nor spends; `true` earns through `LearningSession` only while time earning is enabled; never spends | 1 | unit | @single-orientation | |
| AC-14 | Content and art contract: the content JSON validates; every sticker and background has a manifest key and an SVG under 15 KB with no `<text>`, rasters, or external references | 1 | unit | @single-orientation | |
| AC-15 | Every tray, crayon, background, and tool button is at least 64 CSS px in both orientations | 1 | e2e | both | `getStickerBoardInfo` |
| AC-16 | Touch, rotation, audible voice, and visuals on the tablet | 1 | device | both | |

## Art, animation, and audio

- Stickers: `public/art/stickers/{rocket,planet,moon,palm-tree,shell,starfish}.svg` (new, 256×256, drawn with `agy` `gemini-4-hydrogen-medium`), plus reused `fx/star.svg`, `foods/banana.svg`, `props/clue-icon-leaf.svg`, `flowers/bloom-tulip-red.svg`, `items/umbrella.svg`, `items/ball.svg`.
- Backgrounds: `public/art/scenes/sticker-board/<theme>-{landscape,portrait}.svg` (new).
- Manifest: `src/assets/art/stickerBoardManifest.ts`, keys `sticker-<stickerId>` and `sticker-board-bg-<theme>-<orientation>`, loaded when the scene opens (not at boot).
- Motion: existing helpers only (`popIn`, `pressSquash`, the sparkle fx), with reduced motion respected.
- No characters. No new recordings.

## Out of scope

Pass 2 polish, recorded clips, stamps and brushes beyond one round crayon, an eraser, sharing or exporting images, animal or character stickers.

## Open decisions for the owner

1. **Open decision for the owner:** open the Art Studio building with Sticker Board as its direct entry game (default: yes).
2. **Open decision for the owner:** `earnsLeisure` mark for Sticker Board (default: `false`, neither earns nor spends).
3. **Open decision for the owner:** request language: requests are fully in the learning language (EN/FR) with a picture; the Hebrew narrator only praises (default as written).

## Changelog

- 2026-11-13: first draft with the Pass 1 implementation (Gemini expert, continuous-development mode).
