// Sticker Board DOM chrome: top bar, transparent board overlay, tray, backgrounds,
// crayons, tools, age-5 request bubble, and inline-SVG album modal.
// All Hebrew text lives here (shell rule). Geometry comes from the scene in game units.
import { el, formatClock } from './dom';
import { assetUrl } from '../anim/assetLoader';
import { stickerBoardAssetPath } from '../assets/art/stickerBoardManifest';
import heStrings from '../content/i18n/he.json';
import type { Board } from '../games/stickers/board';
import type { StickerBoardGeometry, UnitRect } from '../games/stickers/layout';
import type { StickerAgeTrack } from '../games/stickers/types';

export interface StickerTrayItem {
  id: string;
  artKey: string;
}

export interface StickerBgItem {
  id: string;
}

export interface StickerCrayonItem {
  id: string;
  hex: string;
}

export interface StickerBoardChromeOptions {
  ageTrack: StickerAgeTrack;
  baseUrl: string;
  stickers: StickerTrayItem[];
  backgrounds: StickerBgItem[];
  crayons: StickerCrayonItem[];
  selectedBackground: string;
  selectedColor: string;
  undoEnabled: boolean;
  requestsEnabled: boolean;
  requestStickerArtKey: string | null;
  showTime: boolean;
  balanceSec: number;
  onBack: () => void;
  onHelp: () => void;
  onSelectTraySticker: (stickerId: string) => void;
  onSelectBackground: (backgroundId: string) => void;
  onSelectCrayon: (colorId: string) => void;
  onUndo: () => void;
  onClear: () => void;
  onSave: () => void;
  onOpenAlbum: () => void;
  onSelectAlbumItem: (index: number) => void;
  onToggleRequests: () => void;
  onRepeatRequest: () => void;
  onBoardPointerDown: (offsetX: number, offsetY: number, cssWidth: number, cssHeight: number) => void;
  onBoardPointerMove: (offsetX: number, offsetY: number, cssWidth: number, cssHeight: number) => void;
  onBoardPointerUp: (offsetX: number, offsetY: number, cssWidth: number, cssHeight: number) => void;
  onBoardPointerCancel: () => void;
}

export type StickerBoardChromeState = Pick<
  StickerBoardChromeOptions,
  'selectedBackground' | 'selectedColor' | 'undoEnabled' | 'requestsEnabled' | 'requestStickerArtKey' | 'balanceSec'
>;

const SVG_NS = 'http://www.w3.org/2000/svg';
const BG_ICON: Record<string, string> = { space: '🚀', jungle: '🌴', beach: '🏖️' };

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

export class StickerBoardHud {
  private readonly layer: HTMLElement;
  private readonly countdown?: HTMLElement;
  private readonly boardOverlay: HTMLElement;
  private readonly trayButtons: HTMLButtonElement[] = [];
  private readonly bgButtons = new Map<string, HTMLButtonElement>();
  private readonly crayonButtons = new Map<string, HTMLButtonElement>();
  private readonly undoBtn: HTMLButtonElement;
  private readonly clearBtn: HTMLButtonElement;
  private readonly saveBtn?: HTMLButtonElement;
  private readonly albumBtn?: HTMLButtonElement;
  private readonly requestToggleBtn?: HTMLButtonElement;
  private readonly requestBubble?: HTMLButtonElement;
  private readonly requestImg?: HTMLImageElement;
  private readonly albumModal?: HTMLElement;
  private readonly albumGrid?: HTMLElement;
  private readonly baseUrl: string;
  private readonly crayonHexById = new Map<string, string>();
  private readonly stickerArtById = new Map<string, string>();
  private readonly onSelectAlbumItem: (index: number) => void;
  private activePointerId: number | null = null;

