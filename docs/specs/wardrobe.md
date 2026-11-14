# `wardrobe` — Wardrobe

Status: **draft — pending owner approval**
Pass in progress: **1**

> Written by Claude (logic lead) under the team lead's continuous-development mode (2026-11-14): take reversible defaults, list them as pending owner decisions, and keep building. The idea is owner-approved (`docs/WORLDS.md`, Rewards and creation, Wardrobe, 2026-11-13). The art contract is `docs/contracts/wardrobe-art.md` (PR #72). Every default below still needs Maor's approval; see [Open decisions for the owner](#open-decisions-for-the-owner) and `docs/PENDING-DECISIONS.md`.

## Summary

Hats and accessories that the child earns by finishing rounds in any world dress one of the existing characters (the bear by default) in a Wardrobe screen. The child taps an unlocked item to put it on the character and taps it again to take it off. The outfit is saved per profile. New items unlock automatically after completed rounds, with a short celebration. This is not an adaptive learning game: it has no difficulty levels, no rounds of its own and no leisure earning. There are no purchases, ads or time gates.

## Learning goals

- **Age 2:** cause and effect ("I played, so I got a hat"), tap to dress a character, simple clothing words later (Pass 2 voice).
- **Age 5:** choice and expression; choose a combination of items (one per slot) and keep it as her outfit; a reason to keep playing across worlds.

## World and why

- **World:** none. Wardrobe is a reward area opened from the map HUD, not a world building and not Leisure Corner. Art Studio stays locked in this change.
- **Why:** `docs/WORLDS.md`, Rewards and creation, Wardrobe: a reward on top of leisure-time earning, not a replacement for it.

## Mechanic

**Entry point (Open decision for the owner: default is a map HUD button).** A new button `data-testid="wardrobe-btn"` with the Hebrew label "ארון הבגדים" sits next to the home and balance pills in `renderMapChrome` (`src/ui/hud.ts`). It opens `WardrobeScene`. The HUD back button (`hud-back`) returns to the map.

**Unlocks (Open decision for the owner: pending Maor decision; this is the team-lead-approved default).** A *completed round* is one successful `LearningSession.complete()` in a game, tagged with its world id and game id. Only learning worlds count: `language-house`, `number-garden`, `nature-lab`, `science-world`, `art-studio`. `leisure-corner` rounds never count.

| Item | Ages | Unlock rule |
|---|---|---|
| `flower-clip` | 2, 5 | Starter: unlocked from the start, always. |
| `beanie` | 2, 5 | First completed round in `language-house`. |
| `scarf` | 2, 5 | First completed round in `number-garden`. |
| `party-hat` | 2, 5 | First completed round in `nature-lab`. |
| `hair-bow` | 5 | A completed round in `art-studio`. |
| `sun-hat` | 5 | Completed rounds in 3 different games (game ids) of the same world. Three rounds of one game do not count. |
| `glasses` | 5 | A completed round in `nature-lab` or `science-world`. |
| `crown` | 5 | Every other item offered at age 5 is unlocked (the other 7). |

- Unlocking is **idempotent and permanent**: an unlocked item stays unlocked; recording a round never re-announces an item.
- The age-2 track only ever unlocks the four age-2 items. Progress events that would unlock an age-5-only item are still recorded in the history but unlock nothing at age 2.
- No purchases, ads, countdowns or time gates. The only unlock sources are the starter and completed rounds.
- **Reachability notes for the owner:**
  - `hair-bow` needs `art-studio`, which is locked and has no game yet, so `hair-bow` and therefore `crown` cannot be earned in real play until Art Studio opens. The unit and e2e tests exercise the rules against the world id `art-studio` through seeds; this change does not unlock Art Studio.
  - `sun-hat` needs 3 different games in one world. Today only `language-house` (Animal Restaurant, Kitchen Orchestra, Letter Monster) has 3; Number Garden and Nature Lab have 2 each, Science World 1.

**Offered items.** Items carry `ages` in `src/content/wardrobe/items.json`. Age 2 sees only items whose `ages` include 2; age 5 sees all 8. Items that are offered but locked are shown as locked (greyed, with a lock) and tapping them does nothing. Items not offered for the age are not shown at all.

**Equip rules.** At most one item per slot. `slotOrder` is `[neck, eyes, head, headSide]` and `exclusiveSlots` is `[]`, so `head` and `headSide` can be worn together. Tapping an unlocked item puts it on; tapping an item in the same slot replaces it; tapping the worn item takes it off. A locked item or an item not offered for the age is never equipped. A saved outfit entry that is not offered for the current age is ignored when drawing (it is kept in storage).

**Characters.** Pass 1 shows one character: the bear, fitted by `src/content/wardrobe/anchors.json`. A switch among the fitted kinds (bear, rabbit, cat, dog, panda, lion, chef) is out of scope for Pass 1 (see Open decisions). The layout helper already supports every fitted kind; the chef's `head` anchor is `null`, so a head item is never drawn on the chef (the approved chef hat stays). Habitat animals are not fitted.

**Rendering.** `layoutOutfit` (pure, `src/core/wardrobe/layout.ts`) turns a character kind and the worn items into placements from the art contract: an item is drawn at `anchor − pivot × size`, rotated by `rotate` and scaled by `scale` around its pivot. Draw order is deterministic, back to front: items attached to the body without `layer: "front"` (between body and head); then head-attached items in `slotOrder` (above all head parts: `eyes`, `head`, `headSide`); then `layer: "front"` items (the scarf, above the head group). Each placement carries `band` (`behindHead`, `head` or `front`), `attach`, `left`/`top` (the item's top-left relative to the attach origin), `originX`/`originY` (the pivot in item px, the rotate and scale origin), `scale`, `rotate` and `flipX` (always `false`). `slotAnchor(kind, slot)` returns the anchor or `null` (chef head, unfitted characters), and items without an anchor are skipped. `headSide` anchors are at positive x (screen-right, the same side as the rig's right ear and eye) and are never mirrored in Pass 1.

**Persistence.** `kids-app-wardrobe:<profileId>`, schema `{ v: 1, unlocked: string[], outfit: { <slot>: itemId }, completed: { <worldId>: gameId[] } }`. `completed` is the minimal history needed for `sun-hat` (distinct game ids per world). Profiles never share a key. A missing, corrupt, wrong-version or partly invalid payload falls back field by field to defaults (starter unlocked, empty outfit, no history); unknown item ids and ids in the wrong slot are dropped. The storage driver is injectable (`StorageDriver`) and the model needs no Phaser or DOM.

**Outfit saving.** Every equip or unequip is saved immediately at both ages (this is the "save an outfit" of age 5; for age 2 the same saving is a simplification, see Open decisions).

**Round-completion hook.** `AppContext.recordCompletedRound(worldId, gameId)` is called next to each `session.complete()` in the games. It loads the current profile's wardrobe state, records the round (current age track), saves, plays `SfxPlayer.yay()` and shows the unlock toast when something new unlocked, and returns the ids that unlocked. Implementation session only: edit each game's call site (RestaurantScene, OrchestraScene, HidingScene, SeedFlowerScene, SortingScene, BalloonScene, LetterMonsterScene, PotionScene). `SkillSession` is per trial and does not carry round completion, so it is not used.

**Unlock feedback.** On a new unlock: `SfxPlayer.yay()` plus a short Hebrew toast on top of the current screen, `data-testid="wardrobe-unlock-toast"`, with `data-items="<id>[,<id>]"`. It disappears by itself. No screenshots are needed to test it.

## Leisure

Wardrobe has no leisure earning of its own and never changes the balance. Completed rounds still earn leisure exactly as in their own games. Unlocks never depend on the balance.

## Player journey from the map

Profile → map → tap `wardrobe-btn` → Wardrobe (`WardrobeScene`) → tap items → `hud-back` → map. Handles (frozen at approval):

- No map building hit target: Wardrobe is a HUD button, not a world.
- `data-testid`s: `wardrobe-btn` (map HUD), `wardrobe-item-<itemId>` (one button per offered item; attributes `data-locked="true|false"`, `data-worn="true|false"`), `wardrobe-unlock-toast` (attribute `data-items`), `hud-back`, `switch-profile-btn`, `profile-a`, `profile-b`. Scene key `WardrobeScene`.
- Hooks under `?e2e=1` (seed or read state only; no taps, no navigation):
  - `seedWardrobeState(seed)`: writes the active profile's wardrobe state; `seed` is `{ unlocked?: string[]; outfit?: Partial<Record<slot, itemId>>; completed?: Record<worldId, gameId[]> }`, merged over the defaults (the starter is always kept).
  - `getWardrobeInfo()`: works on the map and in the scene. Returns `{ sceneActive, ageTrack, character, offered, unlocked, worn, rendered, lastUnlock }`: `offered` = item ids shown at this age, `unlocked` and `worn` from the saved state, `rendered` = item ids in draw order, `lastUnlock` = ids unlocked by the latest recorded round in this page session.
  - `recordCompletedRound(worldId, gameId)`: calls the public `AppContext.recordCompletedRound`, the same function the games call (it only records progress; it does not play a game). Returns the newly unlocked ids.
  - The types `WardrobeInfo` and `WardrobeSeed` live in `src/games/wardrobe/wardrobeTypes.ts` (type-only imports by `tests/e2e/helpers/journey.ts`).
- Planned code layout: `src/core/wardrobe/` (`model.ts`, `store.ts`, `layout.ts`; no Phaser), `src/games/wardrobe/` (`WardrobeScene.ts`, `wardrobeTypes.ts`), `src/ui/wardrobeChrome.ts` (item buttons, toast), `AppContext.recordCompletedRound`.

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → map → `wardrobe-btn` → Wardrobe opens with the starter flower-clip unlocked → tap it onto the character → `hud-back` to the map | 1 | e2e | both | `getWardrobeInfo` |
| AC-02 | One item per slot: a second item in the same slot replaces the first; tapping the worn item removes it; head and headSide are worn together; the scarf draws last | 1 | e2e+seed | @single-orientation | `seedWardrobeState`, `getWardrobeInfo` |
| AC-03 | Unlock rules: starter; beanie, scarf, party-hat by world; age-5 hair-bow, sun-hat, glasses, crown; age 2 never gets age-5 items; Leisure Corner ignored; idempotent; offered items per age; equip rules | 1 | unit | @single-orientation | |
| AC-04 | Persistence per profile: unlocks, outfit and history are saved under `kids-app-wardrobe:<profileId>`, never mixed; corrupt, missing or partly invalid payloads fall back to defaults | 1 | unit | @single-orientation | |
| AC-05 | After a completed Language House round (through the public record-round API) beanie is unlocked and wearable for that profile; the other profile is unchanged | 1 | e2e+seed | @single-orientation | `recordCompletedRound`, `getWardrobeInfo` |
| AC-06 | Age 2 sees only age-2 items (age-5-only items are not shown even if seeded as unlocked); age 5 can wear unlocked age-5 items | 1 | e2e+seed | @single-orientation | `seedWardrobeState`, `getWardrobeInfo` |
| AC-07 | Layout helper: draw order, scarf above the head group, headSide at +x without mirroring, anchor and pivot math, chef has no head item | 1 | unit | @single-orientation | |
| AC-08 | Child-facing feedback appears when an item unlocks (one round away, then the completing round) | 1 | e2e+seed | @single-orientation | `seedWardrobeState`, `recordCompletedRound`, `getWardrobeInfo` |
| AC-09 | Smoke: Wardrobe is usable at `1280x800` and `800x1280`; item buttons are at least 64 CSS px and inside the viewport | 1 | e2e+seed | both | `seedWardrobeState` |
| AC-10 | Wardrobe works offline (cached art, saved outfit) | 1 | e2e | @single-orientation | `getWardrobeInfo` |
| AC-11 | Device check: touch, rotation inside the Wardrobe, visuals of every item on the bear | 1 | device | both | |
| AC-12 | No purchases, ads or time gates: only the starter and completed rounds unlock anything; elapsed time unlocks nothing | 1 | unit | @single-orientation | |
| AC-13 | `AppContext.recordCompletedRound(world, gameId)` records for the current profile and age track, persists, plays the yay sound only when something new unlocked, and returns the new ids | 1 | unit | @single-orientation | |

By default, Pass-1 criteria do not require polished animation or new recorded clips (`docs/PROCESS.md` §3).

## Art, animation, and audio

### Pass 1 — working game

- **Art:** the 8 accessory SVGs, `items.json`, `anchors.json` and `wardrobeManifest.ts` from `docs/contracts/wardrobe-art.md` (PR #72) are used as they are; no item id, slot order or SVG changes. The characters use their existing approved art (`public/art/animals/<kind>/`). Wardrobe art loads lazily when the scene opens, never at boot. The scene background is procedural (plain colour).
- **Layout:** landscape and portrait. Item buttons are DOM buttons of at least 64 CSS px (**Decided by the owner (2026-11-13):** minimum 64 CSS px); if they do not fit they wrap or scroll, never shrink. The character stays visible in both orientations.
- **RTL:** Hebrew chrome is RTL; the Wardrobe reuses the existing HUD back button.
- **Animation:** basic only: a `popIn` of the item on the character (`src/anim/motion.ts`), Juice burst on unlock.
- **Character rendering:** only in the Wardrobe in Pass 1. Showing the outfit on map or game characters (a hook in `src/anim/Character.ts`) is out of scope unless it proves cheap in the implementation session; note it in the progress file if done.
- **Voice:** none in Pass 1 (no new lines, no new clips). Unlock feedback is `SfxPlayer.yay()`, a Juice burst and the toast.

### Pass 2 — polish

Only after Maor approves Pass 1: item name voice lines in Hebrew and the learning language ("כובע", "hat"), polished animation, a character switch, outfit shown on the map characters.

## Out of scope

- Purchases, ads, time gates, parent controls for unlocks.
- Character switch (bear only in Pass 1), outfit on other screens, fitting the habitat animals, left-side or mirrored `headSide`.
- Unlocking Art Studio or adding any Art Studio game.
- Spoken item names (Pass 2).

## Open decisions for the owner

- **Open decision for the owner:** the unlock rules in the table above (team-lead-approved default; pending Maor decision): flower-clip free; beanie, scarf, party-hat on the first round in Language House, Number Garden, Nature Lab; hair-bow after an Art Studio round; sun-hat after rounds at 3 different games in one world; glasses after a Nature Lab or Science World round; crown after all the others. To reverse: edit `UNLOCK_RULES` in `src/core/wardrobe/model.ts` and AC-03.
- **Open decision for the owner:** `hair-bow` and `crown` cannot be earned until Art Studio has a game, and `sun-hat` is reachable only in Language House today (see Reachability notes). Default: leave as written.
- **Open decision for the owner:** age-2 and age-5 item subsets and the starter item (`items.json` `ages`, `starter`); see `docs/PENDING-DECISIONS.md` (2026-11-14).
- **Open decision for the owner:** entry point is a map HUD button `wardrobe-btn` "ארון הבגדים" (not a map building, not Leisure Corner). To reverse: remove the button from `renderMapChrome` and open `WardrobeScene` from another place.
- **Open decision for the owner:** one character (bear) in Pass 1, no character switch.
- **Open decision for the owner:** the outfit is saved at both ages on every change (age 5 "saves an outfit"; for age 2 saving is harmless).
- **Open decision for the owner:** an unlock celebrates with `SfxPlayer.yay()` and a Hebrew toast, with no spoken line.
- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).

## Changelog

- `2026-11-14` — created (draft, Pass 1, tests-first) — substantive
