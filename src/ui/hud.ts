import { el, formatClock, clear } from './dom';
import heStrings from '../content/i18n/he.json';
import { attachLongPressInRoot, releaseLongPress } from './longPress';

export interface MapPin {
  id: string;
  label: string;
  locked: boolean;
  comingSoon?: string;
  gameX: number;
  gameY: number;
}

export interface MapChromeOptions {
  title: string;
  balanceSec: number;
  /** False while time earning is paused: no balance chip. Defaults to true. */
  showTime?: boolean;
  onParent: () => void;
  /** A 3-second hold of the parent button opens the settings directly. Without it the button only taps. */
  onParentLongPress?: () => void;
  onSwitchProfile: () => void;
  pins: MapPin[];
  canvas: HTMLCanvasElement;
  gameWidth: number;
  gameHeight: number;
}

export function renderMapChrome(root: HTMLElement, opts: MapChromeOptions): void {
  releaseLongPress(root); // the previous render's parent button (if any) is about to disappear
  clear(root);
  const bar = el('div', 'shell-top-bar');
  const parentBtn = el('button', 'shell-pill', `🔒 ${heStrings.parentArea}`);
  parentBtn.dataset.testid = 'parent-gate-btn';
  if (opts.onParentLongPress) attachLongPressInRoot(root, parentBtn, { onTap: opts.onParent, onLongPress: opts.onParentLongPress });
  else parentBtn.addEventListener('click', opts.onParent);
  bar.appendChild(parentBtn);
  bar.appendChild(el('span', 'shell-map-title', opts.title));
  const right = el('div', 'shell-row');
  right.style.gap = '1vmin';
  const homeBtn = el('button', 'shell-pill', `🏠 ${heStrings.home}`);
  homeBtn.dataset.testid = 'switch-profile-btn';
  homeBtn.addEventListener('click', opts.onSwitchProfile);
  right.appendChild(homeBtn);
  const balance = el('span', 'shell-pill', `⏳ ${formatClock(opts.balanceSec)}`);
  balance.dataset.testid = 'leisure-balance';
  if (opts.showTime !== false) right.appendChild(balance);
  bar.appendChild(right);
  root.appendChild(bar);
  renderMapPins(root, opts);
}

export function renderMapPins(root: HTMLElement, opts: Pick<MapChromeOptions, 'pins' | 'canvas' | 'gameWidth' | 'gameHeight'>): void {
  root.querySelectorAll('.shell-map-pin').forEach((n) => n.remove());
  const canvasRect = opts.canvas.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  for (const pin of opts.pins) {
    const node = el('div', `shell-map-pin${pin.locked ? ' is-locked' : ''}`);
    node.dataset.worldId = pin.id;
    node.appendChild(el('span', 'shell-map-pin-label', pin.label));
    if (pin.comingSoon) node.appendChild(el('span', 'shell-map-pin-soon', pin.comingSoon));
    const left = canvasRect.left - rootRect.left + (pin.gameX / opts.gameWidth) * canvasRect.width;
    const top = canvasRect.top - rootRect.top + (pin.gameY / opts.gameHeight) * canvasRect.height;
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    root.appendChild(node);
  }
}

export interface RestaurantChromeOptions {
  starCount: number;
  balanceSec: number;
  earnedTodaySec: number;
  dailyCapSec: number;
  /** False while time earning is paused: no balance chip and no earned-today progress. Defaults to true. */
  showTime?: boolean;
  onBack: () => void;
  onHelp: () => void;
}

export type RestaurantHudValues = Pick<RestaurantChromeOptions, 'starCount' | 'balanceSec' | 'earnedTodaySec' | 'dailyCapSec'>;

/** Set text only when it changed, so the browser does not restart anything needlessly. */
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Top bar of the restaurant. Built once; update() touches only what changed. */
export class RestaurantHud {
  private readonly stars: HTMLElement;
  private readonly balance: HTMLElement;
  private readonly fill: HTMLElement;

  constructor(root: HTMLElement, opts: RestaurantChromeOptions) {
    clear(root);
    const bar = el('div', 'shell-top-bar');
    const backBtn = el('button', 'shell-pill', '⬅️');
    backBtn.dataset.testid = 'hud-back';
    backBtn.addEventListener('click', opts.onBack);
    bar.appendChild(backBtn);

    const progress = el('div', 'shell-progress');
    this.fill = el('div');
    progress.appendChild(this.fill);
    if (opts.showTime !== false) bar.appendChild(progress);

    const right = el('div', 'shell-row');
    right.style.gap = '1vmin';
    this.stars = el('span', 'shell-pill');
    this.stars.dataset.testid = 'star-count';
    right.appendChild(this.stars);
    this.balance = el('span', 'shell-pill');
    this.balance.dataset.testid = 'leisure-balance';
    if (opts.showTime !== false) right.appendChild(this.balance);
    const helpBtn = el('button', 'shell-pill', `❓ ${heStrings.restaurant.helpButton}`);
    helpBtn.dataset.testid = 'hud-help';
    helpBtn.addEventListener('click', opts.onHelp);
    right.appendChild(helpBtn);
    bar.appendChild(right);
    root.appendChild(bar);
    this.update(opts);
  }

