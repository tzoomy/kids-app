# Wardrobe accessory art contract

Status: **draft — pending owner approval**. **Open decision for the owner:** this contract (slots, anchors, and the first 8 items). It is also pending alignment with Claude, who owns the Wardrobe logic (`docs/WORLDS.md`, Rewards and creation, Wardrobe). Nothing in the game reads these files yet.

## Files

- `public/art/wardrobe/<itemId>.svg`: one accessory per file, as a separate layer. It is never baked into a character.
- `src/content/wardrobe/items.json`:
  - Root fields:
    - `version: 1`
    - `slotOrder: ["neck", "eyes", "head", "headSide"]`: deterministic draw/layer order, back to front, within a layer. `headSide` is drawn above `head`, so a bow on a hat brim stays visible.
    - `exclusiveSlots: []`: array of slot pairs/tuples that mutually exclude each other. An empty array means only same-slot items exclude each other. A pair like `["head", "headSide"]` can be added without code change. Currently `head` and `headSide` coexist (e.g. wearing sun-hat or crown together with a bow is allowed even if the bow is partly hidden).
    - `items`: array of wardrobe items.
  - Item fields:
    - `id`: unique item identifier. Item ids are the persisted unlock-state keys; never rename an id.
    - `slot`: `head`, `eyes`, `neck`, or `headSide`.
    - `url`: asset path, e.g. `art/wardrobe/<itemId>.svg`.
    - `width`, `height`: item dimensions in viewBox units.
    - `pivot: { x, y }`: point of the item (0–1 of its width and height) that is placed on the anchor.
    - `ages`: array of age groups, non-empty subset of `[2, 5]`. (Pending Maor decision; defaults: `party-hat`, `beanie`, `scarf`, `flower-clip` are `[2, 5]`; `crown`, `glasses`, `sun-hat`, `hair-bow` are `[5]`).
    - `starter?: boolean`: `true` on exactly one item, `flower-clip`, which is available at age 2. (Pending Maor decision).
  - Unlock rules remain out of the art files (logic PR / spec).
- `src/content/wardrobe/anchors.json`: `{ version: 1, characters: { <kind>: { rig, slots: { head, eyes, neck, headSide } } } }`. Each slot is `{ attach, x, y, scale, rotate, layer? }` or `null` when that character cannot wear that slot.
  - `attach: "head"`: the origin is the rig's head pivot (`parts.head.x/y` in `src/assets/art/rigs.ts`). The item moves and rotates with the head.
  - `attach: "body"`: the origin is the feet centre, like rig part `x/y`.
  - Units are rig reference px (a character is 480 tall). An item is drawn at `anchor − pivot × size`, then rotated by `rotate` and scaled by `scale` around its pivot.
  - Draw order is now data: `slotOrder` (`["neck", "eyes", "head", "headSide"]`). `headSide` is above `head`.
    - Head items draw above all head parts.
    - Body items draw between the body and the head, unless `layer: "front"`, in which case they draw above the head group (the scarf over the chin line).
  - Anchor notes:
    - `headSide`: every character's `headSide.x` is positive (64 to 76) with `rotate: 15`, on the same side as the rig's ear-right / eyeR (positive x = screen-right of the viewer). There is no left-side `headSide` anchor and no mirroring in Pass 1.
    - `scarf` / `neck`: every character's `neck` slot has `attach: "body"` (origin at the feet centre), not the head pivot, so the scarf does not follow head tilt or bob. `neck` also has `layer: "front"`, so it draws above the head group (over the chin line).
    - Hats (`head` slot) draw over the ears. Rabbit and cat ears poke out beside the `party-hat` and `crown`; that is the intended look, not a bug for the logic layer to "fix".
- `src/assets/art/wardrobeManifest.ts`: lazy keys `wardrobe-<itemId>`, exports `WARDROBE_ITEMS`, `WARDROBE_SLOT_ORDER`, `WARDROBE_EXCLUSIVE_SLOTS`, `WARDROBE_ART_MANIFEST`. They are not in the boot `ART_MANIFEST`.

## Slots and items (Pass 1)

| Slot | Items |
|---|---|
| `head` | `party-hat`, `sun-hat`, `crown`, `beanie` |
| `eyes` | `glasses` |
| `neck` | `scarf` |
| `headSide` | `hair-bow`, `flower-clip` |

There is no chef hat: the approved chef already wears one, so `chef.slots.head` is `null`.

## Characters

These are the existing approved characters only, unchanged: `bear`, `rabbit`, `cat`, `dog`, `panda`, `lion` (`public/art/animals/<kind>/`) and `chef` (`public/art/characters/chef/`). The habitat animals (`bird`, `frog`, `bee`, `owl`) are not fitted yet.

## Preview

`node tools/art-preview/shoot-wardrobe.mjs bear,rabbit,cat,dog,panda,lion,chef` serves `tools/art-preview/wardrobe.html` and writes `tools/art-preview/shots/wardrobe-sheet.png`, plus one large row per character.

## Open points (pending Maor decision / pending Claude alignment)

1. The slot names and the anchor format above, or Claude's own API if it differs. The art layers do not depend on the format.
2. Which progress unlocks which item. This is already an open owner decision in `docs/WORLDS.md`.
3. Whether the habitat animals also get anchors (default: not yet).
4. Mutual exclusion: one item per slot (default). A hat and a hair bow may be worn together. Resolved as data: `exclusiveSlots` is `[]` (empty list = only same-slot items exclude each other; multi-slot exclusions can be added without code change).
5. Age 2 vs age 5 item subsets (`ages` in `items.json`) and single starter item (`starter: true` on `flower-clip`) are pending Maor decision.