  constructor(private readonly root: HTMLElement, opts: StickerBoardChromeOptions) {
    this.baseUrl = opts.baseUrl;
    this.onSelectAlbumItem = opts.onSelectAlbumItem;
    for (const c of opts.crayons) this.crayonHexById.set(c.id, c.hex);
    for (const s of opts.stickers) this.stickerArtById.set(s.id, s.artKey);

    const t = heStrings.stickerBoard;
    root.replaceChildren();
    this.layer = el('div', 'sticker-layer');
    this.layer.dir = 'rtl';
    this.layer.lang = 'he';

    this.boardOverlay = el('div', 'sticker-board');
    this.boardOverlay.dataset.testid = 'sticker-board';
    this.wireBoardPointerEvents(opts);
    this.layer.appendChild(this.boardOverlay);

    const bar = el('div', 'shell-top-bar');
    const back = el('button', 'shell-pill', '⬅️');
    back.type = 'button';
    back.dataset.testid = 'hud-back';
    back.setAttribute('aria-label', t.home);
    back.addEventListener('click', opts.onBack);
    bar.appendChild(back);

    if (opts.showTime) {
      this.countdown = el('span', 'shell-countdown');
      this.countdown.dataset.testid = 'sticker-countdown';
      bar.appendChild(this.countdown);
    }

    const help = el('button', 'shell-pill', `❓ ${heStrings.restaurant.helpButton}`);
    help.type = 'button';
    help.dataset.testid = 'hud-help';
    help.setAttribute('aria-label', heStrings.restaurant.helpButton);
    help.addEventListener('click', opts.onHelp);
    bar.appendChild(help);
    this.layer.appendChild(bar);

    for (const bg of opts.backgrounds) {
      const b = el('button', 'sticker-tool sticker-bg-btn', BG_ICON[bg.id] ?? '🖼️');
      b.type = 'button';
      b.dataset.testid = `sticker-bg-${bg.id}`;
      b.setAttribute('aria-label', (t.backgrounds as Record<string, string>)[bg.id] ?? bg.id);
      b.addEventListener('click', () => opts.onSelectBackground(bg.id));
      this.bgButtons.set(bg.id, b);
      this.layer.appendChild(b);
    }

    this.undoBtn = this.makeTool('sticker-undo', '↩️', t.undo, opts.onUndo);
    this.clearBtn = this.makeTool('sticker-clear', '🧽', t.clear, opts.onClear);

    if (opts.ageTrack === 'age5') {
      this.saveBtn = this.makeTool('sticker-save', '💾', t.save, opts.onSave);
      this.albumBtn = this.makeTool('sticker-album', '🖼️', t.album, opts.onOpenAlbum);
      this.requestToggleBtn = this.makeTool(
        'sticker-request-toggle',
        '🔊',
        t.requestToggle,
        opts.onToggleRequests,
      );

      this.requestBubble = el('button', 'sticker-request');
      this.requestBubble.type = 'button';
      this.requestBubble.dataset.testid = 'sticker-request';
      this.requestBubble.setAttribute('aria-label', t.requestRepeat);
      this.requestImg = el('img', 'sticker-request-img');
      this.requestImg.alt = '';
      this.requestImg.draggable = false;
      this.requestBubble.appendChild(this.requestImg);
      this.requestBubble.appendChild(el('span', 'sticker-request-speaker', '🔊'));
      this.requestBubble.addEventListener('click', opts.onRepeatRequest);
      this.layer.appendChild(this.requestBubble);

      this.albumModal = el('div', 'sticker-album-view hidden');
      this.albumModal.dataset.testid = 'sticker-album-view';
      const panel = el('div', 'sticker-album-panel');
      const header = el('div', 'sticker-album-header');
      header.appendChild(el('h2', 'sticker-album-title', t.albumTitle));
      const closeBtn = el('button', 'sticker-tool sticker-album-close', '✕');
      closeBtn.type = 'button';
      closeBtn.dataset.testid = 'sticker-album-close';
      closeBtn.setAttribute('aria-label', t.albumClose);
      closeBtn.addEventListener('click', () => this.hideAlbum());
      header.appendChild(closeBtn);
      panel.appendChild(header);
      this.albumGrid = el('div', 'sticker-album-grid');
      panel.appendChild(this.albumGrid);
      panel.addEventListener('click', (e) => e.stopPropagation());
      this.albumModal.addEventListener('click', () => this.hideAlbum());
      this.albumModal.appendChild(panel);
      this.layer.appendChild(this.albumModal);
    }

    for (const c of opts.crayons) {
      const b = el('button', 'sticker-crayon');
      b.type = 'button';
      b.dataset.testid = `sticker-crayon-${c.id}`;
      b.setAttribute('aria-label', (t.crayons as Record<string, string>)[c.id] ?? c.id);
      b.style.backgroundColor = c.hex;
      b.addEventListener('click', () => opts.onSelectCrayon(c.id));
      this.crayonButtons.set(c.id, b);
      this.layer.appendChild(b);
    }

    for (const s of opts.stickers) {
      const b = el('button', 'sticker-tray-btn');
      b.type = 'button';
      b.dataset.testid = `sticker-tray-${s.id}`;
      b.setAttribute('aria-label', (t.stickers as Record<string, string>)[s.id] ?? s.id);
      const img = el('img', 'sticker-tray-img');
      img.src = assetUrl(this.baseUrl, stickerBoardAssetPath(s.artKey));
      img.alt = '';
      img.draggable = false;
      b.appendChild(img);
      b.addEventListener('click', () => opts.onSelectTraySticker(s.id));
      this.trayButtons.push(b);
      this.layer.appendChild(b);
    }

    root.appendChild(this.layer);
    this.update(opts);
  }

