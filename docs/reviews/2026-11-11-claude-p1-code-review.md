# P1 code review — `feat/p1-restaurant-polish` vs `main`

Reviewer: Claude Code (senior review, read-only). Date: 2026-11-11.
Scope: `git diff main...HEAD`, 16 commits (`73eca2e`..`4cbefb7`). Binary audio/PNG files and SVG contents were not reviewed line by line.

## Checks run

| Check | Result |
|---|---|
| `npm test` (Vitest) | 15 files, 90 tests, all pass |
| `npx tsc -p tsconfig.json --noEmit` | clean |
| `vite build` (to a temp dir) | builds; precache = **175 entries, 3.22 MB** (JS 1.64 MB, MP3 1.43 MB, SVG 119 KB, fonts 92 KB) |
| Rig/manifest consistency (ad-hoc script) | all 6 rigs complete, every manifest URL exists on disk, rig part sizes match the manifest |
| Audio coverage (ad-hoc script) | all 77 manifest files exist; every line id the app can request has a clip (uncountable foods only have count 1, as expected) |
| Clip duration vs text length (ffprobe) | no obvious mis-splits. Outliers: `thanks.fr.0` (2.4 s for "Miam ! Merci !"; it contains an internal pause, which looks plausible) and `food.broccoli.1.en` (a bit short). The longest Hebrew clip is about 9.7 s (`restaurant.intro`) |
| Playwright e2e | **not run**: the journey spec writes screenshots into the repo, and this review is read-only |

## Verdict

**Request changes. Mostly solid, but two cheap input bugs need fixing before Maor plays it.** The animation layer is well built. `Character` tracks and cleans up its tweens and timers on `destroy()` and on scene shutdown. The state machine is pure and tested. `flyArc` and `hop` do no per-frame allocation. Particles are pooled and capped. Transitions guard against double taps and disable scene input. Reduced motion is handled in one place. The HUD now updates in place. The `StaticFileProvider` promise always settles on stop or interrupt. The leisure invariants hold: wrong answers only call `reportInteraction()`, nothing is ever deducted, and `complete()` → `reportCelebrating(false)` is paired, including on shutdown.

What blocks the merge is how a 2-year-old actually taps: the plate hit boxes cover the bottom of the animal, and rapid wrong taps stack up overlapping speech and hint effects. Both are small fixes. The audio layer also needs a safety timeout and a "single voice" guarantee (should-fix, high).

## Blockers (must fix before merge)

### B1. Plate hit areas overlap the animal's "tap to hear again" zone
`src/games/restaurant/restaurantArt.ts:113` (`root.setSize(Math.max(128, plateW + 16), 200)`) together with `src/games/restaurant/RestaurantScene.ts:245`.

The container hit area is 200 px tall and centered on the plate root at `y = 0.64h`, so it reaches 100 px above the plate. The animal zone (`createAnimalHitArea`, depth 6) ends at `counter.top = 0.58h`. Plates have depth 20 and Phaser uses `topOnly`, so the plate wins wherever the two overlap.
- Landscape 1280x800, age 5: the middle plate's hit box covers y 412–512 and the animal zone ends at y 464. That leaves a 52 x 178 px band of the animal's visible belly, just above the counter, that selects the middle plate.
- Age 2 (2 plates at x ≈ 510 and 770): both plates overlap the animal zone horizontally.
- Portrait 800x1280: a band of about 23 px.

The help text tells the child to tap the animal to hear the request again. Doing that can now give a "hmm" (wrong answer) or a free correct answer.
**Fix:** size the hit area to the visible plate and foods, and keep it below the counter top. For example, `root.setInteractive(new Phaser.Geom.Rectangle(-w/2, top, w, h), Phaser.Geom.Rectangle.Contains)` with `top = -iconSize/2 - 8` and `h` reaching to the plate bottom. Alternatively, clamp it so `root.y + top >= layout.counter.top`. Add a pure test in `restaurantLayout.test.ts` checking that the plate hit rectangles do not intersect the animal hit rectangle in both orientations and for both age tracks (move the hit-rect math into `restaurantLayout.ts` so it can be tested).

### B2. Rapid wrong taps stack delayed hints, speech restarts and SFX; a double tap counts as two tries
`src/games/restaurant/RestaurantScene.ts:332-361`.

