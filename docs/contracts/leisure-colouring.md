# Colouring Time: scene contract (Pass 1, TDD step 1)

Audience: Gemini (visual and scene code). Source of truth: `docs/specs/leisure-colouring.md` (approved 2026-11-13, owned by PR #49). If this file and the spec disagree, the spec wins; raise it.

Status: the scene is a stub. The AC tests under `tests/` fail on purpose until the real scene and the real pure logic land. Line art lives on `art/colouring-pages-pass1` @ `476bdcd` (issue #50) and is not in this branch; this PR cherry-picks only `tests/shared/leisureColouringPages.ts`, `tests/e2e/helpers/colouringArtCheck.ts`, and the checker fixtures.

## Where to implement

| Implement here | Notes |
|---|---|
| `src/games/colouring/ColouringScene.ts` | `create`, layout, art (lazy-load `COLOURING_ART_MANIFEST`), taps, palette, tools, leisure tick, voice, hook data. Keep `getColouringInfo` signature. |
| `src/games/colouring/regions.ts` | Replace the `not implemented` bodies. Keep every exported name and signature. Unit tests inject `contains`; runtime uses `Path2D.isPointInPath`. |
| `src/core/colouring/store.ts` | Replace the `not implemented` load/save. Key `kids-app-colouring:<profileId>`, schema `{ v: 1, currentPageId, pages }`. |
| `src/ui/picker/…` | Leisure Corner two-card picker (`game-picker-bubbles`, `game-picker-leisure-colouring`, `game-picker-close`). Opened from `MapScene` when `balanceSec > 0`. Do not jump straight into Bubbles. |
| `src/games/colouring/colouringMotion.ts` | Already has the pure fill-pulse helper. Wire it from the scene; do not add a scale pulse. |

| Do NOT change without a spec change | Why |
|---|---|
| `src/games/colouring/types.ts` | Frozen hook types (`ColouringInfo`). |
| `getColouringInfo` / `seedColouringState` signatures in `src/game/createGame.ts` | Shared hook registry. |
| `tests/e2e/helpers/journey.ts` (`GAME_SCENE`, extra-picker path) | Shared journey helper. Additive changes only. |
| `tests/**/leisure-colouring*` | The acceptance tests. |
| `src/content/games/leisure-colouring.json`, `LeisureColouringContentSchema` | Page list and palettes are frozen. |
| Boot `ART_MANIFEST` / `PreloadScene` | Colouring keys must stay out (AC-34). |

## Identifiers

- Scene key: `ColouringScene`, registered in `src/game/createGame.ts`.
- Opened only from the Leisure Corner picker card `game-picker-leisure-colouring`.
- `AppScreen`: `'colouring'`. `create()` must call `setAppScreen('colouring')`. `isSafeToApplyUpdate('colouring') === false`.
- Journey: `enterWorldByTap(page, profile, 'leisure-corner', 'leisure-colouring')`. The default path (no gameId) still opens Bubbles, so existing tests stay green until the picker is implemented.
- Content: `context.content.colouring` (`LeisureColouringContent`). `earnsLeisure: false`. No adaptive block, no `SkillSession`.
- Art: `src/assets/art/colouringManifest.ts`. Queue it when the scene opens, never from `PreloadScene`.

## Hooks (only with `?e2e=1`; seed or read, never act, never navigate)

```ts
seedColouringState({ pageId, fills? }): void  // writes kids-app-colouring:<profileId> only; implemented
getColouringInfo(): ColouringInfo | null      // scene.getColouringInfo() while ColouringScene is active, else null
```

- `ColouringInfo` is defined in `src/games/colouring/types.ts`. All rectangles (`pageRect`, `regions[].hit`, `tapPoint`) are page CSS px, same space as `getBuildingHit`.
- Tests click `regions[].tapPoint` with a real pointer click. `hit` is the painted bounding box, not an expanded target, and is not a size floor.
- `seedColouringState` runs on the map before the building tap, via `enterWorldByTap(..., { beforeEnter })`. Leisure entry also needs `seedBalanceSec` (the default profile balance is 0).

## Test ids

`hud-back`, `hud-help`, `colouring-countdown`, `colouring-page`, `colouring-undo`, `colouring-clear`, `colouring-prev`, `colouring-next`, `colouring-palette`, `colouring-swatch-<colorId>`, `colouring-end`, `colouring-end-home`, `game-picker-leisure-colouring`, `game-picker-bubbles`, `game-picker-close`.

## regions.ts API (frozen)

```ts
hitTest(x, y, { regions, ageTrack, contains, snapRadiusVu, distance? }): string | null
hitTestableRegions(regions, ageTrack): ColouringRegionDef[]
fillTarget(regionId, regions, ageTrack): string
effectiveColour(regionId, fills, regions): string
```

Rule: region under the finger wins (topmost if several); else nearest within 20 CSS px (in viewBox units as `snapRadiusVu`); else no-op. Age 2 considers only coarse regions.

## Autosave

Key `kids-app-colouring:<profileId>`. Value `{ v: 1, currentPageId, pages: { [pageId]: { [regionId]: colorId } } }`. Do not touch `ProfileState` or `kids-app-state-v2`. A corrupt or unknown-version value, or an unknown region/colour/page id, loads as empty for that part and never throws.

## Not in this step

No gameplay, no picker behaviour, no page SVGs (issue #50), no Pass 2 recordings, no merge to main.
