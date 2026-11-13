// Pure rules for when the restaurant speaks Hebrew narrator lines. No Phaser, unit-testable.

/** A Hebrew praise line follows the thanks line only on every Nth correct answer of a visit. */
export const PRAISE_EVERY = 3;

/** `correctCount` is the number of correct answers so far in this visit, including the current one. */
export function shouldPraise(correctCount: number): boolean {
  return correctCount > 0 && correctCount % PRAISE_EVERY === 0;
}

/** The Hebrew "try again" line is spoken only on the first wrong try of a round. */
export function shouldSayRetry(wrongTriesInRound: number): boolean {
  return wrongTriesInRound === 1;
}

/** True when the balance crossed into a higher whole minute (e.g. 0:59 -> 1:00). */
export function crossedWholeMinute(prevBalanceSec: number, balanceSec: number): boolean {
  return Math.floor(balanceSec / 60) > Math.floor(prevBalanceSec / 60);
}

/** The text bubble repeats the request visually; a voice-only level (`audio-only`) shows none. */
export function showsPromptBubble(audioOnly: boolean): boolean {
  return !audioOnly;
}