Each wrong tap runs `round.tries++`, `wobble` (a new chain on the same `angle` that does not kill the previous one), `character.hmm()`, an SFX, and a new untracked `time.delayedCall(450, …)`.
- Five fast taps queue five `giveHint` / `speakPrompt` calls 450 ms later. Each one stops the previous clip and starts a new one, so the child hears 5 restarts of the `he.retry.*` line ("Almost! Let's listen again") or the food line, chopped into fragments.
- With `demonstrate`, each queued call also stacks another `hintPulse` scale tween on the same plate and another sparkle burst.
- A single accidental double tap on a wrong plate sets `tries = 2`, so age 5 jumps straight to the demonstration hint and skips the Hebrew retry line.

No leisure is lost, but this is the kind of chaos the owner will notice in the first minute.
**Fix:**
- Keep a single `retryTimer` field and `remove()` it before scheduling a new one, so only the last wrong tap speaks.
- Ignore plate taps for about 450 ms after a wrong tap (a `inputLockedUntil = this.time.now + HINT_AFTER_HMM_MS` check at the top of `choose`). Alternatively, count at most one try per plate per 450 ms window.
- Let `wobble` kill earlier `angle` tweens on the plate body (`killTweensOfProps(scene, target, ['angle'])`). Note that `killTweensOfProps` does not see `TweenChain`s, because `chain.data` holds tweens, not `TweenData` with `.key`. Use `scene.tweens.killTweensOf(target)` for the body, or track the wobble chain on the `PlateView`.
- Same for `hintPulse`: stop the previous pulse before starting a new one, and reset `root` scale to 1.

## Should-fix

### S1. (High) `StaticFileProvider.play()` has no safety timeout, so a stuck clip leaves `listening = true`
`src/core/audio/staticFileProvider.ts:49-78`.

If `ended` and `error` never fire, the promise never settles. That can happen with a stalled media load, an Android audio-focus interruption that pauses the element, or a service-worker response the media stack does not accept. `DeviceTtsProvider` has `TTS_SAFETY_TIMEOUT_MS` for exactly this case; the static provider has nothing. The consequences:
- `speakPrompt` awaits `speech` forever, so `reportListening(false)` never runs and `LearningSession.isQualifying()` stays true. **The child earns leisure while idle**, which breaks the participation-only rule.
- `BubblesScene.say()` chains lines one after another, so one stuck clip blocks every later narrator line.

`Character.talk` is capped at 10 s, but the scene's own await is not.
**Fix:** arm a timer when `loadedmetadata` fires: `duration * 1000 / playbackRate + 1500`, with a hard 12 s fallback when the duration is unknown. When it fires, call `finish(true)` and pause the element. Also listen to `stalled` and `abort`. Add a unit test with `FakeAudio` and fake timers.

### S2. (High) Voices can overlap: `AudioManager` does not enforce a single voice across providers, and a stale fallback can speak later
`src/core/audio/manager.ts:19-27` (unchanged file, but the new voice flows depend on it).
- `StaticFileProvider.play()` returns `false` immediately for a line without a clip, **without stopping the clip already playing**. Device TTS then speaks over it. The reverse case is the same: a static clip starts while device TTS is still speaking, because `StaticFileProvider` never calls `speechSynthesis.cancel()`.
- Line A's static attempt fails asynchronously (an `error` after a 404 or a cache miss, or an autoplay rejection). By then line B is already playing. A then falls through to device TTS and talks over B.

Today every line has a clip, so this only happens on failure paths, which is exactly when the app is offline or freshly installed.
**Fix:** in `AudioManager`, keep a generation counter. `play()` increments it and calls `stopAll()` before trying providers, and skips the next provider if the generation changed while awaiting. Add a test to `audioFallback.test.ts` covering "A fails late after B started, so A must not fall back".

### S3. A superseded voice flow clears `listening` while the newer line is still playing
`src/games/restaurant/RestaurantScene.ts:285-290` and `:177`.

When the child taps the animal during a prompt, the new `speakPrompt` sets `listening = true` and starts audio. That stops the old clip, so the old flow's `finally { reportListening(false) }` runs and clears the flag while the new line plays. The help line's `.finally(() => reportListening(false))` has the same problem when `speakPrompt` supersedes it on close. Impact is small today (`idleSeconds` = 20 and clips are under 10 s), but it is exactly the "correct listening reporting" invariant.
**Fix:** `finally { if (seq === this.speakSeq) this.session.reportListening(false); }`. For the help line, capture `const seq = ++this.speakSeq` and apply the same guard.

