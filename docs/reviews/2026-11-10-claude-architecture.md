# Review — `docs/ARCHITECTURE.md` + `docs/WORLDS.md`

This review was written against the original Hebrew drafts. Line-number links refer to those drafts at the time of the review.

## 1. Strengths

- Consistent tagging ("proposal — pending owner approval") separates well what is already decided (leisure earning, Hebrew, Android, offline) from what still needs Maor's decision — convenient for review and partial sign-off.
- The layer split (world map / game template / JSON content) is the strongest anchor in the document: if it is maintained, it really reduces each new game to a content file + assets, as written on line 79.
- The leisure-engine rules (section 7) are sharp and sound from an educational point of view: no penalty for a mistake, idle does not earn, no competition between sisters — this is correctly translated from the "vision" into testable system rules.
- The privacy/audio policy (sections 5, 9) is clear and consistent: no sending the child's voice to a server, no transcription, everything on the device.
- The rollout plan does not break the live site until an approved merge — a responsible approach for a product two children already use.

## 2. Risks and problems

**Architecture.** There is no decision on state management between the DOM layer (Hebrew, parent area) and the Phaser layer (canvas) — how they talk (events? a shared store?), and what happens if a Phaser scene crashes while the girl is mid-game — does the app get "stuck", or is there a path back to the map? This is not mentioned at all. There is also no word on schema migration for `localStorage`/IndexedDB when content/rules change between versions — an existing profile of a daughter with a leisure balance cannot "break" when a world is added.

**Phaser/Vite/PWA.** There is an unresolved tension between "code and asset splitting by world" (section 11) and Workbox/`vite-plugin-pwa`, which usually does aggressive precache of everything in the build — without an explicit decision on a caching strategy (precache only the shell, runtime caching for worlds), the requirements "do not load everything at once" and "works offline after a one-time download" can conflict. There is also no concrete byte/MB budget for the first load (Phaser core itself is already several hundred KB).

**RTL and canvas.** Section 4 correctly solves directionality for isolated learning text, but does not address text/buttons *inside* the canvas itself (for example "play again" appearing as a Phaser element near the character) — Phaser has no built-in bidi shaping for Hebrew, and this is exactly the place that needs early testing, not only after the migration. There is also no decision on scale mode between landscape and portrait (FIT vs ENVELOP, letterboxing) — it is mentioned only as a Playwright check, not as a design.

**Audio/TTS.** The solution for a complete absence of voice already exists (line 138), but the more common scenario — a poor French voice / with a wrong accent that exists on the device but pronounces incorrectly — is not handled, and that is exactly the case section 5 itself emphasizes ("grammatical gender... must be correct"). There is also no mention of pre-warming the voice before interaction starts, to avoid latency.

**Content-as-data.** There is no JSON schema validation in CI at all. If Maor or someone else edits content directly, a broken file can go up to Pages and break a live game without any test catching it — this is a small and critical addition missing from section 10.

**Leisure engine.** The economy is based on the device clock — resetting the clock (on purpose or by accident) resets daily caps; multiple profiles on one device may allow an "idle reset" by a fast profile switch. These do not have to be solved now, but complete silence on the topic is not right — at least a "known limitations" subsection is needed.

**Performance on a mid-range tablet.** The targets (30fps, 64px touch) are reasonable but are not quoted against a real device model — "device model not yet provided" (line 223) means the targets are not currently verifiable. There is also no texture GC policy between scenes (destroy vs sleep) — on older Android, a WebView memory leak is a more common failure than FPS.

**Tests.** There is no e2e test for actual offline operation (service worker, cache) even though this is a core requirement. Visual regression of screenshots with Phaser animations can be "flaky" — there is no mention of a tolerance threshold.

**Publishing to Pages.** The move from "branch root" to "GitHub Actions artifact" is a change in repo settings (not only code) that requires an admin action by Maor, and there is no rollback plan if the first deploy breaks the live site the girls are using now.

**Worlds scope.** `WORLDS.md` presents 5 areas × 3 games × 2 ages — a full vision menu, not a pilot. There is a pointer to the roadmap in ARCHITECTURE, but inside `WORLDS.md` itself there is no explicit mark of what is in the pilot and what is "vision only" — a risk of bloat.

## 3. Missing gaps

- No telemetry/error log even locally — "no analytics" is good for privacy, but it also means Maor has no way to know remotely that something actually broke for the girls.
- No decision on content-authoring: how Maor himself will add a word/stage without writing raw JSON correctly 100% of the time.
- No treatment of data loss: clearing the app / uninstalling the PWA deletes all balance and progress; "export/import" is planned only "later" (line 201) — meaning in the pilot this risk exists and is not mentioned as a risk.
- No compatibility matrix (minimum Android/Chrome versions).
- No copyright/character-resemblance review process for AI assets, beyond a statement of intent (section 6) — how this is actually checked.
- No final decision on the parent-gate mechanism (section 8 leaves "the multiplication question can stay, or..." as an open choice without pointing to a default).
- In the "what is not built in the pilot" section of WORLDS.md there is no explicit P0 list inside the file itself.

## 4. Concrete recommendations for change

1. In section 1 (PWA): add a paragraph that decides explicitly between precache for the shell only vs runtime caching for worlds, so it does not conflict with section 11.
2. In section 10: add a CI "content lint" step — JSON schema validation (for example zod) before the build.
3. In section 11: replace general targets with a measurable one (for example "initial load ≤ X MB") and state that actual testing waits for a concrete device model.
4. In section 1 / "Proposed publishing": add a line stating that changing the Pages source requires an admin action by Maor, and that it should be tested on a preview URL before the live swap, with a rollback plan.
5. In section 7: add a "known limitations" subsection (device clock, app deletion) so the transparency is written down and not only implied.
6. In WORLDS.md: mark inside the file itself (not only by reference to ARCHITECTURE) which games are "P0 pilot" versus the broader vision.
7. Section 8: decide/propose one default for the parent-gate mechanism, not two open options.

## 5. What requires Maor's explicit approval before implementation

- Stack move to Vite+TS+Phaser+PWA (a substantial architectural change, not only a technical one).
- Changing the publish source on GitHub Pages (an admin action on a live public repo).
- Graphic style/characters (already marked correctly in section 6, just to sharpen).
- Font license (Noto or another).
- Default values of the leisure engine (10/5 minutes, 30-minute cap) — currently "temporary", but someone needs to formally approve them before code.
- The list of areas/their names in WORLDS.md and the actual pilot order (not all 15 games).
- The parent-gate mechanism.
- Local telemetry / error-log policy — whether it is allowed at all, and in what form, given "no external analytics".
