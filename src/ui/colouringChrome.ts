// Colouring Time DOM chrome: top bar, tool buttons, palette and the transparent page overlay.
// All Hebrew text lives here (shell rule). Geometry comes from the scene in canvas (game) units.
import { el, formatClock } from './dom';
import heStrings from '../content/i18n/he.json';
import { COLOURING_ARIA_LABELS, COLOURING_TEST_IDS, swatchTestId } from '../games/colouring/chrome';

export interface UnitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ColouringGeometry {
  page: UnitRect;
  tools: { undo: UnitRect; clear: UnitRect; prev: UnitRect; next: UnitRect };
  palette: UnitRect;
  swatches: UnitRect[];
}

export interface ColouringSwatchDef {
  id: string;
  hex: string;
}

export interface ColouringChromeOptions {
  palette: ColouringSwatchDef[];
  selected: string;
  balanceSec: number;
  low: boolean;
  /** False while time earning is paused: no countdown chip is shown. Defaults to true. */
  showTime?: boolean;
  undoEnabled: boolean;
  prevEnabled: boolean;
  nextEnabled: boolean;
  onBack: () => void;
  onHelp: () => void;
  onSwatch: (colorId: string) => void;
  onUndo: () => void;
  onClear: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Tap on the page overlay: offsets from the overlay's top-left and its CSS side. */
  onPageTap: (offsetX: number, offsetY: number, cssWidth: number, cssHeight: number) => void;
}

export type ColouringChromeState = Pick<
  ColouringChromeOptions,
  'selected' | 'balanceSec' | 'low' | 'undoEnabled' | 'prevEnabled' | 'nextEnabled'
>;

const TOOL_GLYPH = { undo: '↩️', clear: '🧽', prev: '▶️', next: '◀️' } as const;

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export class ColouringHud {
  private readonly layer: HTMLElement;
  private readonly countdown: HTMLElement;
  private readonly pageOverlay: HTMLElement;
  private readonly paletteBox: HTMLElement;
  private readonly swatchButtons = new Map<string, HTMLButtonElement>();
  private readonly toolButtons: Record<'undo' | 'clear' | 'prev' | 'next', HTMLButtonElement>;
  private readonly palette: ColouringSwatchDef[];

  constructor(private readonly root: HTMLElement, opts: ColouringChromeOptions) {
    this.palette = opts.palette;
    root.replaceChildren();
    this.layer = el('div', 'colouring-layer');
    this.layer.dir = 'rtl';
    this.layer.lang = 'he';

    this.pageOverlay = el('div', 'colouring-page');
    this.pageOverlay.dataset.testid = COLOURING_TEST_IDS.page;
    this.pageOverlay.addEventListener('pointerdown', (event) => {
      const box = this.pageOverlay.getBoundingClientRect();
      opts.onPageTap(event.clientX - box.left, event.clientY - box.top, box.width, box.height);
    });
    this.layer.appendChild(this.pageOverlay);

    const bar = el('div', 'shell-top-bar');
    const back = el('button', 'shell-pill', '⬅️');
    back.type = 'button';
    back.dataset.testid = 'hud-back';
    back.setAttribute('aria-label', COLOURING_ARIA_LABELS.home);
    back.addEventListener('click', opts.onBack);
    bar.appendChild(back);
    this.countdown = el('span', 'shell-countdown');
    this.countdown.dataset.testid = COLOURING_TEST_IDS.countdown;
    if (opts.showTime !== false) bar.appendChild(this.countdown);
    const help = el('button', 'shell-pill', `❓ ${heStrings.restaurant.helpButton}`);
    help.type = 'button';
    help.dataset.testid = 'hud-help';
    help.addEventListener('click', opts.onHelp);
    bar.appendChild(help);
    this.layer.appendChild(bar);

    const makeTool = (kind: 'undo' | 'clear' | 'prev' | 'next', handler: () => void) => {
      const b = el('button', 'colouring-tool', TOOL_GLYPH[kind]);
      b.type = 'button';
      b.dataset.testid = COLOURING_TEST_IDS[kind];
      b.setAttribute('aria-label', COLOURING_ARIA_LABELS[kind]);
      b.addEventListener('click', handler);
      this.layer.appendChild(b);
      return b;
    };
    this.toolButtons = {
      undo: makeTool('undo', opts.onUndo),
      clear: makeTool('clear', opts.onClear),
      prev: makeTool('prev', opts.onPrev),
      next: makeTool('next', opts.onNext),
    };

    this.paletteBox = el('div', 'colouring-palette');
    this.paletteBox.dataset.testid = COLOURING_TEST_IDS.palette;
    this.paletteBox.setAttribute('role', 'group');
    this.layer.appendChild(this.paletteBox);
    for (const colour of opts.palette) {
      const b = el('button', 'colouring-swatch');
      b.type = 'button';
      b.dataset.testid = swatchTestId(colour.id);
      b.setAttribute('aria-label', colour.id);
      b.style.backgroundColor = colour.hex;
      b.addEventListener('click', () => opts.onSwatch(colour.id));
      this.swatchButtons.set(colour.id, b);
      this.layer.appendChild(b);
    }

    root.appendChild(this.layer);
    this.update(opts);
  }

  update(values: ColouringChromeState): void {
    setText(this.countdown, `⏳ ${formatClock(values.balanceSec)}`);
    this.countdown.classList.toggle('low', values.low);
    this.toolButtons.undo.disabled = !values.undoEnabled;
    this.toolButtons.prev.disabled = !values.prevEnabled;
    this.toolButtons.next.disabled = !values.nextEnabled;
    for (const [id, b] of this.swatchButtons) {
      const on = id === values.selected;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('selected', on);
    }
  }

  /** Positions every element from game-unit rects, mapped through the canvas CSS box. */
  layout(geometry: ColouringGeometry, canvasBox: DOMRect | { left: number; top: number; width: number; height: number }, gameWidth: number): void {
    const rootBox = this.root.getBoundingClientRect();
    const k = canvasBox.width / gameWidth;
    const place = (node: HTMLElement, r: UnitRect, min = 0) => {
      const w = Math.max(min, r.width * k);
      const h = Math.max(min, r.height * k);
      node.style.left = `${canvasBox.left - rootBox.left + r.x * k}px`;
      node.style.top = `${canvasBox.top - rootBox.top + r.y * k}px`;
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
    };
    place(this.pageOverlay, geometry.page);
    place(this.paletteBox, geometry.palette);
    for (const kind of ['undo', 'clear', 'prev', 'next'] as const) place(this.toolButtons[kind], geometry.tools[kind], 64);
    this.palette.forEach((c, i) => {
      const b = this.swatchButtons.get(c.id);
      if (b && geometry.swatches[i]) place(b, geometry.swatches[i], 64);
    });
  }

  destroy(): void {
    this.root.replaceChildren();
  }
}

/** Time-out screen: title, message and one Home button (no restaurant button). */
export function renderColouringEndScreen(root: HTMLElement, onHome: () => void): void {
  const t = heStrings.colouring;
  const screen = el('div', 'shell-fullscreen colouring-end');
  screen.dataset.testid = COLOURING_TEST_IDS.end;
  screen.appendChild(el('h1', 'shell-title', t.endTitle));
  screen.appendChild(el('p', 'shell-title', t.endMessage));
  const home = el('button', 'shell-btn', `🏠 ${t.goHome}`);
  home.type = 'button';
  home.dataset.testid = COLOURING_TEST_IDS.endHome;
  home.setAttribute('aria-label', COLOURING_ARIA_LABELS.home);
  home.addEventListener('click', onHome);
  screen.appendChild(home);
  root.appendChild(screen);
}
