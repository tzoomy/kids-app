import { el } from './dom';
import { renderProfileSelect, type ProfileSelectEntry } from './profileSelect';
import { renderParentGate, renderParentSettings, type ParentSettingsCallbacks } from './parent';
import {
  renderMapChrome,
  renderRestaurantChrome,
  renderPromptBubble,
  clearPromptBubble,
  showHelpOverlay,
  renderBubblesChrome,
  renderBubblesEndScreen,
  showToast,
  type MapChromeOptions,
  type RestaurantChromeOptions,
  type BubblesChromeOptions,
} from './hud';
import type { AppState } from '../core/storage/schema';

/**
 * Owns the Hebrew RTL DOM overlay. Phaser canvas handles game shapes/animation only;
 * every piece of Hebrew/bidi/EN/FR text lives here (Chrome Android canvas BiDi bugs).
 */
export class AppShell {
  private readonly overlayRoot: HTMLElement;
  private readonly chromeRoot: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    this.overlayRoot = el('div', 'shell-overlay');
    this.chromeRoot = el('div', 'shell-chrome');
    this.root.replaceChildren(this.overlayRoot, this.chromeRoot);
  }

  clearOverlay(): void {
    this.overlayRoot.replaceChildren();
  }

  clearChrome(): void {
    this.chromeRoot.replaceChildren();
  }

  showProfileSelect(entries: ProfileSelectEntry[], onPick: (id: string) => void, onParent: () => void): void {
    this.clearChrome();
    renderProfileSelect(this.overlayRoot, entries, onPick, onParent);
  }

  showParentGate(onSuccess: () => void, onCancel: () => void): void {
    renderParentGate(this.overlayRoot, onSuccess, onCancel);
  }

  showParentSettings(state: AppState, callbacks: ParentSettingsCallbacks): void {
    renderParentSettings(this.overlayRoot, state, callbacks);
  }

  setMapChrome(opts: MapChromeOptions): void {
    this.clearOverlay();
    renderMapChrome(this.chromeRoot, opts);
  }

  setRestaurantChrome(opts: RestaurantChromeOptions): void {
    this.clearOverlay();
    renderRestaurantChrome(this.chromeRoot, opts);
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
    renderBubblesChrome(this.chromeRoot, opts);
  }

  showBubblesEndScreen(onRestaurant: () => void, onHome: () => void): void {
    renderBubblesEndScreen(this.overlayRoot, onRestaurant, onHome);
  }

  showToast(text: string): void {
    showToast(this.chromeRoot, text);
  }
}
