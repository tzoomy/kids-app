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

## Animation system API (implemented on `feat/p1-anim`)

Everything lives in `src/anim/` (public surface re-exported from `src/anim/index.ts`). Pure modules (no Phaser) are unit-tested in `tests/unit/anim*.test.ts`.

| Module | Purpose |
|---|---|
| `profiles.ts` | `ANIM_PROFILE`: every amplitude, duration and easing. Tune feel here only. |
| `motion.ts` | Global reduced-motion factor (`prefers-reduced-motion` -> `ANIM_PROFILE.reducedMotionFactor`). `amp()`, `ampScale()`, `ampCount()` scale amplitudes, scale deltas and particle counts. `setMotionFactor()` overrides it (tests, a future parent setting). |
| `tweens.ts` | Promise-returning helpers: `squashStretch`, `pressSquash`, `popIn` / `popOut`, `bounce`, `wobble`, `shakeSoft`, `floatIdle`, `invitePulse`, `hintPulse`, `flyArc` (allocation-free arc via `arc.ts`), `wait`, `chain`. |
| `juice.ts` | `Juice.for(scene).burst(kind, x, y, count?)` for `star`, `sparkle`, `heart`, `crumb`, `confetti`. One pooled emitter per kind per scene, capped by `ANIM_PROFILE.particles.maxPerEmitter`. Uses the FX SVGs when loaded, otherwise generates a simple texture once per game. |
| `transitions.ts` | `transitionTo(fromScene, key, { style: 'fade' | 'iris' | 'slide', originX?, originY?, data? })`. Under 400 ms in total, ignores double taps, target scenes need no changes. Reduced motion always fades. |
| `stateMachine.ts` | Pure `CharacterStateMachine` and the `TRANSITIONS` table. |
| `Character.ts` | `new Character(scene, { kind, x, y /* feet */, displayHeight, depth })` with `enter(fromX)`, `talk(promise)`, `happy()`, `munch(ms?)`, `hmm()`, `poke()`, `exit(toX)`, `mouthPoint()`, `headPoint()`, `destroy()`. Every action returns a Promise that resolves when it finishes or is superseded. Idle life (breathing, sway, blink every 2-5 s, ear wiggle, tail wag) always runs in the background. All tweens and timers are cleaned up on `destroy()` and on scene shutdown. |
| `rigTypes.ts` | `RigPart`, `AnimalRig`, `ArtManifestEntry` — identical to the contract above. |
| `artRegistry.ts` | `registerAnimalRigs(rigs)`, `registerArtManifest(entries)`, and lookups (`foodArtKey`, `propArtKey`, `sceneArtKey`, `fxArtKey`, `animalPartKey`). Lookups resolve by **file path** (e.g. `art/animals/bear/ear-left.svg`), so the manifest may use any key naming. |
| `fallbackRig.ts` / `characterArt.ts` | `planCharacterArt(kind, exists)` picks the layered rig only if every texture it needs is registered **and loaded**; otherwise a single-part rig built on the `drawAnimal` texture. A missing SVG never produces a half-drawn animal. |
| `assetLoader.ts` / `PreloadScene.ts` | The first scene. Loads every manifest SVG with `this.load.svg(key, BASE_URL + url, { width, height })`, shows three bouncing dots and a progress bar, skips missing files (warning in the console), and moves on after at most 12 s no matter what. |
| `registerArt.ts` | `registerProjectArt()`, called once from `createGame`. **The art plug point.** |

### Registering the art (when `src/assets/art/**` lands)

In `src/anim/registerArt.ts`, uncomment the imports and the two calls:

```ts
import { ANIMAL_RIGS } from '../assets/art/rigs';
import { ART_MANIFEST } from '../assets/art/manifest'; // use the actual export name
registerAnimalRigs(ANIMAL_RIGS);
registerArtManifest(ART_MANIFEST);
```

Nothing else needs to change: the PreloadScene loads the manifest, the Character switches to the layered rig per kind, and the restaurant background, counter, plate, plate shadow, foods and FX particles switch to the SVGs wherever a texture is loaded. Kinds or files that are missing keep the procedural fallback.

Rig expectations the Character relies on: part ids `body`, `head` (container pivot = the head part's `x, y`), and optional `tail`, `mane`, `earL`, `earR`, `eyeL`, `eyeR`, `mouth`. Parts with `parent: 'head'` go into the head container, positioned relative to the head pivot, and are sorted by `depth` within it. The head container uses the head part's `depth` among body-level parts. Swapped textures (`eyeClosedKey`, `mouthKeys`) keep the open eye or mouth part's scale and origin, so they should be rasterized at the same scale as the part they replace.

### Adding a new character state

1. Add the state to `CharacterState` and its row and column in `TRANSITIONS` (`src/anim/stateMachine.ts`). If it should settle back to idle by itself, add it to `RETURNS_TO_IDLE`. Add a test in `tests/unit/animStateMachine.test.ts`.
2. Add its feel values under `ANIM_PROFILE.character` (`src/anim/profiles.ts`).
3. Add a method on `Character` that follows the existing pattern:

```ts
wave(): Promise<void> {
  const token = this.begin('wave');           // -1 when the transition is not allowed
  if (token < 0) return Promise.resolve();
  const p = this.actionPromise();             // resolves on finish or when superseded
  this.trackTween(chain(this.scene, {         // tracked so it is stopped on the next state or destroy
    targets: this.motion,                     // motion: y / angle / squash; head: tilt and nod
    tweens: [/* ... values via amp() / ampScale() ... */],
    onComplete: () => this.finish(token),     // resets the mouth, relaxes, settles to idle
  }));
  return p;
}
```

Use `amp()` / `ampScale()` for every amplitude so reduced motion keeps working. Do not stop the ambient tweens on `breath`. Use `this.trackTimer()` for timers.

### Restaurant integration notes

- `src/games/restaurant/restaurantLayout.ts` (pure, tested) owns positions for 1280x800 and 800x1280. The animal's feet sit behind a counter front drawn above it (`restaurantArt.ts`).
- Correct answer: plate press squash, the other plates pop out, the food flies on an arc into `mouthPoint()`, then `munch()`, star and confetti burst, `happy()` with hearts, a star flies to the HUD star pill and bumps it, the thanks line plays through `talk()`, then `exit()` and the next animal `enter()`s. Wrong answer: plate `wobble`, animal `hmm()`, then the usual hint or retry after 450 ms.
- Requests for other owners: the HUD rebuilds the whole chrome every second (`renderRestaurantChrome` replaces `chromeRoot` and `setRestaurantChrome` clears the overlay). The restaurant works around it by re-adding the prompt bubble and skipping refreshes while help is open, but an in-place update in `src/ui/hud.ts`, plus a `data-testid` on the star pill, would be cleaner.
