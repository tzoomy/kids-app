# `parent-longpress-gate` — Parent gate by 3-second long-press

Status: **approved** (idea approved 2026-11-13; adding it alongside the existing gate is pending Maor's decision).
Pass in progress: **1** (`none` until implementation starts, then `1`, then `2`; read by `npm run check:ac`).

This is infrastructure, not a game: it has no learning goals, difficulty curve, leisure rules, art, or voice. The sections of `docs/specs/TEMPLATE.md` that do not apply are marked "not applicable" instead of being dropped, so the shape stays comparable. The same behaviour applies to age 2 and age 5 (the gate is for the parent). Source: `docs/WORLDS.md` → Infrastructure (approved ideas) §1.

## Summary

A parent holds the `🔒 parent area` button for 3 seconds and the parent settings open directly. A ring/bar fills on the button while it is held, so the parent sees it working. Letting go early cancels with no penalty. A short tap still opens the existing multiplication gate exactly as today, so this feature is **added alongside** the existing gate, not a replacement (default pending Maor's decision, see "Open decisions for the owner").

## Learning goals

Not applicable. It keeps the parent area out of the girls' reach: a random toddler tap or a two-finger grab never completes a continuous 3-second single-finger hold.

- **Age 2:** same as age 5.
- **Age 5:** same as age 2.

## World and why

- **World:** none (shell chrome: the profile-select screen and the map HUD).
- **Why:** `docs/WORLDS.md` → Infrastructure §1. Both existing entry points already render the same `parent-gate-btn` test id, so one shared binder covers both.

## Mechanic

The target is the existing `parent-gate-btn` button, on both the profile-select screen (`src/ui/profileSelect.ts`) and the map HUD (`renderMapChrome` in `src/ui/hud.ts`). Game HUDs (restaurant, bubbles, colouring, orchestra) have no parent button and are unchanged.

### Rules (frozen at approval)

1. **Start.** A `pointerdown` with the primary button (`button === 0`) starts a hold. Progress fills from 0 to 100 % over **3000 ms**, shown on the button (a bar reusing the `.shell-progress` look).
2. **Complete.** After a continuous 3000 ms hold by one pointer, `onLongPress` fires **once** and the parent settings open directly (no multiplication question). The progress element is removed.
3. **Early release cancels, no penalty.** `pointerup` before 3000 ms resets progress to 0, opens nothing from the hold, and sets no lockout or cooldown: a new hold may start immediately.
4. **Tap vs cancelled hold (decided rule).** The same release also produces a `click`. If the button was held **less than 500 ms** (`TAP_MAX_MS`), it is a **tap**: the click opens the multiplication gate as today. If it was held **500 ms or longer but under 3000 ms**, it is a **cancelled hold**: the trailing click is suppressed, so nothing opens and the parent can simply try again.
5. **No double open.** After a completed hold the trailing `click` must not open the multiplication gate (and, because the screen is replaced, must not hit anything under the finger either).
6. **Other cancel events.** `pointercancel`, `pointerleave`, `lostpointercapture`, and window or button `blur` cancel the hold (and suppress the trailing click). The browser's context menu is blocked on the button while a pointer is down (long-press on Android opens it otherwise), and the button disables text selection and the touch callout.
7. **Multi-touch.** Only the first pointer counts. A second pointer going down while the first is held (any pointer type, primary or not) cancels the hold and suppresses the click; the hold cannot restart until every pointer is up.
8. **Movement tolerance.** Touch pointers are implicitly captured, so `pointerleave` does not fire while a finger drags off the button. Moving more than **12 CSS px** (`MOVE_TOLERANCE_PX`) from the press point cancels the hold; smaller jitter does not.
9. **Keyboard / assistive click.** A `click` with no preceding pointer sequence (Enter or Space on a focused button, screen reader activation) is a plain tap: it calls `onTap`, i.e. opens the multiplication gate.
10. **Secondary buttons.** Right or middle mouse buttons never start a hold.
11. **`?e2e=1` bypass.** Unchanged: under `?e2e=1` a tap still opens the settings directly, as today. The long-press tests deliberately run **without** `?e2e=1`.

### Design

- `src/ui/longPress.ts` (new, DOM-free part): constants `HOLD_DURATION_MS = 3000`, `TAP_MAX_MS = 500`, `MOVE_TOLERANCE_PX = 12`; type `HoldCancelReason = 'release' | 'pointercancel' | 'pointerleave' | 'lostpointercapture' | 'blur' | 'multi-touch' | 'moved' | 'cancel'`; and

  ```ts
  createHoldTimer({
    durationMs?: number,            // default 3000
    tickMs?: number,                // default 50 (progress resolution)
    onProgress?: (fraction: number) => void,   // 0..1; called with 0 on start, 1 on completion, 0 on cancel
    onComplete: () => void,         // fires once, via a single timeout at exactly durationMs
    onCancel?: (info: { reason: HoldCancelReason; heldMs: number }) => void,
    now?: () => number,             // default Date.now-based
    schedule?: { setTimeout; clearTimeout; setInterval; clearInterval },  // default: globals
  }): {
    start(pointerId: number): boolean; // false when it cancels instead (second pointer while holding)
    cancel(reason?: HoldCancelReason): void;
    readonly isHolding: boolean;
    readonly completed: boolean;       // true after a completion, reset by the next start()
  }
  ```

- `attachLongPress(button, { onTap, onLongPress, durationMs?, tapMaxMs?, moveTolerancePx? }): () => void` (new, DOM binder, same file; returns a detach function). It owns the button's `click` listener, so click suppression does not depend on listener order. It adds the class `shell-holdable` to the button, and appends the progress element `div.shell-hold-progress[data-testid="parent-gate-progress"][role="progressbar"][aria-valuemin="0"][aria-valuemax="100"][aria-valuenow]` with one child `div` as the fill, only while a hold is active. Suppression of a trailing click expires on the next `pointerdown` or after 300 ms.
- `src/ui/hud.ts` and `src/ui/profileSelect.ts`: replace `parentBtn.addEventListener('click', …)` with `attachLongPress(parentBtn, { onTap: <existing handler>, onLongPress })`. New optional `onParentLongPress?: () => void` on `MapChromeOptions` and as a 5th parameter of `renderProfileSelect` (and `AppShell.showProfileSelect`). When it is not passed, the button behaves exactly as today.
- `src/main.ts`: `showProfileSelectScreen` and `context.onRequestParentSettings` (new optional field on `AppContext`, passed by `MapScene` as `onParentLongPress`) call a small `openParentSettingsDirect(onDone)` that does `setAppScreen('parent')` then `openParentSettings(onDone)`.
- `src/styles/shell.css`: `.shell-holdable` (`touch-action: none; user-select: none; -webkit-touch-callout: none; position: relative`) and `.shell-hold-progress` (a thin bar along the button's bottom edge that reuses the `.shell-progress` colours; `transition: none` on its fill so the fill follows the timer). The inline `position: absolute` that profile select sets on the button wins over `position: relative`, which is fine: it is still a containing block.
- No new dependencies, no new Hebrew strings (the progress bar carries no text).

## Difficulty curve

Not applicable.

## Leisure

Not applicable. Holding the button neither earns nor spends leisure time and does not touch any profile's balance.

## Player journey from the map

Profile select → hold `parent-gate-btn` for 3 s → parent settings. Or: profile → map → hold the same button in the top bar for 3 s → parent settings. Exiting settings returns as today (profile select, or the map restarts).

- Map building hit target: not used (the map HUD button is DOM, reached by picking a profile).
- `data-testid`s: `parent-gate-btn` (existing), `parent-gate-progress` (new, the progress element), `parent-exit-btn` (existing, the settings screen), `profile-a` and `switch-profile-btn` (existing; the latter only exists on the map chrome, so it marks that the map is up).
- Seed and read hooks: **none**. All e2e tests use real mouse input and run without `?e2e=1`.

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | The hold timer starts on `start(pointerId)`: it reports progress 0, is holding, is not completed, and progress rises with time (about 0.5 at 1500 ms) | 1 | unit | @single-orientation | |
| AC-02 | Releasing early cancels with no penalty: progress resets to 0, nothing completes, and a new hold can start immediately | 1 | unit | @single-orientation | |
| AC-03 | `pointercancel`, `pointerleave`, `lostpointercapture` and `blur` each cancel the hold (timer level and on a real button) | 1 | unit | @single-orientation | |
| AC-04 | The hold completes at exactly 3000 ms and not at 2999 ms, and `onComplete` fires exactly once | 1 | unit | @single-orientation | |
| AC-05 | A second simultaneous pointer cancels the hold (timer level and on a real button), and no completion follows | 1 | unit | @single-orientation | |
| AC-06 | After a completed hold the trailing `click` does not call `onTap` (the multiplication gate), and the next fresh tap works again | 1 | unit | @single-orientation | |
| AC-07 | Tap vs cancelled hold: a press under 500 ms lets the click through; a release between 500 ms and 3000 ms suppresses the click; a keyboard click with no pointer sequence passes through | 1 | unit | @single-orientation | |
| AC-08 | Moving more than 12 px from the press point cancels the hold; smaller jitter does not; a right mouse button never starts a hold | 1 | unit | @single-orientation | |
| AC-09 | Real press-and-hold of `parent-gate-btn` on profile select opens the parent settings at 3 s (not before) and the multiplication question never appears, also after the pointer is released | 1 | e2e | both | |
| AC-10 | A short real press does not open the settings; the multiplication gate is shown and still works end to end (a correct answer opens the settings, cancel returns) | 1 | e2e | @single-orientation | |
| AC-11 | Progress feedback is visible on the button while held (`parent-gate-progress`, growing `aria-valuenow`) and gone after release | 1 | e2e | @single-orientation | |
| AC-12 | Releasing after 1.5 s opens nothing (no settings, no multiplication gate), and the very next short press opens the multiplication gate (no lockout) | 1 | e2e | @single-orientation | |
| AC-13 | The same 3-second hold works on the map HUD button after picking a profile | 1 | e2e | @single-orientation | |
| AC-14 | Device check on the tablet: a real finger hold completes without the Android context menu, text selection or callout; finger jitter does not cancel; a second finger cancels; both orientations | 1 | device | both | |

Pass-1 criteria do not require polished animation or new recordings (`docs/PROCESS.md` §3). There is no Pass 2 for this feature unless Maor asks for one.

Test files (the file-name prefix is what `npm run check:ac` matches): `tests/unit/parent-longpress-gate.timer.test.ts` (AC-01 to AC-05), `tests/unit/parent-longpress-gate.dom.test.ts` (AC-03, AC-05 to AC-08), `tests/e2e/parent-longpress-gate.spec.ts` (AC-09 to AC-13).

## Art, animation, and audio

Not applicable beyond the progress bar. No new art, voice lines, recorded clips, or manifest rows; `src/assets` and `public/` are untouched.

- **Layout / tap targets:** the button keeps its current size; the existing pill is already above the 64 CSS px minimum for its height on the tablet viewports. The bar sits inside the button, so the target does not grow or shrink.
- **RTL:** the bar fills in the inline-start to inline-end direction, so under the Hebrew RTL shell it fills from right to left. No text.
- **World and PWA wiring:** none. `setAppScreen('parent')` is already marked unsafe for mid-game updates; the direct open uses the same screen id.

## Out of scope

- Replacing the multiplication gate, removing it, or adding a hint text that tells the parent about the long-press (see open decisions).
- A configurable hold duration in the parent settings.
- Any use of the long-press for other buttons.
- Changing the `?e2e=1` bypass.
- New hooks under `?e2e=1`.

## Open decisions for the owner

- **Open decision for the owner:** **Replace or add?** Default taken: the long-press is **added alongside** the multiplication gate (a tap still opens the multiplication gate). Reason: it is reversible and does not remove a working gate. Honest trade-off: a long-press does not need reading or arithmetic, so a persistent five-year-old who watches a parent can hold a button for 3 s, while the multiplication gate needs skills she may not have yet. Keeping both means the weaker gate is the one that decides how safe the parent area is. Recorded in `docs/PENDING-DECISIONS.md`.
- **Open decision for the owner:** **Hold duration.** Default 3 s as in the approved idea (`HOLD_DURATION_MS`). Shorter is easier for parents and for toddlers; longer is safer.
- **Open decision for the owner:** **Should the `?e2e=1` bypass also apply?** Default: the bypass is unchanged and only skips the multiplication gate on a tap; the long-press has no bypass of its own and its tests run without `?e2e=1`.
- **Open decision for the owner:** **Discoverability.** Default: no on-screen hint that the button can be held (a hint would also teach the girls). Alternative: a small line on the multiplication gate screen.
- **Open decision for the owner:** **Tap threshold.** Default 500 ms for a tap versus a cancelled hold (rule 4). Raising it makes slow taps count as taps; lowering it makes accidental half-holds more likely to be suppressed.

## Changelog

- `2026-11-13` — created from the approved idea (`docs/WORLDS.md` Infrastructure §1); tests-first slice, RED step — substantive
- `2026-11-14` — e2e spec `tests/e2e/parent-longpress-gate.spec.ts` (AC-09 to AC-13, RED), `scripts/affected-e2e.mjs` mapping for the gate, add-vs-replace logged in `docs/PENDING-DECISIONS.md`; no AC or hook changes — minor
