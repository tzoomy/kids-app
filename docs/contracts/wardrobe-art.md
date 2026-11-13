# Wardrobe accessory art contract

Status: **draft — pending owner approval**. **Open decision for the owner:** this contract (slots, anchors, and the first 8 items). It is also pending alignment with Claude, who owns the Wardrobe logic (`docs/WORLDS.md`, Rewards and creation, Wardrobe). Nothing in the game reads these files yet.

## Files

- `public/art/wardrobe/<itemId>.svg`: one accessory per file, as a separate layer. It is never baked into a character.
- `src/content/wardrobe/items.json`: `{ version: 1, items: [{ id, slot, url, width, height, pivot: { x, y } }] }`. `pivot` is the point of the item (0–1 of its width and height) that is placed on the anchor.
- `src/content/wardrobe/anchors.json`: `{ version: 1, characters: { <kind>: { rig, slots: { head, eyes, neck, headSide } } } }`. Each slot is `{ attach, x, y, scale, rotate, layer? }` or `null` when that character cannot wear that slot.
  - `attach: "head"`: the origin is the rig's head pivot (`parts.head.x/y` in `src/assets/art/rigs.ts`). The item moves and rotates with the head.
  - `attach: "body"`: the origin is the feet centre, like rig part `x/y`.
  - Units are rig reference px (a character is 480 tall). An item is drawn at `anchor − pivot × size`, then rotated by `rotate` and scaled by `scale` around its pivot.
  - Draw order:
    - Head items draw above all head parts.
    - Body items draw between the body and the head, unless `layer: "front"`, in which case they draw above the head (the scarf over the chin line).
- `src/assets/art/wardrobeManifest.ts`: lazy keys `wardrobe-<itemId>`. They are not in the boot `ART_MANIFEST`.

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
4. Mutual exclusion: one item per slot (default). A hat and a hair bow may be worn together.
