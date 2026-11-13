# Architecture and roadmap — learning app for the girls

Status: **proposal — pending owner approval**. This document describes a technical and structural direction for the next version. It does not change the live app at [Animal Restaurant](https://tzoomy.github.io/kids-app/). Choices Maor has not yet approved are marked explicitly.

The document draws on `vision-summary.md` and `gpt-research-plan.md` (outside the repository, in the working folder). Core requirements already decided: support both daughters (currently ages 2 and 5), Hebrew UI, English learning and French reinforcement, Android tablet as the primary device, leisure time earned from educational activity, a parent area, enjoyment of the educational content itself, offline use, minimal data collection, and no paid services at runtime.

The current prototype is a single HTML/JS page with emoji, device TTS, and `localStorage`. It proves the basic loop (profile ← game ← earning ← leisure ← parent), but it is not suitable for high-quality graphics and animation, or for adding worlds without rewriting the code each time.

---

## 1. Technology stack

**proposal — pending owner approval:** Vite + TypeScript + Phaser 3, as a static PWA published to GitHub Pages.

| Layer | Proposed choice | Rationale |
|---|---|---|
| Game engine | Phaser 3 | Built for browser games: scenes, sprites, animations, drag-and-drop, basic physics, and audio. Remains a web app that can be added to the home screen, with no store and no paid service. |
| Language and build | TypeScript + Vite | Types for the leisure engine, JSON content, and scenes; fast builds; code splitting by world; static output for Pages. |
| Shell UI | Small HTML/CSS outside the canvas, or DOM inside Phaser | Hebrew navigation, the parent area, and forms are easier in the DOM; the games themselves are on the canvas. |
| PWA | `vite-plugin-pwa` (Workbox) | Asset caching for offline use, Hebrew manifest, icons, `standalone`. |
| Tests | Vitest + Playwright | Unit tests for the leisure engine and content; tablet-sized screenshots on every PR. |
| Publishing | GitHub Actions → GitHub Pages | Build from `main` (or a tag), upload the `dist` folder only. Free, no server, no extra hosting provider. |

Alternatives considered and deferred for now (also **proposal — pending owner approval**):

- Continue with plain HTML/JS: fast for a prototype, weak for animation, atlases, and drag-and-drop games.
- PixiJS only: excellent rendering, but no ready-made scenes, physics, or input; we would build more code ourselves.
- Godot / Unity for web export: heavier for a CLI team, less natural for JSON content and a light PWA, and harder to review in a PR.
- Capacitor / a store app: a possible future target, not needed as long as the tablet opens the site and adds it to the home screen.

The migration will happen on a separate branch, without breaking the live site until approval and merge. Until then the prototype files stay at the repository root, as they are today.

### Proposed publishing

```
Approved PR → merge to main → GitHub Action
  (npm ci, tests, vite build)
  → upload dist to GitHub Pages
```

**proposal — pending owner approval:** After the migration, Pages will be configured to publish from the Action output rather than from the root of `main`. The game URL will remain `https://tzoomy.github.io/kids-app/`. Set `base: '/kids-app/'` in Vite. Changing the publish source is a repository settings action, and requires Maor's approval and action (or someone with admin permission). Before swapping the live URL, test a build in preview (for example branch Pages, or a local run of `dist`). If the first publish breaks, temporarily fall back to publishing from the root of `main`, where the prototype is kept, or to the last commit that worked. The repository is public; do not put keys, the girls' real names, or usage data in it.

**PWA cache (updated after the reviews):** Precache only the app shell (HTML, core JS including Phaser, CSS, icons, and the minimum content for the flagship game if it is part of the first launch). World assets, atlases, and audio — runtime caching or proactive loading on entering a world, so the first install does not try to download the entire library. After an asset has been downloaded once, it is available offline. **P1 exception — proposal, pending owner approval:** the Animal Restaurant voice clips (77 files, about 1.4 MB of 48 kbps mono MP3) are precached with the shell (`vite.config.ts` adds `mp3` to `globPatterns`) so the flagship game speaks offline from the first launch. When more worlds get audio, switch to a per-world glob or runtime caching on world entry instead of `**/*.mp3`. **Update policy (approved):** when a new service worker is waiting, the app applies it automatically on launch and whenever the child is on the profile-select screen or the world map. Checks run at startup (`registerSW({ immediate: true })`), when the app becomes visible again, and every 30 minutes while it stays open. If the child is in a game (restaurant, leisure/bubbles) or in the parent area, the update is deferred until they next return to the map or profile screen, then the page reloads. Progress and leisure balances are written to `localStorage` before the reload. A manual refresh button remains in the parent area as a fallback. A short `sessionStorage` guard prevents a reload loop on the first launch of the new version.

Note on code splitting: the Phaser bundle itself already arrives on first entry (on the order of hundreds of kilobytes after gzip). The important savings are in per-world assets, not in splitting a few kilobytes of game logic JS.

---

## 2. Proposed folder structure

**proposal — pending owner approval.** The structure will appear on the implementation branch, not in the current prototype layout.

```
kids-app/
  AGENTS.md, CLAUDE.md, GEMINI.md
  docs/                  # architecture, worlds, team, reviews
  index.html             # Vite entry point
  public/                # manifest, icons, .nojekyll
  src/
    main.ts
    game/                # Phaser.Game creation, scene config
    core/
      leisure/           # leisure-earning engine — shared module, no Phaser dependency
      storage/           # profiles, parent settings, progress
      audio/             # TTS for now, recorded audio files later, SFX
      input/             # large touch targets, disable zoom, basic accessibility
    ui/                  # Hebrew shell: profile select, world map, parent area
    worlds/              # map scene + world entry
    games/
      templates/         # templates: choice, drag, sort, sequence, create
      restaurant/        # Animal Restaurant (first game to migrate)
    content/             # content as data (JSON), not logic
      worlds.json
      games/
      i18n/
    assets/              # graphics sources; atlases are built to public/assets
  tests/
    unit/                # Vitest, mainly core/leisure and content loading
    e2e/                 # Playwright, including screenshots
  .github/workflows/     # CI: tests + build; publish only from main
```

Each new game should mainly need a content file, assets, and when necessary a small extension to an existing template — not a copy of the whole app.

---

## 3. World map, game template, and content as data

**proposal — pending owner approval.** World and game details are in `docs/WORLDS.md`.

Three separate layers:

1. **World map** — one scene where the girl chooses an area (Language House, Number Garden, Nature Lab, Art Studio, and an approved leisure corner). Entering a world shows several games. The map is shared by both girls; what changes is the interaction path, the number of choices, and the guidance.
2. **Game template** — generic code for a type of action: choosing among items, drag and drop, sorting onto shelves, a sequence of steps, free creation. The template knows how to show a character, play a request, accept an action, give feedback, and report to the leisure engine and learning tracking.
3. **Content as data** — JSON for each game: skill, learning language, items, sentences, levels, which activities earn leisure, and links to graphics and audio assets. Adding foods, words, or a new stage is done in the content file.

Content sketch (not final; updated after the reviews). Learning-language sentences are stored complete and approved, and are not assembled in code from a noun and grammatical gender alone — especially in French (articles, partitive, `l'orange`). Items have attributes (color, size) when the game needs them. The schema will be defined in TypeScript and validated in CI (for example with Zod) before every build, so a broken content file does not go up to Pages.

```json
{
  "id": "animal-restaurant",
  "world": "language-house",
  "template": "choice-or-build-order",
  "skill": "listen-and-choose-food",
  "languages": ["en", "fr"],
  "earnsLeisure": true,
  "profiles": {
    "age2": { "choices": 2, "counts": [1], "hints": "demonstrate" },
    "age5": { "choices": 3, "counts": [1, 2, 3], "hints": "repeat-then-demonstrate" }
  },
  "items": [
    {
      "id": "apple",
      "he": "תפוח",
      "attributes": { "color": "red" },
      "sprite": "foods/apple",
      "audio": { "en": "audio/en/apple.ogg", "fr": "audio/fr/pomme.ogg" },
      "prompts": {
        "en": "I want an apple, please!",
        "fr": "Je voudrais une pomme, s'il te plaît !"
      }
    }
  ]
}
```

Content principles:

- One learning language per round, with a Hebrew help button.
- Progress is stored by skill and language, not as a single overall score.
- Repetition earns credit according to rules, but not without a limit on the same easy stage.
- No punishing failure: a mistake brings a hint or a demonstration, not a reduction of the leisure balance.
- In the first stage Maor and the team edit JSON; a parent-friendly editor is a later goal, not a requirement for the pilot.

---

## 4. i18n and RTL

**proposal — pending owner approval.**

- App shell, navigation, parent area, and explanations: Hebrew, `dir="rtl"`, `lang="he"`.
- Shell strings in i18n files (at least `he`), so text is not hard-coded. There is no current requirement for an English or French UI.
- **Proposed rule (updated after the reviews) — pending owner approval:** Do not render Hebrew sentences or bidirectional text in `Phaser.GameObjects.Text` on the canvas. Canvas `fillText` has known BiDi bugs in Chrome on Android. UI text and instructions are shown in an HTML/CSS layer above the canvas (the shell or a `DOMElement`). On the canvas: graphics, and isolated LTR words in the learning language only if needed.
- Learning content in English and French is shown with direction isolation (`dir="ltr"` / isolate) in the DOM layer.
- **proposal — pending owner approval** for scale mode: `Phaser.Scale.FIT` with letterboxing, for landscape and portrait, without clipping buttons. Exit and help buttons do not sit on the screen edges, so they do not collide with Android system gestures (back, notification shade).
- Fonts: one font family that supports Hebrew and Latin letters well, bundled with the app so it works offline. **proposal — pending owner approval:** a free font with a clear license (for example the Noto family), no paid fonts.
- Buttons, touch targets, and drag areas are large; do not rely on reading for the two-year-old — audio leads, text supports. Handle repeated taps, multi-touch, and a hand resting on the screen (palm), and lock input during short feedback.

---

## 5. Audio strategy

**proposal — pending owner approval.**

Phase A in the prototype was the Web Speech API. The reviews warn that this is fragile on Android tablets: a French or Hebrew voice may be missing offline, `getVoices()` may be empty on load, and `speak()` sometimes fails silently. For the two-year-old, a silent screen is an experience failure, not only a quality issue. Even when a voice is present, the accent or grammatical gender may be wrong.

**Updated proposal — pending owner approval:** Already in the Animal Restaurant migration, package static audio files (`.ogg`/`.mp3`) for every learning sentence, produced in development (a human recording if possible, or quality TTS on the development machine as a bridge). This way the game works offline and French quality does not depend on the device. Family or professional recordings remain a quality goal, and do not have to wait until all worlds are done. If Maor prefers to stay with device TTS in the first stage — a text fallback plus mouth animation is required (mouth sprites, not only a size tween), and a test on the family tablet.

**P1 status:** the restaurant sentences, thanks lines, and Hebrew guidance lines are rendered with Gemini TTS (`gemini-3.8-flash-tts`, voice Leda, free tier — approved by Maor for this purpose) by `scripts/tts/generate_voice.py`, and shipped as static MP3 under `public/audio/`. `src/content/audio-text-hashes.json` records the text each clip was rendered from, so a copy edit without a re-render fails CI. Device TTS stays as the fallback (skipped for Hebrew when the device has no Hebrew voice). A second voice (Zephyr) and a parent voice choice are deferred (issue #8).

After the first touch, warm up the audio system to reduce latency. Time spent listening and watching an animation counts as participation, not idle.

Short SFX (success, hint, transition) can stay synthesized or small files already in phase A.

Policy: do not send the child's voice to a server, no transcription, and no real-time AI on the client as a requirement. AI use is allowed in development and asset production, not in the child's live use, unless Maor decides otherwise.

---

## 6. Graphics and animation pipeline

**proposal — pending owner approval.**

Style direction (for Maor to choose): warm, rounded illustration for children, saturated colors with high contrast, a clear outline, friendly faces, no copyrighted characters, and no busy detail in the background. The same style across all worlds, with a different palette per area.

Proposed workflow:

1. Define a short style sheet (character, background, object, icon) and reference examples.
2. Generate assets with AI tools from a fixed character sheet, then check consistency, readability on a tablet screen, and cultural sensitivity. AI tools struggle to keep the same character across angles and expressions with a transparent background; manual editing is therefore required, and an "AI pipeline" should not be assumed to produce a game-ready set on its own. Also check that there is no problematic resemblance to protected characters.
3. Slice into sprites at fixed sizes, and build a texture atlas (for example with a free tool) to reduce loads. **Proposal:** maximum atlas size 2048×2048, to reduce WebGL crashes on weaker tablets. On leaving a world, release textures (`textures.remove` / destroy), do not only hide the scene.
4. Keep sources (PNG/SVG) separate from the built atlases.
5. Animate first with Phaser Tweens (entrance, bob, serving). Mouth animation or expressions require frames (frame animation), not only a size change. Lottie is suitable for short UI transitions. Spine or a lightweight alternative — only if a need for skeletal characters appears; that is a later goal, not a requirement for the first game.

Graphics performance targets: an atlas for the character and game objects, one or two backgrounds per scene, avoid huge uncompressed PNGs. Proposed format: WebP or optimized PNG, with a fallback.

---

## 7. Leisure-time engine — a shared module

This is a core component already set as a requirement. Rule details are still **proposal — pending owner approval**.

The module (`src/core/leisure`) does not depend on Phaser. Every game reports to it: activity start, action, pause, exit, completion. It computes qualifying participation time, balance, caps, and redemption, and separately stores learning evidence (skill, language, independent success or with a hint).

Time earning is paused by `settings.timeEarning.enabled` (default `false`, `LeisureSettings`): when off, nothing is earned or spent and all balance/timer UI is hidden; set it to `true` to restore the behaviour below.

Proposed rules, following the vision documents (not final policy):

- Earning is based on participation, including thinking, mistakes, and hints; not on speed or success.
- A backgrounded screen, a lock, or a long absence of interaction does not earn credit. The idle duration is checked so as not to penalize a child who is thinking.
- No penalty for a mistake, no transfer of balance between sisters, no ranking between them.
- The parent sets for each profile: base leisure, conversion ratio, earning cap, redemption cap, balance cap, and an overall daily cap.
- In the prototype, 10 minutes of learning for 5 minutes of leisure, and an earning cap of 30 minutes, were set temporarily. These are temporary default values only.
- Creation earns only if marked as such in the content; leisure itself does not create new entitlement.
- Day rollover: midnight according to the device's local clock. Unredeemed balance is kept up to the balance cap, and redemption the next day is subject to that day's caps (as proposed in the vision document). No stressful expiry.
- Listening to an instruction and watching a game animation are not idle. The idle threshold itself, and a possible difference between age 2 and age 5, is a **proposal — pending owner approval** (in the prototype: 20 seconds without touch).
- When leisure time runs out mid-activity, **proposal — pending owner approval:** do not snatch the screen immediately; allow a short action or an open creation to finish (grace period), with a calm advance warning, and then return to the map or to an ending.
- Known limitations: resetting or changing the device clock can affect daily caps; the app cannot fully protect against this in a PWA. Clearing site data or removing the PWA deletes progress and balances until an export exists.

Gemini proposed simplifying to only 3 parent parameters. The detailed model is kept as a proposal because that is how it was described in the vision, but the parent screen must stay simple: a ratio and a daily cap can be shown, with the rest as advanced defaults. Maor will decide.

Unit tests will cover conversion, caps, day rollover, idle vs. listening, grace period, and repeating the same activity.

---

## 8. Parent area

**proposal — pending owner approval** for the login and screen details; the area itself is already required.

- An entry children will not pass by accident. **proposal — pending owner approval, proposed default:** keep the multiplication question from the prototype for now, and let the parent switch to a short code when they want. No cloud password.
- For each profile: a display name the parent chooses (real names are not required in the repo or on screen), ratio and time, active learning languages, and approved leisure content.
- A simple report: participation time, leisure earned and redeemed, exposure to words or games — no comparative scores and no recordings.
- Budget or content changes only from here.

---

## 9. Storage, privacy, and offline use

**proposal — pending owner approval.**

- All data stays on the device. No account, no external analytics, no cloud sync in the first version. An error log sent outward is not part of the plan. A local log shown to the parent is an open idea, **proposal — pending owner approval**, and will not be turned on without a decision.
- Proposed storage: `localStorage` for settings and small balances, and IndexedDB if we store creations (drawings) or a long event journal. Every data structure will have a schema number and migration code, so a game update does not break an existing balance. Manual file export/import can come later for backup across devices; until then, clearing Chrome data is a known risk, and this should be noted in the parent area.
- The Service Worker stores the shell, and then the assets that have already been downloaded. A game downloaded once should work without a network.
- Static audio packaged with the content is the basis for reliable offline use; device TTS is not enough for that.
- The public repository contains only code, game content, and original assets. It does not contain usage data.

---

## 10. Testing

**proposal — pending owner approval.**

- Vitest: leisure engine, JSON loading, schema validation, level selection by profile, repetition rules, basic i18n.
- Playwright: a short journey (profile selection, entering a game, parent area) at tablet size. **Proposal:** 1280×800 and 800×1280 (landscape and portrait), with screenshots as artifacts on every PR. Later a real device or Android emulation can be added.
- Phaser screenshots in CI (Ubuntu, no GPU) may be unstable under WebGL/SwiftShader, or may be captured before loading finishes. **Proposal:** in test mode expose a flag such as `window.__GAME_READY__` after a stable frame, wait for fonts and textures, set a visual-regression tolerance threshold, and if needed run CI with Canvas 2D.
- At least one e2e test for offline (shell + assets already in cache), because this is a core requirement.
- Tests do not measure "whether the child learned", but that the game does not break, that earning is correct, and that a visual change is visible in review.
- CI runs on every PR; publish to Pages only after merge to `main`.

---

## 11. Performance on mid-range Android tablets

**proposal — pending owner approval** for the numeric targets.

Targets to test on the family tablet (device model not yet provided):

- A reasonable first load on the network, then a fast load from cache. A numeric target for shell weight (MB) will be set after we measure Phaser and the flagship game's assets, and after a test on the family's tablet model (not yet provided). Without the model, FPS and weight targets are direction only.
- Smooth motion of about 30 frames per second in an active game; 60 is desirable on the map and in light transitions, not required in every scene.
- Large touch targets (about 64px and up), with no reliance on hover.
- Audio warmup after the first touch (a browser limitation).
- Code and asset splitting by world, so not all games are loaded at once.
- Shut down inactive scenes, limit heavy effects, and keep a game resolution that fits the screen without rendering unnecessary 4K.
- Test in battery-saver mode and in Chrome on the tablet, including TTS and touch.

---

## 12. Roadmap

The order is a **proposal — pending owner approval**. Each stage is a branch and a PR, without changing the live site until an approved merge.

1. **Foundation documents** (this document, worlds, team) — review and direction approval.
2. **Vite + TypeScript + Phaser + PWA + CI skeleton**, with an empty map screen and a move of the leisure engine and parent area into tested modules. The old prototype stays available until the skeleton replaces it at the same URL.
3. **Animal Restaurant migration** to a game template, with first graphics and animations, JSON content, both age levels, and static audio files for the sentences (if Maor approves). This is the first game that should feel like a "real game".
4. **World map** and leisure corner (bubbles), and then one more game in the Language House.
5. **Number Garden** — first quantity game, after two stable templates exist (choice/serve and sort/drag).
6. **Nature Lab** and **Art Studio** — according to what the girls enjoyed, not all ideas at once.
7. **Quality recordings** for the flagship game and for sentences that are already stable, if stage 3 started with development-machine TTS.
8. Later in the vision, not in the pilot: control of device content, a wider age range, and backup across devices.

Quality criterion for each stage: the girl understands what to do without reading, enjoys coming back, earning is transparent to the parent, and the game works on the tablet without a network.

---

## 13. What was updated after the Claude and Gemini reviews

Raw reviews: `docs/reviews/2026-11-10-claude-architecture.md`, `docs/reviews/2026-11-10-gemini-architecture.md`.

Points adopted into both documents: separating shell precache from runtime cache for worlds; a rule not to render Hebrew/BiDi on a Phaser canvas; complete sentences in JSON content and schema validation in CI; P0 marking in `WORLDS.md`; a rollback plan and the need for admin approval to change Pages; device-clock and data-deletion limitations; storage schema migration; listening is not idle; a grace period at the end of leisure; atlas limit of 2048; handling of edge gestures, multi-touch, and Playwright CI; and promoting static audio as a proposal already for the flagship game.

### Disagreements between the reviewers, and what was decided in the document

1. **Number of caps.** Gemini recommended narrowing to 3 parent parameters; Claude did not require that and focused on clock limitations and schema. The document keeps the vision model as a proposal, and asks for a simple parent interface with advanced fields hidden. Maor will decide.
2. **When static audio lands.** Claude emphasized device-TTS failures; Gemini recommended packaging files already in the restaurant migration. We adopted Gemini's recommendation as a proposal, without dropping human recording as a quality stage.
3. **Pilot scope.** Gemini proposed narrowing the document itself to two templates and one world; Claude proposed marking P0 inside the vision map. We adopted Claude's approach: the map stays, with a clear order marked.
4. **Telemetry.** Claude raised a local error log as a gap; Gemini did not require it. We do not add error collection, even local, without Maor's approval.
