# P1 Design QA Review — Animal Restaurant Polish (`feat/p1-restaurant-polish`)

**Reviewer:** Gemini (Design QA / Art Direction)
**Date:** 2026-11-11
**Scope:** Animal Restaurant visual polish, layered SVG art & rig integration, animation feel (`src/anim/`), tablet composition in landscape (`1280x800`) and portrait (`800x1280`), and voice/HUD integration.

---

## Verdict

**Changes Requested (3 Blockers before merge).**

In landscape orientation, the Animal Restaurant is a massive leap forward from P0—the layered SVG characters, warm cafe backdrop, and responsive animation system (`enter`, `talk`, `munch`, `happy`, `hmm`, particle bursts, and flying star to HUD) genuinely approach the Sago Mini / Lingokids bar. However, **portrait orientation (`800x1280`) is visually broken** due to uniform counter scaling and misaligned plate positions, and **2-choice plates (`age2`) are packed too tightly together** in both orientations instead of sitting over the three counter bays and giving a 2-year-old generous separation and target size.

---

## Blockers (Must Fix Before Merge)

### 1. Portrait counter is crushed (`162.5px` tall) and leaves a `375px` two-tone dead zone at the bottom
- **Where:** [restaurantArt.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantArt.ts#L34-L40), [restaurantLayout.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantLayout.ts#L15-L17)
- **What is broken:** `addCounterFront` scales `counter.svg` (`1280x260`) uniformly by `layout.width / img.width`. In portrait (`800x1280`), `scale = 800 / 1280 = 0.625`, shrinking the counter height to **`162.5px`** (`y = 742.4..904.9`). Because `bg-portrait.svg` paints a light wainscot wall down to `y = 1020` and a dark brown floor from `y = 1020..1280`, the bottom **375px** of the portrait screen exposes two mismatched horizontal bands (`#F7DEC0` wall from `905..1020` and `#B87D56` floor from `1020..1280`) below a squashed counter. Furthermore, the cream countertop surface shrinks from `78px` tall in landscape to `48.75px` in portrait.
- **Concrete fix:**
  1. In [restaurantLayout.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantLayout.ts#L15-L17), make the counter fill the lower canvas from `counter.top` (`y = 464` in landscape, `y = 742.4` in portrait) down to the bottom of the screen (`height - counterTop`, or `336px` in landscape and `538px` in portrait), or add a dedicated `counterHeight` / `counterScaleY`.
  2. In [restaurantArt.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantArt.ts#L37-L39), use `img.setDisplaySize(layout.width, layout.height - layout.counter.top)` (or keep `scaleY >= 1.3` in portrait with a baseboard fill down to `layout.height`) so the counter front covers down to the bottom edge in portrait and gives the countertop surface proper vertical depth (`~100px`) for plates to sit on.

### 2. Plates do not sit on the cream countertop surface (they hang over the front wood lip and panels)
- **Where:** [restaurantLayout.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantLayout.ts#L17-L44), [restaurantArt.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantArt.ts#L80-L97)
- **What is broken:** `PLATE_Y_RATIO = 0.64` places `view.root.y` at `512` (landscape) and `819.2` (portrait). Inside `buildPlate`, the plate image is offset downward by `plateY = Math.max(iconSize, 70) * 0.42` (`+45.36px` for 1 food item) and has height `plateW * (140 / 320)` (`85.75px` for `plateW = 196`). That puts the plate center at `y = 557.4` and its bottom rim at **`y = 600.2`** in landscape, while the cream countertop surface in `counter.svg` ends at **`y = 548`** (`464 + 84`) and the front lip ends at `y = 564`. In portrait (`restaurant-800x1280.png` and `/tmp/qa/age5-portrait-r1.png`), it is even worse: the plates (`y = 864.6`, bottom `907.4`) sit **completely off the cream surface** (`742..795`), floating directly across the brown wood front panels.
- **Concrete fix:**
  1. In [restaurantLayout.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantLayout.ts#L17), lower the plate anchor ratio or compute `plates.y` directly from `counterTop`:
     - Landscape: set `plates.y = counterTop + 18` (`482`, i.e. `height * 0.6025`), so the plate center (`482 + 45 = 527`) sits squarely inside the cream countertop surface (`470..548`) and the food bottom (`y = 482 + 54 = 536`) rests inside the plate well.
     - Portrait (once Blocker #1 scales the counter height): set `plates.y = counterTop + 28` (`~770`, i.e. `height * 0.60`), so the plate sits cleanly on the cream countertop in portrait as well.
  2. In [restaurantArt.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantArt.ts#L82), reduce `plateY` from `Math.max(iconSize, 70) * 0.42` to `Math.max(iconSize, 70) * 0.30` so the food sits deeper inside the inner well of `plate.svg` rather than perched on its top rim.

### 3. Plate spacing and food scale are too cramped for 2-choice (`age2`) and 3-choice (`age5`) layouts
- **Where:** [restaurantLayout.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantLayout.ts#L18-L27) and [restaurantLayout.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantLayout.ts#L49-L59)
- **What is broken:**
  1. **Misaligned 2-choice (`age2`) plates & narrow spacing:** `spacing = Math.min(260, (width - 80) / n)` caps `spacing` at `260px` even when `width = 1280` and `n = 2`. As seen in `restaurant-1280x800.png`, the two plates are clustered tightly in the center (`x = 510` and `x = 770`), sitting right over the seams between the 3 recessed wood counter panels (`48..400`, `464..816`, `880..1232`) and leaving the outer 60% of the counter empty. Even for `n = 3` (`age5-landscape-r1.png`), `xs = [380, 640, 900]` does not line up with the left/right panel centers (`224, 640, 1056`).
  2. **2-year-old food/plate scale (`age2`):** In `1280x800`, a 2-year-old only ever gets 2 choices with `count = 1`. Capping `MAX_ICON_SIZE = 108` and `plateW = 196px` makes the plates look small on a `1280px`-wide counter.
  3. **Tiny multi-item foods on `age5` (`count = 3`):** In `iconSizeFor(spacing, count)`, `available = spacing - 50 - (c - 1) * ICON_GAP`. For `count = 3` (`age5-portrait-r1.png`, middle plate with 3 pears), `iconSize` drops to **`62px`**, while `plateW` expands to `246px` (`plateH = 108px`). Three `62px` pears in a single row on a huge `246px` plate look dwarfed next to the `108px` single pear beside them.
- **Concrete fix:**
  1. In [restaurantLayout.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantLayout.ts#L18-L27):
     - Increase `MAX_ICON_SIZE` from `108` to **`128`** (or `132` in landscape when `n === 2`).
     - Replace the flat `260` spacing cap with orientation-aware spacing:
       ```ts
       const maxSpacing = landscape ? (n === 2 ? 440 : 380) : (n === 2 ? 320 : 250);
       const spacing = Math.min(maxSpacing, (width - 64) / n);
       ```
       In landscape, `n = 3` then gives `xs = [260, 640, 1020]`, aligning with the three wood panels in `counter.svg`, and `n = 2` gives `xs = [420, 860]`, giving a 2-year-old wide, unmistakable left/right targets.
  2. In [restaurantLayout.ts](file:///workspace/kids-app/app/src/games/restaurant/restaurantLayout.ts#L49-L53), reduce the rim subtraction in `iconSizeFor` from `50` to `28` (and `ICON_GAP` from `12` to `8` when `count === 3`) so 3-item plates render icons at **`76–88px`** instead of `62px`.

---

## Should-Fix (High-Value Polish)

1. **Prompt bubble occludes the bunting garland and pendant lamps:**
   - **Where:** [shell.css](file:///workspace/kids-app/app/src/styles/shell.css#L343-L353)
   - **Issue:** `.shell-prompt-bubble` sits at `top: 8vmin` (`64px` in landscape) with large padding, covering the entire bunting garland (`y = 94..150`) and cutting across the top of both pendant lamps in `restaurant-1280x800.png` and `restaurant-800x1280.png`. Only after the bubble disappears on a tap (`f12.png`, `f20.png`) can the child see the garland and lamps.
   - **Fix:** Move `.shell-prompt-bubble` up to `top: 6.2vmin` with `padding: 0.8vmin 2.6vmin; font-size: clamp(18px, 3.6vmin, 30px);`, or anchor it slightly tighter to the top bar so the cafe lamps and bunting remain visible underneath.

2. **Empty-stage gap (~900ms) between rounds:**
   - **Where:** [RestaurantScene.ts](file:///workspace/kids-app/app/src/games/restaurant/RestaurantScene.ts#L428-L430), [profiles.ts](file:///workspace/kids-app/app/src/anim/profiles.ts#L24-L25)
   - **Issue:** In `onCorrect`, `await character.exit(...)` takes `450ms` (3 wave steps) + `700ms` (exit hops) = **`1150ms`**, and only after the old character is completely off-screen does `startRound()` spawn the next animal (`820ms` enter) and pop in the plates (`220ms` delay). This leaves the restaurant stage completely empty for nearly a full second (captured in `/tmp/qa/age5-landscape-r2.png`).
   - **Fix:** Snappen `character.exit` in [profiles.ts](file:///workspace/kids-app/app/src/anim/profiles.ts#L24-L25) to `{ duration: 520, hops: 2, hopHeight: 36, waveAngle: 9, waveDuration: 110, waveRepeats: 1 }` and `character.enter` to `{ duration: 680, hops: 3, hopHeight: 42, ease: 'Linear' }`, and reduce plate `popIn` initial delay in [RestaurantScene.ts](file:///workspace/kids-app/app/src/games/restaurant/RestaurantScene.ts#L247) from `220` to `120`.

3. **Crumb particles fall too fast and blend into the cream countertop:**
   - **Where:** [profiles.ts](file:///workspace/kids-app/app/src/anim/profiles.ts#L43)
   - **Issue:** In `f20.png`, the `crumb` particles emitted during `munch()` are tiny (`scaleStart: 0.45` = `28px` shrinking to `0`) with high gravity (`gravityY: 700`), so they drop straight onto the light cream countertop and almost vanish at tablet viewing distance.
   - **Fix:** Tune `ANIM_PROFILE.particles.crumb` in [profiles.ts](file:///workspace/kids-app/app/src/anim/profiles.ts#L43) to `{ count: 8, speedMin: 110, speedMax: 230, lifespan: 650, scaleStart: 0.62, gravityY: 480 }`.

4. **Daily progress bar in the restaurant HUD is nearly invisible when empty:**
   - **Where:** [shell.css](file:///workspace/kids-app/app/src/styles/shell.css#L205-L211)
   - **Issue:** `.shell-progress` uses `background: rgba(255, 255, 255, 0.5)` with no border against the `#FFF3E0` header band (`restaurant-1280x800.png`). When `earnedTodaySec` is `0`, it looks like a faint accidental smudge in the top bar.
   - **Fix:** Add `border: 2px solid rgba(122, 92, 72, 0.25); background: rgba(255, 255, 255, 0.78);` to `.shell-progress`.

---

## What Works Well

- **Character Rigging & Appeal:** All 6 layered SVG animals (`lion`, `rabbit`, `cat`, `bear`, `dog`, `panda`) assemble cleanly with zero seam gaps. The `400x480` rig proportions, dark-brown outlines (`#3B2A22`), big glossy eyes, and soft blush read clearly from across a room.
- **State Machine & Non-Punishing Feedback:** The `hmm` state on a wrong tap (`11°` gentle head tilt + `mouth-hmm` + soft plate wobble, no harsh shake or negative buzzer) hits the exact toddler-friendly tone required by `AGENTS.md`.
- **Celebration Sequence & Audio Sync:** Food detachment (`detachFood`) and `flyArc` into `mouthPoint()`, followed by `munch()`, `happy()` heart burst, star/confetti burst, and the star flying to the HUD pill with a spring bump (`bumpStarPill`) feel cohesive and rewarding. `RestaurantScene` properly sequences Hebrew narrator lines (`intro`, `retry`, `praise`, `leisure.earned`) with Leda's EN/FR voice clips without overlapping speech.
- **In-Place HUD Updates:** `RestaurantHud.update()` updates text/width in place without tearing down the DOM every second, preserving the prompt bubble and help overlay cleanly.

---

## Nice-to-Have / Follow-Ups (Not Blockers for This PR)

- **Procedural Art on Map, Bubbles, and Profile Screens:** As expected for P1 scope, `map-1280x800.png`, `map-800x1280.png`, `bubbles-1280x800.png`, and `profiles-*.png` still use P0 procedural/emoji visuals (note also that `סטודיו האמנות` on `map-800x1280.png` shrinks very small in portrait). Upgrading those screens to the P1 vector style is a follow-up for the next milestone.
- **3-Food Triangular Arrangement:** When `choice.count === 3`, arranging the 3 icons on the plate in a slight triangle (2 in back, 1 in front) rather than a flat horizontal line (`restaurantArt.ts#L106-L111`) would allow even larger food icons without widening the plate.
