// Mission 1.1 success flow timing (docs/specs/mystery-egg.md AC-26): when the Continue button appears. Pure, no Phaser.
// Team-lead default, Maor can override (docs/PENDING-DECISIONS.md): the child hears the whole Bravo line before the tap can skip it.

/** Never sooner than this after the success line is requested (the old fixed delay: the feather has just landed). */
export const CONTINUE_MIN_DELAY_MS = 700;
/** A short breath after the Bravo line ends. */
export const CONTINUE_AFTER_VO_MS = 250;
/**
 * Safe fallback: Continue appears this long after the success line was requested even if the line never ends. The line
 * waits for the cat's clip (6.0 s at 1.0x, 5.0 s at the in-game 1.2x) and then plays 3.4 s (2.8 s at 1.2x), so a healthy run
 * ends about 4.5 s after the request; 8 s leaves 3.5 s of slack.
 */
export const SUCCESS_VO_CAP_MS = 8000;

/**
 * Calls `show` once: `CONTINUE_AFTER_VO_MS` after `voice` settles (played out, chime, or failed) but not before
 * `CONTINUE_MIN_DELAY_MS`, and at the latest at `SUCCESS_VO_CAP_MS`. A missing clip settles at once, so the
 * placeholder path shows Continue after the minimum delay. Whichever path wins clears the other timer, and the returned
 * `cancel` (call it when the scene shuts down) clears both: nothing fires afterwards.
 */
export function showContinueAfterVoice(voice: Promise<unknown>, show: () => void): () => void {
  let done = false;
  let afterVoice: ReturnType<typeof setTimeout> | undefined;
  const finish = (): void => {
    done = true;
    clearTimeout(cap);
    clearTimeout(afterVoice);
  };
  const fire = (): void => {
    if (done) return;
    finish();
    show();
  };
  const cap = setTimeout(fire, SUCCESS_VO_CAP_MS);
  const started = Date.now();
  const settled = (): void => {
    if (done) return;
    const wait = Math.max(CONTINUE_AFTER_VO_MS, CONTINUE_MIN_DELAY_MS - (Date.now() - started));
    afterVoice = setTimeout(fire, wait);
  };
  voice.then(settled, settled);
  return finish;
}
