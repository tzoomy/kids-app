# Independent Review: `feat/p0-foundation` (P0 Skeleton, World Map, Animal Restaurant, Bubbles, Leisure Engine, Parent Area)

## 0. Working-Tree Hygiene Alert (Immediate Blocker)

Before evaluating the code and screenshots, note the repository state on `feat/p0-foundation`:
- Running `git status` shows **20 modified files and 2 untracked files** (`docs/screenshots/profiles-1280x800.png`, `docs/screenshots/profiles-800x1280.png`) sitting **uncommitted** on top of `HEAD` (`0a6524a`).
- Those uncommitted working-tree edits contain major fixes required by the architecture: bundling `@fontsource/noto-sans-hebrew`, moving the World Map labels out of Phaser canvas into DOM pins (`renderMapPins`), upgrading the procedural vector art (`src/assets/vectorArt.ts`), and regenerating all 8 screenshots.
- If `feat/p0-foundation` were merged as currently committed (`0a6524a`), those fixes and the profile screenshots would be missing. Everything below reviews the current working-tree state and requires it to be staged, committed, and pushed.

**Live site safety check:** Verified via `git diff --name-status main...HEAD` and `git status` that all live prototype files at the repository root (`index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `icon.svg`, `.nojekyll`) are **100% untouched**.

---

## 1. What Works and Complies with the Architecture

1. **Clean Stack & Directory Isolation (`vite.config.ts`, `package.json`, `web/index.html`)**
   - Uses Vite 5 + TypeScript 5 + Phaser 3.80 + `vite-plugin-pwa` + Zod + Vitest + Playwright.
   - Setting `root: 'web'`, `base: '/kids-app/'`, `publicDir: '../public'`, and `build.outDir: '../dist'` in [vite.config.ts](file:///workspace/kids-app/app/vite.config.ts#L7-L19) cleanly separates the new build from the live root prototype without touching live URLs.

2. **Shared, Phaser-Free Leisure Engine (`src/core/leisure/`)**
   - [engine.ts](file:///workspace/kids-app/app/src/core/leisure/engine.ts#L1-L43), [learningSession.ts](file:///workspace/kids-app/app/src/core/leisure/learningSession.ts#L1-L74), and [leisureSession.ts](file:///workspace/kids-app/app/src/core/leisure/leisureSession.ts#L1-L62) have zero Phaser or DOM dependencies and accept an injectable clock (`nowMs`).
   - Fractional leisure seconds are preserved in `state.carry` ([engine.ts](file:///workspace/kids-app/app/src/core/leisure/engine.ts#L30-L38)) so 1-second ticks at a 10:5 (`0.5`) ratio never lose credit to rounding.
   - Listening to prompts (`reportListening(true)`) and watching celebrations (`reportCelebrating(true)`) count as active participation even past `idleSeconds` ([learningSession.ts](file:///workspace/kids-app/app/src/core/leisure/learningSession.ts#L50-L56)), while backgrounding the tab (`setHidden(true)`) stops both earning and spending.
   - `LeisureSession` implements a 5-second grace period ([leisureSession.ts](file:///workspace/kids-app/app/src/core/leisure/leisureSession.ts#L46-L59)) so the screen is not snatched abruptly the instant balance hits `0:00`.
   - Mistakes never reduce balance, and balances are strictly isolated per profile ID.

3. **Device-Local Storage, Local-Midnight Rollover, and Prototype Migration (`src/core/storage/`)**
   - [dayKey.ts](file:///workspace/kids-app/app/src/core/storage/dayKey.ts#L1-L7) computes `YYYY-MM-DD` from local device time (`getFullYear`/`getMonth`/`getDate`), avoiding UTC rollover bugs in Israel time.
   - [legacyMigration.ts](file:///workspace/kids-app/app/src/core/storage/legacyMigration.ts#L27-L70) performs a clean, one-time migration from the prototype's `ar_state` key into `kids-app-state-v2` (`SCHEMA_VERSION = 2`), preserving existing balances, stars, settings, and mapping `'little' | 'big'` to `'age2' | 'age5'`.

4. **Content as Data with Build/Load-Time Schema Validation (`src/content/`)**
   - [animal-restaurant.json](file:///workspace/kids-app/app/src/content/games/animal-restaurant.json#L1-L139) and [worlds.json](file:///workspace/kids-app/app/src/content/worlds.json#L1-L35) are validated by Zod schemas in [schema.ts](file:///workspace/kids-app/app/src/content/schema.ts#L1-L63) and [loadContent.ts](file:///workspace/kids-app/app/src/content/loadContent.ts#L1-L28).
   - Complete English and French sentences are stored explicitly per item and count (`"1"`, `"2"`, `"3"`), including partitives (`du raisin`, `du fromage`, `du poisson`) and elisions (`une orange`, `un œuf / deux œufs`)—no fragile string concatenation in code.

5. **BiDi / RTL Rule Enforcement & Offline Fonts (`src/ui/`, `src/main.ts`)**
   - `Phaser.GameObjects.Text` is **never used** anywhere in `src/`. All Hebrew UI (`dir="rtl" lang="he"`) and LTR learning sentences (`.ltr-isolate` with `direction: ltr; unicode-bidi: isolate` in [shell.css](file:///workspace/kids-app/app/src/styles/shell.css#L165-L168)) live in the HTML/CSS overlay above the canvas.
   - `@fontsource/noto-sans-hebrew` and `@fontsource/noto-sans` are bundled via [main.ts](file:///workspace/kids-app/app/src/main.ts#L1-L4).

---

## 2. Bugs, Risks, and Gaps (Tablet / RTL / Offline / Leisure / Parent / Audio / PWA / CI)

### A. Critical / High-Priority Bugs

1. **Landscape Speech Bubble Covers the Animal's Entire Face (`src/styles/shell.css`, `src/games/restaurant/RestaurantScene.ts`)**
   - In [shell.css](file:///workspace/kids-app/app/src/styles/shell.css#L148-L163), `.shell-prompt-bubble` is positioned at `top: 14vmin`, while [RestaurantScene.ts](file:///workspace/kids-app/app/src/games/restaurant/RestaurantScene.ts#L110) places the animal at `y = this.scale.height * 0.34` (`272px` on `1280×800`) with its head centered at `headY = -size * 0.26` (`~204px`).
   - As visible in `docs/screenshots/restaurant-1280x800.png`, in landscape orientation the white DOM speech bubble sits directly over `y = 112px..235px`, **completely covering the animal's eyes, nose, and mouth**. For a 2-year-old, hiding the character's face and expression breaks the core interaction.

2. **Audio `lineId` Ignores Item Quantity — Will Play Wrong Audio When Static Files Land (`src/games/restaurant/RestaurantScene.ts`)**
   - In [RestaurantScene.ts](file:///workspace/kids-app/app/src/games/restaurant/RestaurantScene.ts#L160-L161), `speakPrompt()` builds:
     ```ts
     const lineId = `food.${this.round.target.item.id}.${this.round.language}`;
     ```
   - It omits `this.round.target.count`! On the `age5` track, when the target is 2 or 3 apples (`"I want two apples, please!"`), `StaticFileProvider` will match `food.apple.en` in [audio-manifest.json](file:///workspace/kids-app/app/src/content/audio-manifest.json#L3-L4) and play the singular `"I want an apple, please!"` recording while the screen requires choosing 2 or 3 apples.
   - Similarly, [RestaurantScene.ts](file:///workspace/kids-app/app/src/games/restaurant/RestaurantScene.ts#L214) uses a single `lineId: \`thanks.${lang}\`` for 3 different random thank-you phrases.
   - **Fix:** Include the count in `lineId` (e.g., `food.${this.round.target.item.id}.${this.round.target.count}.${this.round.language}`) and update `audio-manifest.json` and unit tests accordingly.

3. **No Way to Switch Profiles After Initial Selection (`src/main.ts`, `src/ui/hud.ts`)**
   - [appContext.ts](file:///workspace/kids-app/app/src/game/appContext.ts#L23) declares `onExitToProfileSelect: (() => void) | null = null;`, and [main.ts](file:///workspace/kids-app/app/src/main.ts#L108-L112) has logic to switch profiles when `game` already exists, **but `onExitToProfileSelect` is never wired up and there is no profile-switch button on `MapScene` or in the Parent Area**.
   - Once one sister selects her profile on a shared family tablet in standalone PWA mode, the other sister cannot switch to her profile without force-closing or reloading the app.

4. **PWA Service Worker Misses Bundled Fonts (`woff2`) and Never Activates Updates (`vite.config.ts`)**
   - In [vite.config.ts](file:///workspace/kids-app/app/vite.config.ts#L29-L38), `workbox.globPatterns` is `['**/*.{js,css,html}']` and `runtimeCaching` only matches `/\.(?:png|jpg|jpeg|svg|webp|ogg|mp3)$/`. The `@fontsource` `.woff2` font files emitted into `dist/assets/` are **neither precached nor runtime-cached**, so offline loads can lose the Hebrew/Latin fonts. `manifest.json` and icons should also be included in `globPatterns`.
   - Furthermore, [vite.config.ts](file:///workspace/kids-app/app/vite.config.ts#L23) sets `registerType: 'prompt'`, which prevents new Service Workers from ever activating unless the app imports `virtual:pwa-register` and triggers an update (which is never done in `src/`). Either use `registerType: 'autoUpdate'` for P0 or wire up a refresh banner in the Parent/Map UI.

5. **Device TTS Hang Risk on Android Chrome Can Cause Infinite Leisure Earning (`src/core/audio/deviceTtsProvider.ts`, `src/games/restaurant/RestaurantScene.ts`)**
   - In [RestaurantScene.ts](file:///workspace/kids-app/app/src/games/restaurant/RestaurantScene.ts#L157-L163), `speakPrompt()` sets `this.session.reportListening(true)`, awaits `this.context.audio.play(...)`, and then sets `this.session.reportListening(false)`.
   - On Android Chrome, `window.speechSynthesis.speak()` is known to occasionally drop `onend`/`onerror` events (especially when `synth.cancel()` is called right before `speak()`, or when a French voice is missing offline). If `onend`/`onerror` never fires in [deviceTtsProvider.ts](file:///workspace/kids-app/app/src/core/audio/deviceTtsProvider.ts#L32-L52), the Promise never resolves, `this.session.listening` stays `true` forever, and `LearningSession.isQualifying()` ([learningSession.ts](file:///workspace/kids-app/app/src/core/leisure/learningSession.ts#L50-L56)) continues accruing leisure balance up to the daily cap even if the tablet is sitting untouched on a table.
   - Also, `RestaurantScene.goBack()` ([RestaurantScene.ts](file:///workspace/kids-app/app/src/games/restaurant/RestaurantScene.ts#L82-L87)) does not call `this.context.audio.stopAll()`, so speech continues after exiting to the map.
   - **Fix:** Add a safety timeout (e.g., 6–8 seconds) inside `DeviceTtsProvider.play()` so it always resolves, and call `this.context.audio.stopAll()` on scene shutdown/back.

### B. Medium Bugs & Tablet/Orientation Risks

6. **Fixed Orientation at First Profile Pick & Unresponsive Map DOM Pins on Resize/Rotation (`src/game/createGame.ts`, `src/ui/hud.ts`)**
   - [createGame.ts](file:///workspace/kids-app/app/src/game/createGame.ts#L21-L24) picks `1280×800` or `800×1280` once at game creation. Rotating the tablet later does not adapt the layout, and [renderMapPins](file:///workspace/kids-app/app/src/ui/hud.ts#L36-L50) calculates pixel coordinates (`canvas.getBoundingClientRect()`) only once in `MapScene.create()` with no `window.addEventListener('resize', ...)` or Phaser scale `resize` listener. If the tablet rotates or the browser address bar/fullscreen state shifts, the Hebrew building labels detach from the buildings.

7. **Parent Area Mislabels Lifetime Participation as "Activity Today" (`src/ui/parent.ts`, `src/content/i18n/he.json`)**
   - [parent.ts](file:///workspace/kids-app/app/src/ui/parent.ts#L109) renders `${t.participationToday}: ${formatClock(data.activeSec)}`, where `t.participationToday` is `"פעילות היום"` ("Activity today"). However, `data.activeSec` ([schema.ts](file:///workspace/kids-app/app/src/core/storage/schema.ts#L29)) is lifetime cumulative participation and does **not** reset in `rolloverIfNeeded()` ([engine.ts](file:///workspace/kids-app/app/src/core/leisure/engine.ts#L5-L10)). Either track `activeTodaySec` (resetting on day rollover) or change the Hebrew label to reflect total participation (`סה״כ למידה`).

8. **`StaticFileProvider` Base URL (`src/main.ts`)**
   - In [main.ts](file:///workspace/kids-app/app/src/main.ts#L19), pass `import.meta.env.BASE_URL` as `baseUrl` to `new StaticFileProvider(loadAudioManifest(), import.meta.env.BASE_URL)` so static audio paths resolve reliably under `/kids-app/` regardless of trailing-slash behavior.

---

## 3. Design Review of the Screenshots

### `profiles-1280x800.png` & `profiles-800x1280.png`
- **What works:** Warm, welcoming gradient; crisp Hebrew typography (`Noto Sans Hebrew`); large, high-contrast white profile cards (`הגדולה` and `הקטנה`) with clear avatars and `0:00 ⏳` balance indicators; `הורים 🔒` button is properly inset from the bottom-right corner (`max(2vmin, env(safe-area-inset-...))`) to avoid Android gesture collisions.
- **Minor issue:** The main heading says `מסעדת החיות` ("Animal Restaurant") instead of the app/island name (`האי הקטן שלנו`), which is a holdover from the single-game prototype.

### `map-1280x800.png` & `map-800x1280.png`
- **What works:** Clean visual hierarchy with 5 distinct world landmarks (Language House, Number Garden greenhouse, Nature Lab, Art Studio with easel, and Bubble Tree for the Leisure Corner). Rendering the Hebrew labels (`בית השפות`, etc.) and `בקרוב` tags as DOM pills (`.shell-map-pin`) produces sharp, readable Hebrew text at tablet distance with zero canvas BiDi issues.
- **Visual bugs to fix:**
  1. **Cloud ring artifact:** In both `map-1280x800.png` and `map-800x1280.png`, every white cloud has a grey circle drawn inside it. In [vectorArt.ts](file:///workspace/kids-app/app/src/assets/vectorArt.ts#L94-L99), `cg.strokeCircle(0, 0, 28)` strokes only the middle circle on top of the 3 overlapping white circles. Remove `cg.strokeCircle(0, 0, 28)` so the clouds are clean white shapes.
  2. **Portrait island overhang & flower collision (`map-800x1280.png`):** In portrait mode, the top-left (`בית השפות`) and top-right (`מעבדת הטבע`) houses extend beyond the island onto the ocean/sky horizon, and the pink flower on the bottom-left pokes directly through the wall and label of `סטודיו האמנות`. Slightly narrowing `spacingX` in portrait (or widening the island ellipse in portrait) will keep all 5 landmarks grounded on the island.

### `restaurant-1280x800.png` & `restaurant-800x1280.png`
- **What works:** Top HUD bar (`עזרה ❓`, `0:00 ⏳`, `0 ⭐`, progress bar, and `⬅️` back button) is legible, high-contrast, and inset from screen edges. LTR isolation on the French (`Je voudrais une fraise, s'il te plaît ! 🔊`) and English (`I want an egg, please! 🔊`) prompts works properly—the exclamation mark and speaker icon sit on the right end of the sentence, not flipped to the left by RTL.
- **Visual bugs to fix:**
  1. **Speech bubble covers the bear's face in landscape (`restaurant-1280x800.png`):** As detailed in §2.A.1, the DOM speech bubble sits right over the bear's head in `1280×800`. Move the speech bubble higher (e.g., `top: 8.5vmin` with tighter padding) or lower the animal/counter slightly in landscape so the animal's full face is always visible below the bubble.
  2. **Foods float on the wooden floor instead of sitting on plates on the counter:** In both `restaurant-1280x800.png` and `restaurant-800x1280.png`, the brown counter ends at `y = 0.74 * h`, while the foods are drawn at `y = 0.82 * h` ([RestaurantScene.ts](file:///workspace/kids-app/app/src/games/restaurant/RestaurantScene.ts#L126)) directly on the floor planks without plates—even though the Hebrew help text ([animal-restaurant.json](file:///workspace/kids-app/app/src/content/games/animal-restaurant.json#L16)) instructs the child: `"בחרי את הצלחת המתאימה"` ("choose the matching plate"). Drawing a light plate/tray circle behind each choice Container and positioning the choices on the counter surface makes the visual metaphor and the Hebrew help text match.
  3. **Sharp geometric strawberry (`restaurant-1280x800.png`):** In `restaurant-1280x800.png`, the strawberry ([vectorArt.ts](file:///workspace/kids-app/app/src/assets/vectorArt.ts#L240-L260)) looks like a sharp red downward triangle joined to a green upward triangle (a diamond/rhombus) rather than a fruit. Softening the strawberry silhouette (and the carrot top) will make it much clearer for a 2-year-old.

### `bubbles-1280x800.png`
- **What works:** Calm, uncluttered blue background, clear top-left countdown pill (`1:58 ⏳`) and top-right back button (`⬅️`).
- **Visual bug to fix:**
  - **Clipped flat edges on every bubble:** Look closely at the top, bottom, left, and right edges of the bubbles in `bubbles-1280x800.png`—their white outlines are shaved flat on all four sides. In [vectorArt.ts](file:///workspace/kids-app/app/src/assets/vectorArt.ts#L587-L600), `drawBubble()` strokes a circle of radius `r = diameter / 2` with a `4px` line width into a texture of exactly `diameter × diameter`, clipping the outer `2px` of the stroke on all four edges. Add `const pad = Math.ceil(diameter / 2 + 4);` and generate a `(pad * 2) × (pad * 2)` texture.

### `parent-1280x800.png`
- **What works:** Clean RTL form layout, readable Hebrew labels, per-profile track selector (`קטנה (2)` / `גדולה (5)`), `+5 דק׳` and `איפוס יתרה` buttons, and sticky `שמירה` / `יציאה` actions.
- **Visual bug to fix:**
  - **Clipped text under sticky footer:** At the bottom of the card in `parent-1280x800.png`, the sticky `.shell-card-actions` bar cuts across the middle of the sentence `ניקוי נתוני האתר בדפדפן מוחק את כל ההתקדמות.` (`wipeNote`), leaving half-sliced Hebrew letters visible at the bottom edge. Reducing vertical margins/padding slightly inside `.shell-card` (or hiding `idleSeconds` under an advanced toggle as recommended in `docs/ARCHITECTURE.md` §7) will let the entire parent card fit comfortably on an `800px`-tall landscape tablet without scrolling or clipping.

---

## 4. Are the Tests Sufficient (Vitest + Playwright)?

- **Vitest unit tests (7 suites, 30 tests): Strong.** They thoroughly cover `earnParticipation` (10:5 ratio, fractional `carry`, daily cap, local day rollover), `LearningSession` (active window, idle cutoff, `listening` and `celebrating` exemptions, `hidden` pause, no mistake penalty), `LeisureSession` (redemption, `hidden` pause, grace period, profile isolation), `Store` & `legacyMigration` from `ar_state`, Zod content validation, `choiceServe` round generation for both `age2` and `age5`, and `AudioManager` fallback.
- **Playwright E2E tests ([tests/e2e/journey.spec.ts](file:///workspace/kids-app/app/tests/e2e/journey.spec.ts#L1-L82)): Insufficient in 3 areas:**
  1. **No assertion in the second E2E test:** Look at `'wrong choices in the restaurant never reduce the leisure balance'` ([journey.spec.ts](file:///workspace/kids-app/app/tests/e2e/journey.spec.ts#L60-L81)). It seeds `42` seconds of balance, clicks the canvas 3 times at `y = 0.72` (which doesn't even hit the choices at `y = 0.82`), and **ends without a single `expect(...)` assertion on the balance**! It must assert that the balance pill still displays `0:42` (or higher if 1s of participation accrued).
  2. **Missing offline E2E test:** `docs/ARCHITECTURE.md` §10 explicitly requires *"At least one e2e test for offline (shell + assets already in cache), because this is a core requirement."* Add a Playwright test that loads the page, sets `context.setOffline(true)`, reloads, and verifies the profile screen / map renders offline.
  3. **Parent multiplication gate is never tested:** Because `?e2e=1` bypasses `renderParentGate` in [main.ts](file:///workspace/kids-app/app/src/main.ts#L42-L45), nothing tests the actual multiplication gate (`renderParentGate` in [parent.ts](file:///workspace/kids-app/app/src/ui/parent.ts#L5-L35)). Add either a unit test or an E2E test without `?e2e=1` that solves or cancels the gate.

---

## 5. What Must Change Before Merge vs. What Can Wait

### Must Change Before Merge (Blockers)
1. **Commit and push all working-tree changes** (including `docs/screenshots/profiles-*.png` and updated `src/` files) so the branch matches what was reviewed.
2. **Fix the landscape speech bubble overlapping the animal's face** in `RestaurantScene` / `shell.css` and regenerate `docs/screenshots/restaurant-1280x800.png`.
3. **Include item quantity (`count`) in `lineId`** in [RestaurantScene.ts](file:///workspace/kids-app/app/src/games/restaurant/RestaurantScene.ts#L160) (`food.${id}.${count}.${lang}`) and stop active audio on `goBack()` / scene shutdown; add a safety timeout to `DeviceTtsProvider.play()`.
4. **Add a way to switch profiles** (e.g., a profile/switch button on the Map top bar or in the Parent Area wired to `showProfileSelectScreen()`).
5. **Fix the visual bugs visible in the screenshots:**
   - Remove the inner grey stroke ring on the map clouds ([vectorArt.ts](file:///workspace/kids-app/app/src/assets/vectorArt.ts#L99)) and adjust portrait map spacing so buildings don't overhang the island or collide with flowers (`map-800x1280.png`).
   - Add texture padding in `drawBubble()` ([vectorArt.ts](file:///workspace/kids-app/app/src/assets/vectorArt.ts#L587-L600)) so bubbles don't have clipped flat edges (`bubbles-1280x800.png`).
   - Place food choices on plates on/over the counter surface and soften the sharp triangle strawberry (`restaurant-*.png`).
   - Fix the sticky footer clipping `wipeNote` in `parent-1280x800.png`, and fix the `"פעילות היום"` label vs. lifetime `activeSec` mismatch in [parent.ts](file:///workspace/kids-app/app/src/ui/parent.ts#L109).
6. **Fix PWA caching & E2E tests:**
   - Include `woff2`, `json`, `svg`, `png` in Workbox precache/runtime caching in [vite.config.ts](file:///workspace/kids-app/app/vite.config.ts#L29-L38), and either use `registerType: 'autoUpdate'` or wire up `virtual:pwa-register`.
   - Recompute `renderMapPins` on window/scale resize ([MapScene.ts](file:///workspace/kids-app/app/src/worlds/MapScene.ts#L86-L94)).
   - Add the missing balance assertion in `tests/e2e/journey.spec.ts` (test #2) and add an offline E2E check.

### Can Wait Until After Merge (P1 / Follow-up)
- Recording and committing the actual `.ogg`/`.mp3` static audio files for English and French sentences (once the `lineId` count bug is fixed, dropping files in requires no code change).
- True dynamic orientation switching between `1280×800` and `800×1280` mid-session without reloading Phaser.
- Frame-by-frame mouth animation sprites for the animals during speech.
- Deduplicating the double `npm run build` inside `.github/workflows/ci.yml`.

---

## 6. Explicit Agreement / Disagreement with the PR Author's Approach

- **AGREE — New app lives beside the root prototype (`web/index.html`, `src/`, `dist/`):** This strictly obeys `AGENTS.md` and `docs/ARCHITECTURE.md` §1, guaranteeing zero disruption to the live site during review and testing.
- **AGREE — GitHub Pages publish source is not switched yet:** Preparing the `deploy` job in `.github/workflows/ci.yml` while leaving repo Settings → Pages on the root branch until Maor explicitly approves and switches it is the safest rollout path.
- **AGREE — Placeholder 10:5 ratio, 30-minute daily cap, and 20-second idle threshold:** Marked clearly as temporary defaults in code, UI (`placeholderNote`), and `README.md`, and configurable in the Parent Area.
- **PARTIAL AGREEMENT — Device TTS now with a static-file manifest (`audio-manifest.json`):** I agree with the pluggable `AudioManager([StaticFileProvider, DeviceTtsProvider])` architecture for this P0 foundation PR so it does not block on audio recording, **provided** two things are fixed before merge: (1) `lineId` includes the item `count` so the manifest schema isn't broken for `age5` plural prompts, and (2) `DeviceTtsProvider` has a safety timeout so silent Android TTS failures cannot lock `LearningSession` in `listening = true` mode forever. As agreed in `docs/ARCHITECTURE.md` §5 & §13.2, static audio files for Animal Restaurant should follow immediately before relying on offline French play on the family tablet.

---

## Verdict

**REQUEST CHANGES** — The architecture, modular leisure engine, Zod content validation, RTL DOM separation, and unit test suite are well-engineered, but the uncommitted working-tree state, the landscape speech bubble covering the animal's face (`restaurant-1280x800.png`), the missing profile-switch action, the `lineId` count bug, the PWA font/update caching gaps, and the screenshot visual artifacts must be fixed before merging to `main`.

---

## Follow-up after this review

The review blockers were addressed on `feat/p0-foundation` after the review was written (this file is the original review, preserved). Summary of fixes:

- Landscape prompt bubble moved up; animal lowered so the face stays visible; food choices sit on plates on the counter; strawberry silhouette softened; bubble textures padded so outlines are not clipped; map cloud rings removed; portrait island spacing tightened.
- `lineId` is now `food.{id}.{count}.{lang}` (and `thanks.{lang}.{index}`), with the audio manifest updated to match. `DeviceTtsProvider` has an 8s safety timeout. Audio stops on restaurant exit/shutdown. `StaticFileProvider` uses `import.meta.env.BASE_URL`.
- Map top bar has a Home / profile-switch control wired to `onExitToProfileSelect`. Map pin positions recompute on resize.
- Parent area labels lifetime participation as "סה״כ למידה"; settings card uses a scrolling body with a static action row so notes are not clipped.
- Workbox precaches/runtime-caches `woff2` and related shell assets. The service worker is registered with `virtual:pwa-register` (`prompt`, plus a parent refresh button when an update is waiting).
- Playwright now asserts leisure balance after misses, covers the multiplication gate without `?e2e=1`, and checks that the profile shell still loads offline. Vitest covers the TTS timeout and the count-qualified manifest keys.
- Screenshots under `docs/screenshots/` were regenerated.