### S4. Precaching all voice clips contradicts `docs/ARCHITECTURE.md` and needs owner sign-off
`vite.config.ts:30` adds `mp3` to `globPatterns`. ARCHITECTURE §1 ("PWA cache, updated after the reviews") says: precache only the app shell; *"World assets, atlases, and audio — runtime caching or proactive loading on entering a world"*. The extra 1.43 MB is acceptable on its own, and offline voice from the first launch is a real benefit for the 2-year-old. But this choice belongs to Maor, and the doc must be updated in the same PR. It will also not scale: once there are more worlds, keep a per-world glob instead of `**/*.mp3`.

Related: Chrome on Android accepts full `200` responses for media range requests, but Safari/iPadOS does not. If an iPad is ever used, add `workbox-range-requests` for `/audio/` (runtime route) or confirm that precache serving works there.

### S5. TTS asset pipeline: changed text does not regenerate a clip; clips need a human listening pass
`scripts/tts/generate_voice.py:307`. A batch is skipped when "all clips exist". Clip paths do not depend on the text (`apple-1.mp3`, `he/retry-0.mp3`), so editing a sentence in `animal-restaurant.json` or `voice-lines-he.json` leaves the **old recording** in place with no warning. That is a real risk for Hebrew copy edits by the owner.
**Fix:** write a sidecar `audio-manifest.json` field or a `public/audio/.hashes.json` mapping `lineId → sha1(text, voice, style)`, and regenerate (or at least warn about) mismatches. Add a unit test that the stored hash matches the current text, so CI catches stale clips.

Batched synthesis split on silences cannot prove that clip *n* says sentence *n*. "Two apples" and "three apples" have almost the same length, so the ratio check would not catch a swap. My duration scan found no obvious misalignment, but **someone must listen to all 77 clips (and Maor to the 15 Hebrew ones) before merge**. Gemini Hebrew without niqqud can misplace stress, and the feminine address must sound natural.

### S6. Animal `talk()` conflicts and visual glitches
`src/anim/Character.ts`:
- `talk()` starts `relax(120)` (tweens `head.angle` to 0) and the nod tween (tweens `head.angle` back and forth) on the same property at the same time (`:362` and `:374`), which gives a visible jitter on the first 120 ms of every line. Start the nod after `relax` completes, or skip `relax` for `head.angle`.
- `munch()` and `happy()` do not relax the head, so after a `hmm` that gets interrupted (wrong tap, then a quick correct tap) the head stays tilted through munch and happy. Call `relax(80)` in `begin()` whenever the previous state was `hmm` or `talking`.
- `poke()` (`:484`) adds an untracked scale tween on `motion` that runs in parallel with the `talk()` that `speakPrompt` starts on the same tap. It is harmless because it yoyos back to 1, but track it so `stopActions()` can kill it.

### S7. Taps on the animal during `enter` play the food line, and the intro then cuts it off
`RestaurantScene.ts:194-199` together with `:233-239`. The animal zone is active from the first frame. A tap during the 820 ms hop starts `speakPrompt()` (the character stays silent because `enter → talking` is not allowed). Then `enter().then` calls `speakPrompt(intro)`, which stops the food line and starts the Hebrew intro. **Fix:** ignore animal taps until `enter` resolves (`if (this.character?.state === 'enter') return;`).

### S8. Help card during the celebration
If help is opened after a correct answer, `afterThanks` plays the praise line over the help line. The next round's `enter().then → speakPrompt` then talks while the help card is still open (only `giveHint` checks `helpOpen`). **Fix:** have `speakPrompt` (when not called from help close) and `afterThanks` bail or wait while `helpOpen`.

