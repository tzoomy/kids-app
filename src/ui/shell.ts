import { el } from './dom';
import { renderProfileSelect, type ProfileSelectEntry } from './profileSelect';
import { renderCredits } from './credits';
import type { CreditItem } from '../content/credits';
import { renderParentGate, renderParentSettings, type ParentSettingsCallbacks } from './parent';
import {
  renderMapChrome,
  RestaurantHud,
  BubblesHud,
  renderPromptBubble,
  clearPromptBubble,
  showHelpOverlay,
  type HelpOverlayAvoid,
  renderBubblesEndScreen,
  showToast,
  type MapChromeOptions,
  type RestaurantChromeOptions,
  type BubblesChromeOptions,
  type RestaurantHudValues,
} from './hud';
import { ColouringHud, renderColouringEndScreen, type ColouringChromeOptions } from './colouringChrome';
import { StickerBoardHud, type StickerBoardChromeOptions } from './stickerBoardChrome';
import { renderGamePicker, type GamePickerOptions } from './picker/gamePicker';
import { WardrobeHud, showWardrobeUnlockToast, type WardrobeChromeOptions } from './wardrobeChrome';
import type { AppState } from '../core/storage/schema';

/**
 * Owns the Hebrew RTL DOM overlay. Phaser canvas handles game shapes/animation only;
 * every piece of Hebrew/bidi/EN/FR text lives here (Chrome Android canvas BiDi bugs).
 */
export class AppShell {
  private readonly overlayRoot: HTMLElement;
  private readonly chromeRoot: HTMLElement;
  private readonly pickerRoot: HTMLElement;
  /** Own root, so chrome repaints and scene changes never wipe the wardrobe unlock toast. */
  private readonly toastRoot: HTMLElement;
  private restaurantHud?: RestaurantHud;
  private bubblesHud?: BubblesHud;
  private colouringHud?: ColouringHud;
  private stickerBoardHud?: StickerBoardHud;
  private wardrobeHud?: WardrobeHud;

  constructor(private readonly root: HTMLElement) {
    this.overlayRoot = el('div', 'shell-overlay');
    this.chromeRoot = el('div', 'shell-chrome');
    // Own root, so map-chrome repaints (resize) never wipe an open picker.
    this.pickerRoot = el('div', 'shell-picker-root');
    this.toastRoot = el('div', 'shell-toast-root');
    this.root.replaceChildren(this.overlayRoot, this.chromeRoot, this.pickerRoot, this.toastRoot);
  }

  /** Wardrobe chrome (back button and item buttons). Replaces any other chrome. */
  setWardrobeChrome(opts: WardrobeChromeOptions): WardrobeHud {
    this.clearOverlay();
    this.restaurantHud = undefined;
    this.bubblesHud = undefined;
    this.colouringHud = undefined;
    this.stickerBoardHud = undefined;
    this.wardrobeHud = new WardrobeHud(this.chromeRoot, opts);
    return this.wardrobeHud;
  }

  /** In-place update of the item buttons' locked and worn flags. */
  updateWardrobeChrome(items: Parameters<WardrobeHud['update']>[0]): void {
    this.wardrobeHud?.update(items);
  }

  /** "You got a new item!" toast for newly unlocked wardrobe items. */
  showWardrobeUnlockToast(itemIds: readonly string[]): void {
    showWardrobeUnlockToast(this.toastRoot, itemIds);
  }

  /** Opens the Language House game picker over the map. Replaces any picker already open. */
  showGamePicker(opts: GamePickerOptions): void {
    this.pickerRoot.replaceChildren(renderGamePicker(opts));
  }

  hideGamePicker(): void {
    this.pickerRoot.replaceChildren();
  }

  clearOverlay(): void {
    this.overlayRoot.replaceChildren();
  }

  clearChrome(): void {
    this.hideGamePicker();
    this.restaurantHud = undefined;
    this.bubblesHud = undefined;
    this.colouringHud = undefined;
    this.stickerBoardHud = undefined;
    this.wardrobeHud = undefined;
    this.chromeRoot.replaceChildren();
  }

  showProfileSelect(
    entries: ProfileSelectEntry[],
    onPick: (id: string) => void,
    onParent: () => void,
    onParentLongPress?: () => void,
  ): void {
    this.clearChrome();
    renderProfileSelect(this.overlayRoot, entries, onPick, onParent, onParentLongPress);
  }

  showParentGate(onSuccess: () => void, onCancel: () => void): void {
    this.clearChrome();
    renderParentGate(this.overlayRoot, onSuccess, onCancel);
  }

  showCredits(items: readonly CreditItem[], onBack: () => void): void {
    this.clearChrome();
    renderCredits(this.overlayRoot, items, onBack);
  }

  showParentSettings(state: AppState, callbacks: ParentSettingsCallbacks): void {
    this.clearChrome();
    renderParentSettings(this.overlayRoot, state, callbacks);
  }

  setMapChrome(opts: MapChromeOptions): void {
    this.restaurantHud = undefined;
    this.bubblesHud = undefined;
    this.colouringHud = undefined;
    this.stickerBoardHud = undefined;
    this.wardrobeHud = undefined;
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

  showHelp(text: string, onClose: () => void, avoid?: HelpOverlayAvoid): void {
    showHelpOverlay(this.chromeRoot, text, onClose, avoid);
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

  /** Colouring Time chrome (top bar, tools, palette, page overlay). Replaces any other chrome. */
  setColouringChrome(opts: ColouringChromeOptions): ColouringHud {
    this.clearOverlay();
    this.restaurantHud = undefined;
    this.bubblesHud = undefined;
    this.colouringHud = new ColouringHud(this.chromeRoot, opts);
    return this.colouringHud;
  }

  /** Removes the colouring chrome so only the time-out screen stays interactive. */
  clearColouringChrome(): void {
    this.colouringHud?.destroy();
    this.colouringHud = undefined;
  }

  showColouringEndScreen(onHome: () => void): void {
    renderColouringEndScreen(this.overlayRoot, onHome);
  }

  /** Sticker Board chrome (top bar, board overlay, tray, backgrounds, crayons, tools, album). */
  setStickerBoardChrome(opts: StickerBoardChromeOptions): StickerBoardHud {
    this.clearOverlay();
    this.restaurantHud = undefined;
    this.bubblesHud = undefined;
    this.colouringHud = undefined;
    this.wardrobeHud = undefined;
    this.stickerBoardHud = new StickerBoardHud(this.chromeRoot, opts);
    return this.stickerBoardHud;
  }

  /** Removes the Sticker Board chrome. */
  clearStickerBoardChrome(): void {
    this.stickerBoardHud?.destroy();
    this.stickerBoardHud = undefined;
  }

  showToast(text: string): void {
    showToast(this.chromeRoot, text);
  }
}
