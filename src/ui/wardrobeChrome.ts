// Wardrobe DOM chrome: back button, item buttons and the unlock toast. All Hebrew text lives here (shell rule).
// Spec: docs/specs/wardrobe.md. Test ids are frozen there.
import { el } from './dom';
import heStrings from '../content/i18n/he.json';
import { assetUrl } from '../anim/assetLoader';
import { findItem } from '../core/wardrobe/model';

export interface WardrobeItemView {
  id: string;
  locked: boolean;
  worn: boolean;
}

export interface WardrobeChromeOptions {
  items: WardrobeItemView[];
  onBack: () => void;
  onItem: (itemId: string) => void;
}

const TOAST_MS = 3000;

function itemName(id: string): string {
  return (heStrings.wardrobe.items as Record<string, string>)[id] ?? id;
}

function itemImageUrl(id: string): string | null {
  const item = findItem(id);
  return item ? assetUrl(import.meta.env.BASE_URL, item.url) : null;
}

export class WardrobeHud {
  private readonly layer: HTMLElement;
  private readonly list: HTMLElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();

  constructor(root: HTMLElement, opts: WardrobeChromeOptions) {
    root.replaceChildren();
    this.layer = el('div', 'wardrobe-layer');
    const bar = el('div', 'shell-top-bar');
    const back = el('button', 'shell-pill', '⬅️');
    back.dataset.testid = 'hud-back';
    back.addEventListener('click', opts.onBack);
    bar.appendChild(back);
    bar.appendChild(el('span', 'shell-map-title', heStrings.wardrobe.title));
    // Keeps the title centred between the back button and an empty slot.
    bar.appendChild(el('span'));
    this.layer.appendChild(bar);

    this.list = el('div', 'wardrobe-items');
    for (const view of opts.items) {
      const button = el('button', 'wardrobe-item');
      button.dataset.testid = `wardrobe-item-${view.id}`;
      button.setAttribute('aria-label', itemName(view.id));
      const url = itemImageUrl(view.id);
      if (url) {
        const img = el('img');
        img.src = url;
        img.alt = '';
        img.draggable = false;
        button.appendChild(img);
      }
      button.appendChild(el('span', 'wardrobe-lock'));
      button.addEventListener('click', () => {
        if (button.dataset.locked === 'true') return;
        opts.onItem(view.id);
      });
      this.buttons.set(view.id, button);
      this.list.appendChild(button);
    }
    this.layer.appendChild(this.list);
    root.appendChild(this.layer);
    this.update(opts.items);
  }

  /** Locked and worn flags only; the buttons are never rebuilt. */
  update(items: readonly WardrobeItemView[]): void {
    for (const view of items) {
      const button = this.buttons.get(view.id);
      if (!button) continue;
      button.dataset.locked = String(view.locked);
      button.dataset.worn = String(view.worn);
      button.setAttribute('aria-pressed', String(view.worn));
      const lock = button.querySelector('.wardrobe-lock');
      if (lock) lock.textContent = view.locked ? '🔒' : '';
    }
  }

  /** Centre of an item button in client coordinates (for hooks), or null. */
  itemRect(itemId: string): DOMRect | null {
    return this.buttons.get(itemId)?.getBoundingClientRect() ?? null;
  }

  destroy(): void {
    this.layer.remove();
    this.buttons.clear();
  }
}

/** Short unlock celebration on top of whatever screen is open. Removes itself; never blocks taps. */
export function showWardrobeUnlockToast(root: HTMLElement, itemIds: readonly string[]): void {
  if (itemIds.length === 0) return;
  root.querySelector('[data-testid="wardrobe-unlock-toast"]')?.remove();
  const toast = el('div', 'wardrobe-toast');
  toast.dataset.testid = 'wardrobe-unlock-toast';
  toast.dataset.items = itemIds.join(',');
  const url = itemImageUrl(itemIds[0]);
  if (url) {
    const img = el('img');
    img.src = url;
    img.alt = '';
    toast.appendChild(img);
  }
  toast.appendChild(el('span', undefined, `🎁 ${heStrings.wardrobe.unlockToast}`));
  root.appendChild(toast);
  window.setTimeout(() => toast.remove(), TOAST_MS);
}
