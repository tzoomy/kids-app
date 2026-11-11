import { el } from './dom';
import { renderProfileSelect, type ProfileSelectEntry } from './profileSelect';
import { renderParentGate, renderParentSettings, type ParentSettingsCallbacks } from './parent';
import {
  renderMapChrome,
  RestaurantHud,
  BubblesHud,
  renderPromptBubble,
  clearPromptBubble,
  showHelpOverlay,
  renderBubblesEndScreen,
  showToast,
  type MapChromeOptions,
  type RestaurantChromeOptions,
  type BubblesChromeOptions,
  type RestaurantHudValues,
} from './hud';
import type { AppState } from '../core/storage/schema';

/**
 * Owns the Hebrew RTL DOM overlay. Phaser canvas handles game shapes/animation only;
 * every piece of Hebrew/bidi/EN/FR text lives here (Chrome Android canvas BiDi bugs).
 */
export class AppShell {
  private readonly overlayRoot: HTMLElement;
  private readonly chromeRoot: HTMLElement;
  private restaurantHud?: RestaurantHud;
  private bubblesHud?: BubblesHud;

  constructor(private readonly root: HTMLElement) {
    this.overlayRoot = el('div', 'shell-overlay');
    this.chromeRoot = el('div', 'shell-chrome');
    this.root.replaceChildren(this.overlayRoot, this.chromeRoot);
  }

  clearOverlay(): void {
    this.overlayRoot.replaceChildren();
  }

  clearChrome(): void {
    this.restaurantHud = undefined;
    this.bubblesHud = undefined;
    this.chromeRoot.replaceChildren();
  }

  showProfileSelect(entries: ProfileSelectEntry[], onPick: (id: string) => void, onParent: () => void): void {
    this.clearChrome();
    renderProfileSelect(this.overlayRoot, entries, onPick, onParent);
  }

  showParentGate(onSuccess: () => void, onCancel: () => void): void {
    this.clearChrome();
    renderParentGate(this.overlayRoot, onSuccess, onCancel);
  }

  showParentSettings(state: AppState, callbacks: ParentSettingsCallbacks): void {
    this.clearChrome();
    renderParentSettings(this.overlayRoot, state, callbacks);
  }

  setMapChrome(opts: MapChromeOptions): void {
    this.restaurantHud = undefined;
    this.bubblesHud = undefined;
    this.clearOverlay();
    renderMapChrome(this.chromeRoot, opts);
  }

  setRestaurantChrome(opts: RestaurantChromeOptions): void {
    this.clearOverlay();
    this.bubblesHud = undefined;
    this.restaurantHud = new RestaurantHud(this.chromeRoot, opts);
  }

  /** In-place HUD update; only changed values touch the DOM, so the prompt bubble and help card survive. */
  updateRestaurantChrome(values: Partial<RestaurantHudValues>): void {
    this.restaurantHud?.update(values);
  }

  /** Centre of the star pill in client coordinates, or undefined when it is not on screen. */
  starPillRect(): DOMRect | undefined {
    return this.chromeRoot.querySelector<HTMLElement>('[data-testid="star-count"]')?.getBoundingClientRect();
  }

  /** Short scale bump on the star pill after a star arrives. */
  bumpStarPill(peak: number): void {
    const pill = this.chromeRoot.querySelector<HTMLElement>('[data-testid="star-count"]');
    if (!pill || typeof pill.animate !== 'function') return;
    pill.animate([{ transform: 'scale(1)' }, { transform: `scale(${peak})` }, { transform: 'scale(1)' }], {
      duration: 420,
      easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
    });
  }

  setPromptBubble(text: string, onTap: () => void): void {
    renderPromptBubble(this.chromeRoot, text, onTap);
  }

  clearPromptBubble(): void {
    clearPromptBubble(this.chromeRoot);
  }

  showHelp(text: string, onClose: () => void): void {
    showHelpOverlay(this.chromeRoot, text, onClose);
  }

  setBubblesChrome(opts: BubblesChromeOptions): void {
    this.clearOverlay();
    this.restaurantHud = undefined;
    this.bubblesHud = new BubblesHud(this.chromeRoot, opts);
  }

  updateBubblesChrome(values: Pick<BubblesChromeOptions, 'balanceSec' | 'low'>): void {
    this.bubblesHud?.update(values);
  }

  showBubblesEndScreen(onRestaurant: () => void, onHome: () => void): void {
    renderBubblesEndScreen(this.overlayRoot, onRestaurant, onHome);
  }

  showToast(text: string): void {
    showToast(this.chromeRoot, text);
  }
}
