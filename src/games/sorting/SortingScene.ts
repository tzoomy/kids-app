// SortingScene: Sorting Beds (Number Garden). Spec: docs/specs/sorting-beds.md. Contract: docs/contracts/sorting-beds.md.
//
// STATUS: TDD step 1 STUB. It boots, shows chrome (hud-back / hud-help) and a flat background, and reports
// `getSortingInfo() === null`. There is no gameplay yet; the Pass 1 AC tests fail against it on purpose.
//
// CONTRACT (implement against the tests; do not change these without a spec change):
// - Scene key: 'SortingScene'. Started from MapScene when the world's `entryGameId` is 'sorting-beds'.
// - create() calls setAppScreen('sorting') and sets window.__GAME_READY__ = true.
// - `getSortingInfo(): SortingInfo | null` (src/games/sorting/types.ts). Rectangles are page CSS px (see
//   src/testing/pageRect.ts, `gameRectToPageRect`). Return null when no round exists; `ready` is true only
//   when the current flower is in the basket and bed taps are accepted.
// - Hooks live in src/game/createGame.ts under ?e2e=1: `getSortingInfo()` and `seedSortingLevel(level)`.
//   They only read or seed state; they never act in the game or navigate.
// - Chrome test ids: hud-back, hud-help, prompt-bubble, help-card, help-card-close (RestaurantHud, renderPromptBubble,
//   showHelpOverlay via context.shell). star-count and leisure-balance come from the same HUD.
// - Pure rules live in ./sortingLogic.ts (replace the STUB bodies, keep signatures). Phaser motion helpers import
//   ANIM_PROFILE.sorting from src/anim/profiles.ts.
// - Tap targets: beds and the basket flower are at least 64 CSS px in both orientations; never shrink them.
// - One tap on a bed places the current flower (no select step). A wrong tap leaves the flower in the basket and
//   locks bed taps for WRONG_TAP_LOCK_MS. Tapping the basket flower replays the rule line and is not a hint.
//
// Implement create(), layout, art, taps, hints, animations, voice and trial recording in THIS file (plus helpers
// under src/games/sorting/). Do not edit types.ts, the hook signatures, tests/**/sorting-beds*, or the content
// JSON/schema without a matching spec change.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { transitionTo } from '../../anim/transitions';
import { setAppScreen } from '../../pwa';
import type { SortingInfo } from './types';

export type { SortingInfo, SortingBedInfo, SortingCurrentItem, SortRule, SortAttribute, FlowerColor, FlowerShape, FlowerSize, PageRect } from './types';

export class SortingScene extends Phaser.Scene {
  private context!: AppContext;

  constructor() {
    super('SortingScene');
  }

  create(): void {
    setAppScreen('sorting');
    this.context = this.game.registry.get('appContext') as AppContext;
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0xd9f0c8);

    const state = this.context.store.getProfileState(this.context.requireProfileId(), new Date(this.context.nowMs()));
    const settings = this.context.store.getState().settings;
    this.context.shell.setRestaurantChrome({
      starCount: state.stars,
      balanceSec: state.balanceSec,
      earnedTodaySec: state.earnedTodaySec,
      dailyCapSec: settings.dailyEarnCapMinutes * 60,
      onBack: () => this.goBack(),
      onHelp: () => undefined, // STUB: the help card and `sorting.help.he` are implemented with the game
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.context.audio.stopAll());
    window.__GAME_READY__ = true;
  }

  /** STUB: no round exists yet, so the hook reports null and AC tests fail on assertions. */
  getSortingInfo(): SortingInfo | null {
    return null;
  }

  private goBack(): void {
    this.context.audio.stopAll();
    this.context.store.persist();
    this.context.shell.clearPromptBubble();
    transitionTo(this, 'MapScene', { style: 'iris' });
  }
}
