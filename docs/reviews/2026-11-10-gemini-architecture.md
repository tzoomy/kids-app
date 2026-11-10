# Independent review: architecture and world map (`ARCHITECTURE.md` and `WORLDS.md`)

Read-only review of [docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md) and [docs/WORLDS.md](file:///workspace/kids-app/app/docs/WORLDS.md).

This review was written against the original Hebrew drafts. Line-number links refer to those drafts at the time of the review.

---

## 1. Brief strengths

1. **Isolation of the leisure engine (`src/core/leisure`):** Separating earning logic, caps, and idle from Phaser ([docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L59), [section 7](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L166-L181)) enables real unit tests in Vitest and prevents bugs of mixed balances or dependence on the game's frame rate.
2. **Separation of concerns between DOM and canvas:** Distinguishing a Hebrew shell in HTML/CSS (profiles, parent area, forms) from game scenes in Phaser ([docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L19)) will save a huge headache of managing forms and RTL inside a canvas.
3. **Two-layer model for age 2 vs age 5:** The definition in [docs/WORLDS.md](file:///workspace/kids-app/app/docs/WORLDS.md#L5) of a shared world with a behavioral variant (touch exploration vs a multi-step task) instead of two separate apps is right pedagogically and engineering-wise.
4. **Safe migration strategy:** Keeping the live prototype at the root until the skeleton and Animal Restaurant are completed on a separate branch ([docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L31), [section 12](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L237-L241)) avoids breaking the existing product.
5. **Test focus on visual and logical regression:** Combining Vitest for leisure rules and Playwright for screenshots at tablet resolutions ([docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L210-L215)) matches exactly the needs of automated review in the repository.

---

## 2. Risks and problems

### Architecture and Phaser / Vite / PWA
* **Over-optimism about "code splitting by world":** In [docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L18) and [section 11](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L229) it is claimed that Vite will split code by world. In practice, the `phaser` library itself is a monolith of ~1MB minified (or ~300KB gzipped), and it is loaded already on entry. Code splitting will save only a few kilobytes of game logic, while the real bottleneck is loading assets (textures and audio) through Phaser's Loader, not Vite's JS bundle.
* **The `vite-plugin-pwa` (Workbox) cache trap:** [Section 9](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L202) says the Service Worker will store atlases and audio. If `precache` is set for all assets in Workbox, and in phase B hundreds of recorded audio files in 3 languages are added, the first PWA install will fail or get stuck. The App Shell (in precache) must be separated from world assets (runtime caching or proactive loading on entering a world). In addition, there is no mention of a version-update mechanism (`skipWaiting` / a refresh banner for the parent) — in a `standalone` PWA on a tablet, a child can stay for months on an old cached version.

### RTL and canvas
* **Hebrew text on a Phaser canvas is a minefield:** [Section 4](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L128) discusses direction isolation also for text on canvas. Phaser's text engine (`Phaser.GameObjects.Text`) is based on `CanvasRenderingContext2D.fillText`, which has known bugs in Chrome on Android with a mix of Hebrew, punctuation, and numbers (BiDi), and does not support HTML `dir="ltr"` or `unicode-bidi: isolate`. If Hebrew or mixed text is shown on the canvas, it may reverse. The right solution is to show all UI text and instructions in a DOM layer above the canvas (`Phaser.GameObjects.DOMElement` or an HTML shell), and leave on the canvas only graphic objects or isolated LTR words.

### Audio and TTS
* **Unreliability of the Web Speech API on Android offline:** [Section 5](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L138) proposes continuing in phase A with device TTS. On many Android tablets (especially Samsung/Lenovo or certain versions of the Google TTS engine), French (`fr-FR`) or Hebrew (`he-IL`) voices are not preinstalled for offline use, or `speechSynthesis.getVoices()` returns an empty array on first load until a `voiceschanged` event that sometimes never fires in a WebView/PWA. Worse: `speechSynthesis.speak()` is often swallowed silently without throwing an error, so the 2-year-old will see a silent screen without understanding what is being asked of her.
* **French grammar and articles:** In the JSON sketch ([line 108](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L108)) `"fr": "pomme", "frGender": "f"` appears. In French you cannot assemble a natural sentence such as *"Je veux une pomme"* or *"Donne-moi du pain"* from a noun and grammatical gender (`f`/`m`) alone, because of partitive articles (`du`, `de la`, `de l'`) and elision (`l'orange`). Trying to assemble sentences dynamically in code will lead to broken French.

### Content-as-data
* **Gap between the proposed schema and game complexity:** The JSON sketch in [section 3](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L95-L110) is too simplistic even for the age-5 requirements in the same document. [docs/WORLDS.md](file:///workspace/kids-app/app/docs/WORLDS.md#L37) and [line 46](file:///workspace/kids-app/app/docs/WORLDS.md#L46) talk about requests with an attribute ("red apple" / Hebrew UI example: "תפוח אדום"), negation ("not the red hat"), or a rule that changes mid-way ("now only the small ones" in [line 76](file:///workspace/kids-app/app/docs/WORLDS.md#L76)). The proposed schema does not include attributes (`attributes`: color, size), complete sentence templates per language, or stage rules. If a rich schema is not defined up front (for example with Zod or strict TypeScript interfaces), every game will become hardcoded and the "content as data" promise will be emptied of meaning.

### Leisure engine
* **Idle detection for a two-year-old, and day rollover:** [Section 7](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L174-L175) states that earning is by participation and that idle is checked. In a game where a two-year-old is listening to a song ([Word Song](file:///workspace/kids-app/app/docs/WORLDS.md#L48-L54)) or watching an animation for 25 seconds without touching the screen, an idle mechanism based only on `pointerdown` events will cut her time earning by mistake. Also, how "day rollover" is computed is not defined (local midnight? what happens if the time is changed on the tablet? is unredeemed balance deleted at midnight or carried to the next day up to the balance cap?).

### Performance on a mid-range Android tablet
* **System gestures and GPU memory:** [Section 11](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L226-L231) lacks a reference to a critical problem in drag games on a children's tablet: dragging near the screen edges on Android triggers the system Back gesture or opens the notification shade. Also, cheap tablets are very limited in VRAM; loading several Texture Atlases of size `4096x4096` will crash the WebGL context. Atlas size should be limited to `2048x2048`, and textures should be released (`textures.remove`) on leaving a world.

### Tests and publishing to Pages
* **WebGL rendering in Playwright in CI:** [Section 10](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L213) plans Playwright screenshots on every PR. On GitHub Actions (Ubuntu runners without a GPU), Chrome runs headless and renders WebGL through SwiftShader (software), which sometimes fails or produces artifacts different from Canvas 2D, or the shot is taken before Phaser has finished loading fonts and textures and rendering a stable frame.

### Worlds scope and the graphics pipeline
* **Unrealistic scope and an internal contradiction in animations:** [docs/WORLDS.md](file:///workspace/kids-app/app/docs/WORLDS.md) details 12 games in 4 worlds, each with two variants (age 2 and 5) and 3 languages. Even if they are built in stages, producing consistent assets with AI ([section 6](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L156-L160)) is a heavy manual task: image AI tools (Midjourney/DALL-E) struggle badly to produce **exactly the same character** at different angles and expressions with a clean transparent background. In addition, [line 160](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L160) says animation is done with Phaser Tweens, but [line 138](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L138) requires "mouth animation" as a fallback for missing audio — which requires sprite replacement (frame-by-frame) for each character, not merely a position/size tween.

---

## 3. Gaps missing from the document

1. **Architecture of the "Leisure Corner" and balance redemption:** [docs/WORLDS.md](file:///workspace/kids-app/app/docs/WORLDS.md#L21) mentions a "Leisure Corner (bubbles, free drawing, a short video in the future)". How does the transition from learning mode to leisure mode work? What does the countdown timer look like without stressing a two-year-old? And what happens the moment the balance hits zero mid-drawing in the studio — is the screen snatched immediately, or is the current action allowed to finish (grace period)?
2. **Toddler input resilience (multi-touch and palm rejection):** Two-year-olds rest a whole hand on the tablet and press with the other finger, or tap the same item 10 times a second. There is no treatment of multi-touch management in Phaser, locking input while feedback/animation plays (debounce), and keeping exit/help buttons away from the screen edges.
3. **Balance expiry and daily earning policy:** What happens to leisure balance earned today and not used? Does it reset at night or is it kept? What exactly is the difference between the 5 caps mentioned in [section 7](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L177) ("base leisure, conversion ratio, earning cap, redemption cap, balance cap, and an overall daily cap")? This many terms is confusing both for a programmer and for a parent on the settings screen.
4. **Backup and restore vs clearing the browser cache:** In [section 9](file:///workspace/kids-app/app/docs/ARCHITECTURE.md#L201) file export/import is deferred to "later". Because all data is in `localStorage`/`IndexedDB`, clearing browsing data in Chrome on the tablet will delete all of the girls' profiles, settings, progress, and drawings.

---

## 4. Concrete recommendations for changes to the documents and the plan

1. **In [docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md) section 3 (content as data):** Change the JSON sketch so it does not contain isolated words from which the code assembles sentences, but keys for complete, grammatically correct sentences in each language (including the French article, for example `"frPrompt": "Donne-moi une pomme"`), and add an `attributes` field (`color`, `size`) on every item.
2. **In [docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md) section 4 (i18n and RTL):** Set a hard architectural rule: **Do not render Hebrew sentences or bidirectional text inside `Phaser.GameObjects.Text` on the canvas.** All Hebrew text will be shown in an HTML/CSS layer above the canvas.
3. **In [docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md) section 5 (audio strategy):** Bring forward the production of recorded voices (even using a quality TTS tool on the development machine, saved as static `.mp3`/`.ogg` files in the repository) already to stage 3 (Animal Restaurant), and do not defer it to stage 7. This will immediately solve both the offline Web Speech API problem on Android and French pronunciation quality, at zero runtime cost.
4. **In [docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md) section 7 (leisure engine):** Simplify the caps model from 5 different caps to at most 3 clear parameters (for example: daily base leisure, conversion ratio, and a maximum daily leisure cap), and define that time spent playing the game's audio/animation is not counted as idle.
5. **In [docs/ARCHITECTURE.md](file:///workspace/kids-app/app/docs/ARCHITECTURE.md) section 10 (tests):** Define exposure of a global status object in test mode (for example `window.__GAME_READY__`) or use of a Canvas 2D renderer in CI so Playwright screenshots are deterministic and do not capture a black loading screen.
6. **In [docs/WORLDS.md](file:///workspace/kids-app/app/docs/WORLDS.md) and the roadmap:** Narrow the MVP definition to only two game templates ("choice/serve" and "sort/drag") and one complete world ("Language House" + "Bubbles" as the leisure corner) before planning 4 worlds and 12 games.

---

## 5. What requires Maor's approval before implementation starts

Before writing a single line of code in the new skeleton, Maor must decide and approve the following points:

1. **The technology stack and the Pages move:** Approval of the move to Vite + TypeScript + Phaser 3, and changing GitHub Pages settings to publish from GitHub Actions (the `dist` folder) instead of from the root of `main`.
2. **The exact leisure-engine rules:** Which parameters the parent controls (are 5 different caps really needed?), what the idle threshold in seconds is for each age, what happens to the balance at midnight, and how the screen behaves when leisure time runs out mid-game/creation.
3. **The audio solution for the first stage:** Does Maor approve producing static audio files (MP3/OGG) in advance and packaging them in the repository already in the first game, instead of relying on Android's built-in and problematic TTS?
4. **The family's tablet model:** What is the exact model, screen size, and Android version of the tablet the girls use (needed to set canvas resolution, test WebGL, and TTS support).
5. **Art direction and the house characters:** Approval of the illustration style and the fixed characters that will accompany the girls on the map and in the worlds.
