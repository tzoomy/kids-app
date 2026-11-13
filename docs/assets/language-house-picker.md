# Kitchen Orchestra: Language House picker art

Companion note to the Kitchen Orchestra spec (PR #34) and the picker design (PR #36).

The Language House game picker uses exactly four art asset keys. The real SVGs come from the branch
`art/language-house-picker`, which registers these keys in `src/assets/art/manifest.ts`. Until it lands,
this branch ships a separate placeholder block in `src/ui/picker/pickerAssets.ts`. The keys are deliberately
**not** in `ART_MANIFEST` here, so the two branches do not conflict.

| Key | Used for | Placeholder on this branch |
|---|---|---|
| `picker-card-animal-restaurant` | Picture of the Animal Restaurant card | `public/art/scenes/restaurant/bg-landscape.svg` |
| `picker-card-kitchen-orchestra` | Picture of the Kitchen Orchestra card | `public/art/scenes/kitchen/bg-landscape.svg` |
| `picker-close` | Close button face | CSS shape (round, cream fill) plus a text "x" glyph |
| `picker-bg` | Full-screen backdrop behind the picker panel | `public/art/scenes/restaurant/bg-landscape.svg` |

## Resolution

`resolvePickerAsset(key, manifest = ART_MANIFEST)` looks for the key in the art manifest first and falls back
to the placeholder. Once the art branch is merged, the real entries win automatically.

## Expected merge with `art/language-house-picker`

1. Merge the art branch. It adds the four keys to `ART_MANIFEST` and the SVG files.
2. Nothing in the picker code or tests needs to change: `tests/unit/kitchen-orchestra.picker.test.ts` accepts either the
   placeholder or the real manifest entry, and only fails if a key is registered twice.
3. #40 uses the same keys and sizes (cards 640x800, close 128x128 shown at about 120 CSS px, bg 1280x800, cover in portrait); the layout is sized to them.
4. Optionally delete the `PLACEHOLDERS` block and the fallback branch of `resolvePickerAsset` afterwards.
