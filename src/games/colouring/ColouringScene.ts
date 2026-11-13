// ColouringScene: Colouring Time (Leisure Corner). Spec: docs/specs/leisure-colouring.md.
// Contract: docs/contracts/leisure-colouring.md.
//
// STATUS: TDD step 1 STUB. It boots, calls setAppScreen('colouring'), and reports
// `getColouringInfo() === null`. There is no gameplay yet; the Pass 1 AC tests fail against it
// on purpose.
//
// CONTRACT (implement against the tests; do not change these without a spec change):
// - Scene key: 'ColouringScene'. Opened from the Leisure Corner picker card
//   `game-picker-leisure-colouring` (the building must not jump here directly).
// - create() calls setAppScreen('colouring') and sets window.__GAME_READY__ = true.
// - `getColouringInfo(): ColouringInfo | null` (./types.ts). Rectangles are page CSS px.
//   Return null when the scene has no page yet. `ended` is true on the time-out end screen.
// - Hooks live in src/game/createGame.ts under ?e2e=1: `getColouringInfo()` and
//   `seedColouringState({ pageId, fills? })`. They only read or seed state.
// - Chrome test ids: hud-back, hud-help, colouring-countdown, colouring-page, colouring-undo,
//   colouring-clear, colouring-prev, colouring-next, colouring-palette, colouring-swatch-<colorId>,
//   colouring-end, colouring-end-home.
// - Pages and backgrounds load through COLOURING_ART_MANIFEST when this scene opens, never
//   via PreloadScene / ART_MANIFEST (AC-34).
// - Pure rules live in ./regions.ts (replace the STUB bodies, keep signatures). Motion knobs
//   come from ANIM_PROFILE.colouring via ./colouringMotion.ts. Autosave is src/core/colouring/store.ts.
//
// Implement create(), layout, art, taps, palette, tools, leisure tick, animations and voice
// in THIS file (plus helpers under src/games/colouring/). Do not edit types.ts, the hook
// signatures, tests/**/leisure-colouring*, or the content JSON/schema without a matching spec change.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { setAppScreen } from '../../pwa';
import type { ColouringInfo } from './types';

export type { ColouringInfo, ColouringRegionInfo, ColouringSeed, PageRect } from './types';

export class ColouringScene extends Phaser.Scene {
  private context!: AppContext;

  constructor() {
    super('ColouringScene');
  }

  create(): void {
    setAppScreen('colouring');
    this.context = this.game.registry.get('appContext') as AppContext;
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0xfffdf9);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.context.audio.stopAll());
    window.__GAME_READY__ = true;
  }

  /** STUB: no page is shown yet, so the hook reports null and AC tests fail on assertions. */
  getColouringInfo(): ColouringInfo | null {
    return null;
  }
}
