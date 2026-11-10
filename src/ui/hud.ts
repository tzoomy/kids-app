import { el, formatClock, clear } from './dom';
import heStrings from '../content/i18n/he.json';

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
  onParent: () => void;
  onSwitchProfile: () => void;
  pins: MapPin[];
  canvas: HTMLCanvasElement;
  gameWidth: number;
  gameHeight: number;
}

export function renderMapChrome(root: HTMLElement, opts: MapChromeOptions): void {
  clear(root);
  const bar = el('div', 'shell-top-bar');
  const parentBtn = el('button', 'shell-pill', `🔒 ${heStrings.parentArea}`);
  parentBtn.dataset.testid = 'parent-gate-btn';
  parentBtn.addEventListener('click', opts.onParent);
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
  right.appendChild(balance);
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
  onBack: () => void;
  onHelp: () => void;
}

export function renderRestaurantChrome(root: HTMLElement, opts: RestaurantChromeOptions): void {
  clear(root);
  const bar = el('div', 'shell-top-bar');
  const backBtn = el('button', 'shell-pill', '⬅️');
  backBtn.addEventListener('click', opts.onBack);
  bar.appendChild(backBtn);

  const progress = el('div', 'shell-progress');
  const fill = el('div');
  fill.style.width = `${Math.min(100, (opts.earnedTodaySec / Math.max(1, opts.dailyCapSec)) * 100)}%`;
  progress.appendChild(fill);
  bar.appendChild(progress);

  const right = el('div', 'shell-row');
  right.style.gap = '1vmin';
  right.appendChild(el('span', 'shell-pill', `⭐ ${opts.starCount}`));
  const balance = el('span', 'shell-pill', `⏳ ${formatClock(opts.balanceSec)}`);
  balance.dataset.testid = 'leisure-balance';
  right.appendChild(balance);
  const helpBtn = el('button', 'shell-pill', `❓ ${heStrings.restaurant.helpButton}`);
  helpBtn.addEventListener('click', opts.onHelp);
  right.appendChild(helpBtn);
  bar.appendChild(right);

  root.appendChild(bar);
}

export function renderPromptBubble(root: HTMLElement, text: string, onTap: () => void): void {
  let bubble = root.querySelector<HTMLDivElement>('.shell-prompt-bubble');
  if (!bubble) {
    bubble = el('div', 'shell-prompt-bubble ltr-isolate');
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

export function showHelpOverlay(root: HTMLElement, text: string, onClose: () => void): void {
  const overlay = el('div', 'shell-help-overlay');
  const card = el('div', 'shell-card', text);
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
  onBack: () => void;
}

export function renderBubblesChrome(root: HTMLElement, opts: BubblesChromeOptions): void {
  clear(root);
  const bar = el('div', 'shell-top-bar');
  const backBtn = el('button', 'shell-pill', '⬅️');
  backBtn.addEventListener('click', opts.onBack);
  bar.appendChild(backBtn);
  const countdown = el('span', `shell-countdown${opts.low ? ' low' : ''}`, `⏳ ${formatClock(opts.balanceSec)}`);
  bar.appendChild(countdown);
  root.appendChild(bar);
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
