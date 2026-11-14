// Pure helper (no Phaser import) so the dispose order is unit-testable.

/** The part of Phaser's TweenManager this helper needs. */
export interface TweenKiller {
  killTweensOf(target: object): unknown;
}

/**
 * Disposes the previous plant container: stops its growth / pop-in tweens first, then destroys it,
 * so a fast tap never leaves a tween running on a destroyed object (PR #65 review).
 */
export function disposePlantView(tweens: TweenKiller, view: { destroy(): void } | undefined): void {
  if (!view) return;
  tweens.killTweensOf(view);
  view.destroy();
}