  update(values: Partial<RestaurantHudValues>): void {
    if (values.starCount !== undefined) setText(this.stars, `⭐ ${values.starCount}`);
    if (values.balanceSec !== undefined) setText(this.balance, `⏳ ${formatClock(values.balanceSec)}`);
    if (values.earnedTodaySec !== undefined && values.dailyCapSec !== undefined) {
      const width = `${Math.min(100, (values.earnedTodaySec / Math.max(1, values.dailyCapSec)) * 100)}%`;
      if (this.fill.style.width !== width) this.fill.style.width = width;
    }
  }
}

export function renderPromptBubble(root: HTMLElement, text: string, onTap: () => void): void {
  let bubble = root.querySelector<HTMLDivElement>('.shell-prompt-bubble');
  if (!bubble) {
    bubble = el('div', 'shell-prompt-bubble ltr-isolate');
    bubble.dataset.testid = 'prompt-bubble';
    root.appendChild(bubble);
  }
  bubble.textContent = `${text} 🔊`;
  bubble.onclick = onTap;
}

export function clearPromptBubble(root: HTMLElement): void {
  root.querySelector('.shell-prompt-bubble')?.remove();
}

export function showToast(root: HTMLElement, text: string): void {
  const toast = el('div', 'shell-pill', text);
  toast.style.position = 'absolute';
  toast.style.top = '50%';
  toast.style.left = '50%';
  toast.style.transform = 'translate(-50%, -50%)';
  toast.style.fontSize = 'clamp(18px, 4vmin, 32px)';
  root.appendChild(toast);
  window.setTimeout(() => toast.remove(), 1400);
}

/** Optional page-CSS-pixel rectangle the help overlay must not cover (e.g. the speaker button). */
export interface HelpOverlayAvoid {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function showHelpOverlay(root: HTMLElement, text: string, onClose: () => void, avoid?: HelpOverlayAvoid): void {
  const overlay = el('div', 'shell-help-overlay');
  // The overlay (outside the card) is the close target, so it carries the close test id.
  overlay.dataset.testid = 'help-card-close';
  if (avoid) {
    const gap = 12;
    const rootBox = root.getBoundingClientRect();
    const top = Math.max(0, avoid.y + avoid.height + gap - rootBox.top);
    overlay.style.top = `${top}px`;
  }
  const card = el('div', 'shell-card', text);
  card.dataset.testid = 'help-card';
  // "Tap anywhere outside the card closes"; a tap on the card itself must not close it.
  card.addEventListener('click', (event) => event.stopPropagation());
  overlay.appendChild(card);
  overlay.addEventListener('click', () => {
    overlay.remove();
    onClose();
  });
  root.appendChild(overlay);
}

export interface BubblesChromeOptions {
  balanceSec: number;
  low: boolean;
  /** False while time earning is paused: no countdown chip is shown. Defaults to true. */
  showTime?: boolean;
  onBack: () => void;
}

/** Bubbles top bar. Built once; update() changes only the countdown text and low flag. */
export class BubblesHud {
  private readonly countdown: HTMLElement;

  constructor(root: HTMLElement, opts: BubblesChromeOptions) {
    clear(root);
    const bar = el('div', 'shell-top-bar');
    const backBtn = el('button', 'shell-pill', '⬅️');
    backBtn.dataset.testid = 'hud-back';
    backBtn.addEventListener('click', opts.onBack);
    bar.appendChild(backBtn);
    this.countdown = el('span', 'shell-countdown');
    this.countdown.dataset.testid = 'bubbles-countdown';
    if (opts.showTime !== false) bar.appendChild(this.countdown);
    root.appendChild(bar);
    this.update(opts);
  }

  update(values: Pick<BubblesChromeOptions, 'balanceSec' | 'low'>): void {
    setText(this.countdown, `⏳ ${formatClock(values.balanceSec)}`);
    this.countdown.classList.toggle('low', values.low);
  }
}

export function renderBubblesEndScreen(root: HTMLElement, onRestaurant: () => void, onHome: () => void): void {
  const t = heStrings.bubbles;
  const screen = el('div', 'shell-fullscreen');
  screen.appendChild(el('h1', 'shell-title', t.endTitle));
  screen.appendChild(el('p', 'shell-title', t.endMessage));
  const row = el('div', 'shell-row');
  const toRestaurant = el('button', 'shell-btn', `🍽️ ${t.goToRestaurant}`);
  toRestaurant.addEventListener('click', onRestaurant);
  const toHome = el('button', 'shell-btn', `🏠 ${t.goHome}`);
  toHome.addEventListener('click', onHome);
  row.appendChild(toRestaurant);
  row.appendChild(toHome);
  screen.appendChild(row);
  root.appendChild(screen);
}