### S9. Test coverage of the new behavior is thin where the bugs are
The unit tests cover the pure modules well (state machine, motion, profiles, registry, layout, voice rules, provider). Nothing exercises the scene flows: wrong-tap handling, supersession, listening flags, help during celebration. Suggested additions:
- Extract the voice and listening orchestration (`speakSeq`, `introPlaying`, retry scheduling) into a small pure controller under `src/games/restaurant/`, then unit-test B2, S3 and S8 with fake audio and fake timers.
- e2e: wrong tap, then correct tap. Assert that the balance never decreases, `tries` = 1 after a double tap (once B2 is fixed), and the star count increments once.
- e2e: replace `waitForTimeout(1200)` / `(2200)` with `waitForFunction` on `getActiveScenes` / `getRoundInfo` plus a "character idle" flag. The fixed sleeps will be flaky on a loaded CI runner.
- A unit test that the **real** `ART_MANIFEST` and `ANIMAL_RIGS` are consistent and every URL exists under `public/` (I checked this ad hoc and it passes today; it should be in CI). Also test the "SVG < 15 KB" contract from `ANIMATION.md`.
- A test that every `he.*` key, every `thanks.*` index and every food line has a clip (`contentSchema.test.ts` covers food only; `audioStaticFile.test.ts` only checks manifest ⊆ valid ids).

## Nits / follow-ups

- **Texture memory:** `PreloadScene` rasterizes both `bg-landscape` (1280x800) and `bg-portrait` (800x1280), but a session only ever uses one (the base size is fixed at boot). That is about 4 MB of GPU memory and some boot time wasted. Filter the orientation that is not used in `queueArtManifest`. The total today is 82 textures, about 4.2 MPix ≈ 16 MB RGBA. That is fine for a mid-range tablet, but each animal is about 10 separate textures, so about 10 draw-call batch breaks per character in WebGL. Pack into one atlas per kind when convenient (ARCHITECTURE §6 already proposes atlases ≤ 2048²).
- **Crispness:** textures are rasterized at reference scale and the canvas is a fixed 1280x800 logical size scaled up by CSS. On a 2560x1600 tablet everything is 2x upscaled and soft. Consider `resolution`/DPR-aware canvas sizing later, and rasterize the SVGs at `displayHeight / rig.height × DPR`.
- **First launch on a slow network:** a 12 s hard timeout followed by the fallback art for the whole session is fine. Textures that finish loading later are never adopted, so log once to the console or re-run the preload on the next map visit.
- `ANIMATION.md` promises "cap simultaneous tweens". Nothing caps them (the counts are low today, so this is a doc fix, or add a debug counter).
- `__testHooks__` (`src/game/createGame.ts:60`) is installed in production builds, and `getRoundInfo()` now exposes `correctIndex`. Gate it with `isE2e()`.
- `MapScene` plays `map.choose` 1.2 s after **every** map visit (`src/worlds/MapScene.ts:113`). After the third return it will feel naggy. Once per app session, or once per profile pick, is enough.
- `bubbles.lowWarning` (literally "a little more time!") can be heard as "you get a bit more time" rather than "time is almost up". Ask Maor for the wording.
- Device-TTS fallback for `he` on tablets without a Hebrew voice will read Hebrew text with an English voice. Since clips exist this is rare, but consider skipping the TTS fallback for `he` when no `he` voice is present (silence is better than gibberish).
- Audio keeps playing when the tab is hidden or the screen locks, while the Phaser clock is paused. Stop narrator audio on `visibilitychange` → hidden.
- The welcome retry (`src/main.ts:108`) arms `pointerdown`. If the gesture is the tap that picks a profile, the welcome starts and is cut off a few ms later by `stopAll()` in `pickProfile`, giving a short audible blip. Arm on `pointerup` and check `currentProfileId` after a microtask, or skip the retry entirely.
- `scripts/tts/generate_voice.py:83` uses a backslash inside an f-string expression, which needs Python ≥ 3.12. Add a note or a version check (it compiles on 3.13 here).
- `docs/ANIMATION.md:139` "Requests for other owners" is now stale (the HUD in-place update and the `star-count` test id landed in `fdfe0f5`). Remove it or mark it done.
- `killTweensOfProps` silently ignores `TweenChain`s (see B2). Document that, or handle chains.
- `choiceServe.buildRound` now consumes one extra `random()` call, so seeded sequences in other callers shift. This is fine, just note it in the commit if anyone relies on seeds.
- RTL: no new Hebrew is rendered on the canvas; all Hebrew is voice or DOM. Good, keep it that way.

## Requires Maor's approval

1. Precaching all voice clips (S4), which deviates from the approved-direction text in ARCHITECTURE §1.
2. A listen-through of the Hebrew lines and the feminine-address copy (S5), plus the `bubbles.lowWarning` wording.
3. How often the map guidance line plays (every visit or once per session).
