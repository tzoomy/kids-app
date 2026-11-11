# P1 art and animation contract (Animal Restaurant polish)

Status: working contract for branch `feat/p1-restaurant-polish`. Owner feedback on P0: "the animation is terrible". Goal: the Animal Restaurant should feel like a polished kids game (Sago Mini / Lingokids quality bar) while staying smooth (60 fps target) on a mid-range Android tablet. All art is original.

## Who owns which files (do not edit the other owner's files on this branch)

| Area | Owner | Paths |
|---|---|---|
| Vector art (SVG parts, foods, plates, scene, FX sprites) and the rig data | Gemini (agy) | `public/art/**`, `src/assets/art/**` |
| Animation system, character state machine, scene transitions, asset loading, restaurant scene integration | Claude Code | `src/anim/**`, `src/games/restaurant/**`, `src/game/**`, `src/worlds/**`, `tests/**` (non-audio) |
| Voice (Gemini TTS, Leda), audio manifest, offline caching | Grok Bot | `src/core/audio/**`, `src/content/audio-manifest.json`, `public/audio/**`, `scripts/tts/**`, `vite.config.ts`, `tests/unit/audio*` |

If you need a change in someone else's area, write it in your final report (or a GitHub issue comment) instead of editing.

## Art pipeline

- Art is layered SVG, one file per animatable part, under `public/art/`. Phaser loads each SVG with `this.load.svg(key, url, { width, height })` in a preload step, so it rasterizes once at the needed size (crisp, cheap at runtime). Do not draw characters with runtime `Graphics` any more.
- Style: soft rounded shapes, warm cohesive palette, a consistent dark-brown outline (about 6 px at reference size, not pure black), simple soft shading (one lighter highlight shape and one darker shadow shape per major part, no heavy gradients or filters, no `<text>`, no external references, no embedded raster images). Big friendly eyes with a highlight. Readable silhouettes at tablet distance.
- Keep each SVG small (aim < 6 KB, hard cap 15 KB) — they are precached for offline.

### Animals

Kinds: `bear`, `rabbit`, `cat`, `dog`, `panda`, `lion`.

Reference size: the full character is designed on a 400 x 480 coordinate space (origin = feet center at (200, 470)). Each part is its own SVG whose `viewBox` is the tight bounding box of that part, in the same units (1 unit = 1 px at reference size).

Files per kind, `public/art/animals/{kind}/`:

| File | Notes |
|---|---|
| `body.svg` | torso, legs, arms (paws), belly patch |
| `tail.svg` | optional (omit for kinds without a visible tail) — drawn behind body |
| `head.svg` | head base including muzzle and cheeks/blush, without eyes and mouth (lion: include mane here, or a separate `mane.svg` behind the head) |
| `ear-left.svg`, `ear-right.svg` | separate so they can wiggle; drawn behind or in front of head per rig data |
| `eye-open.svg`, `eye-closed.svg` | one eye; the right eye reuses it (optionally flipped) |
| `mouth-smile.svg`, `mouth-open.svg`, `mouth-hmm.svg` | swapped by state: idle/happy, talking/munching, gentle "hmm" on a wrong answer (never sad or scary) |

Rig data: `src/assets/art/rigs.ts` exports

```ts
export interface RigPart {
  key: string;          // file name without .svg, e.g. "ear-left"
  x: number; y: number; // position of the part's pivot, relative to the character origin (feet center), reference px
  originX: number; originY: number; // pivot inside the part, 0..1 (e.g. ear base, tail base, head neck)
  width: number; height: number;    // rasterize size at reference scale (matches the viewBox)
  depth: number;        // draw order, lower is further back
  parent?: 'body' | 'head'; // head-attached parts move with the head
  flipX?: boolean;      // for the reused right eye
}
export interface AnimalRig {
  kind: string;
  height: number;       // reference full height (480)
  parts: Record<string, RigPart>; // ids: body, tail?, mane?, head, earL, earR, eyeL, eyeR, mouth
  eyeClosedKey: string; mouthKeys: { smile: string; open: string; hmm: string };
}
export const ANIMAL_RIGS: Record<string, AnimalRig>;
export const ANIMAL_ART_KINDS: string[];
```

### Foods, plates, scene, FX

- Foods: `public/art/foods/{id}.svg`, 256 x 256, centered, for ids `apple banana carrot grapes cheese strawberry broccoli cookie egg pear orange fish` (same ids as `src/content/games/animal-restaurant.json`; `color`/`shape` there stay as metadata).
- Plate: `public/art/props/plate.svg` (wide oval plate seen from a slight top angle, 320 x 140) and `plate-shadow.svg`.
- Restaurant scene layers in `public/art/scenes/restaurant/`: `bg-landscape.svg` (1280 x 800) and `bg-portrait.svg` (800 x 1280) — wall, window, warm lights; `counter.svg` (a wide counter/table front the animal stands behind, sized to the scene width) — so the animal can stand "behind the counter" and plates sit on it. Keep the backgrounds calm and lower-contrast than characters and plates.
- FX: `public/art/fx/star.svg`, `sparkle.svg`, `heart.svg`, `crumb.svg` (small, 64 x 64).
- `src/assets/art/manifest.ts` exports the list of every SVG with key, url (relative, no leading slash, e.g. `art/foods/apple.svg`), width and height, so the loader can preload them.

## Animation system (Claude)

- `src/anim/`: tween/timeline helpers (squash-and-stretch, pop-in, bounce, wobble, shake-soft), a particle/juice helper using the FX sprites, a scene-transition helper (soft iris/fade/slide, under 400 ms), and a `Character` built from an `AnimalRig` with a small state machine: `enter`, `idle` (breathing, blink every 2–5 s, occasional ear/tail wiggle), `talking` (mouth flaps while the voice line plays), `happy` (bounce + squash-and-stretch + hearts), `munch` (food flies to mouth, chew loop, crumbs), `hmm` (gentle head tilt, `mouth-hmm`, no shake of the whole body, never punishing), `exit`.
- Animation amplitudes/durations live in one tunable data object (`src/anim/profiles.ts`) so design can tune feel without touching logic.
- Performance: rasterized SVG textures, no per-frame Graphics redraws, pooled particles, cap simultaneous tweens; respect `prefers-reduced-motion` by reducing amplitude.
- Until Gemini's art lands, the Character must work with a fallback (current `drawAnimal` image as a single-part rig) so the branch stays runnable.

## Audio hooks (Grok Bot)

The audio layer resolves `lineId` to a static file (Gemini TTS, voice Leda) and falls back to device TTS. Line ids: `food.{id}.{count}.{lang}`, `thanks.{lang}.{index}`, and Hebrew guidance `he.{key}` (see `src/content/audio-manifest.json`). `AudioManager.play()` resolves when the clip ends — use it to drive the `talking` state.