  private makeTool(testId: string, glyph: string, label: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', 'sticker-tool', glyph);
    b.type = 'button';
    b.dataset.testid = testId;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    this.layer.appendChild(b);
    return b;
  }

  private wireBoardPointerEvents(opts: StickerBoardChromeOptions): void {
    const coords = (event: PointerEvent) => {
      const box = this.boardOverlay.getBoundingClientRect();
      return {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
        w: box.width,
        h: box.height,
      };
    };

    this.boardOverlay.addEventListener('pointerdown', (event) => {
      if (this.activePointerId !== null) return;
      this.activePointerId = event.pointerId;
      try {
        this.boardOverlay.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic events or non-supporting environments may skip capture.
      }
      const c = coords(event);
      opts.onBoardPointerDown(c.x, c.y, c.w, c.h);
    });

    this.boardOverlay.addEventListener('pointermove', (event) => {
      if (this.activePointerId !== event.pointerId) return;
      const c = coords(event);
      opts.onBoardPointerMove(c.x, c.y, c.w, c.h);
    });

    const finish = (event: PointerEvent, cancel: boolean) => {
      if (this.activePointerId !== event.pointerId) return;
      this.activePointerId = null;
      try {
        if (this.boardOverlay.hasPointerCapture?.(event.pointerId)) {
          this.boardOverlay.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore release errors when pointer was not captured.
      }
      if (cancel) {
        opts.onBoardPointerCancel();
      } else {
        const c = coords(event);
        opts.onBoardPointerUp(c.x, c.y, c.w, c.h);
      }
    };

    this.boardOverlay.addEventListener('pointerup', (event) => finish(event, false));
    this.boardOverlay.addEventListener('pointercancel', (event) => finish(event, true));
  }

  update(values: StickerBoardChromeState): void {
    if (this.countdown) {
      setText(this.countdown, `⏳ ${formatClock(values.balanceSec)}`);
    }
    this.undoBtn.disabled = !values.undoEnabled;

    for (const [id, b] of this.bgButtons) {
      const on = id === values.selectedBackground;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('selected', on);
    }

    for (const [id, b] of this.crayonButtons) {
      const on = id === values.selectedColor;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('selected', on);
    }

    if (this.requestToggleBtn) {
      this.requestToggleBtn.setAttribute('aria-pressed', String(values.requestsEnabled));
      this.requestToggleBtn.classList.toggle('selected', values.requestsEnabled);
      setText(this.requestToggleBtn, values.requestsEnabled ? '🔊' : '🔇');
    }

    if (this.requestBubble && this.requestImg) {
      const visible = values.requestsEnabled && values.requestStickerArtKey !== null;
      this.requestBubble.classList.toggle('hidden', !visible);
      if (visible && values.requestStickerArtKey) {
        const nextSrc = assetUrl(this.baseUrl, stickerBoardAssetPath(values.requestStickerArtKey));
        if (this.requestImg.getAttribute('src') !== nextSrc) {
          this.requestImg.src = nextSrc;
        }
      }
    }
  }

  /** Shows the age-5 album overlay with inline SVG thumbnails for each saved board. */
  showAlbum(album: readonly Board[]): void {
    if (!this.albumModal || !this.albumGrid) return;
    this.albumGrid.replaceChildren();
    if (album.length === 0) {
      this.albumGrid.appendChild(el('p', 'sticker-album-empty', heStrings.stickerBoard.albumEmpty));
    } else {
      album.forEach((board, index) => {
        const btn = el('button', 'sticker-album-item');
        btn.type = 'button';
        btn.dataset.testid = `sticker-album-item-${index}`;
        btn.setAttribute('aria-label', `${heStrings.stickerBoard.album} ${index + 1}`);
        btn.appendChild(this.renderThumbnailSvg(board));
        btn.addEventListener('click', () => {
          this.hideAlbum();
          this.onSelectAlbumItem(index);
        });
        this.albumGrid!.appendChild(btn);
      });
    }
    this.albumModal.classList.remove('hidden');
  }

  hideAlbum(): void {
    this.albumModal?.classList.add('hidden');
  }

  private renderThumbnailSvg(board: Board): SVGSVGElement {
    const W = 320;
    const H = 200;
    const svg = svgEl('svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'sticker-album-svg');

    const bg = svgEl('image');
    bg.setAttribute('href', assetUrl(this.baseUrl, stickerBoardAssetPath(`sticker-board-bg-${board.backgroundId}-landscape`)));
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(W));
    bg.setAttribute('height', String(H));
    bg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.appendChild(bg);

    for (const stroke of board.strokes) {
      const hex = this.crayonHexById.get(stroke.colorId) ?? '#E2554F';
      if (stroke.points.length === 2) {
        const dot = svgEl('circle');
        dot.setAttribute('cx', (stroke.points[0] * W).toFixed(1));
        dot.setAttribute('cy', (stroke.points[1] * H).toFixed(1));
        dot.setAttribute('r', '2.5');
        dot.setAttribute('fill', hex);
        svg.appendChild(dot);
      } else if (stroke.points.length >= 4) {
        const poly = svgEl('polyline');
        const pts: string[] = [];
        for (let i = 0; i + 1 < stroke.points.length; i += 2) {
          pts.push(`${(stroke.points[i] * W).toFixed(1)},${(stroke.points[i + 1] * H).toFixed(1)}`);
        }
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', hex);
        poly.setAttribute('stroke-width', '5');
        poly.setAttribute('stroke-linecap', 'round');
        poly.setAttribute('stroke-linejoin', 'round');
        poly.setAttribute('points', pts.join(' '));
        svg.appendChild(poly);
      }
    }

    for (const placed of board.stickers) {
      const artKey = this.stickerArtById.get(placed.stickerId);
      if (!artKey) continue;
      const img = svgEl('image');
      img.setAttribute('href', assetUrl(this.baseUrl, stickerBoardAssetPath(artKey)));
      img.setAttribute('x', (placed.x * W - 16).toFixed(1));
      img.setAttribute('y', (placed.y * H - 16).toFixed(1));
      img.setAttribute('width', '32');
      img.setAttribute('height', '32');
      svg.appendChild(img);
    }

    return svg;
  }

  /** Positions every element from game-unit rects, mapped through the canvas CSS box. */
  layout(
    geometry: StickerBoardGeometry,
    canvasBox: DOMRect | { left: number; top: number; width: number; height: number },
    gameWidth: number,
  ): void {
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

    place(this.boardOverlay, geometry.board);
    this.trayButtons.forEach((b, i) => {
      if (geometry.tray[i]) place(b, geometry.tray[i], 64);
    });
    let bgIndex = 0;
    for (const b of this.bgButtons.values()) {
      if (geometry.backgrounds[bgIndex]) place(b, geometry.backgrounds[bgIndex], 64);
      bgIndex++;
    }
    let crayonIndex = 0;
    for (const b of this.crayonButtons.values()) {
      if (geometry.crayons[crayonIndex]) place(b, geometry.crayons[crayonIndex], 64);
      crayonIndex++;
    }
    place(this.undoBtn, geometry.tools.undo, 64);
    place(this.clearBtn, geometry.tools.clear, 64);
    if (this.saveBtn && geometry.tools.save) place(this.saveBtn, geometry.tools.save, 64);
    if (this.albumBtn && geometry.tools.album) place(this.albumBtn, geometry.tools.album, 64);
    if (this.requestToggleBtn && geometry.tools.requestToggle) {
      place(this.requestToggleBtn, geometry.tools.requestToggle, 64);
    }
    if (this.requestBubble && geometry.requestBubble) {
      place(this.requestBubble, geometry.requestBubble, 64);
    }
  }

  destroy(): void {
    this.root.replaceChildren();
  }
}
