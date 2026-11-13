// ColouringScene: Colouring Time (Leisure Corner). Spec: docs/specs/leisure-colouring.md (Pass 1).
// Contract: docs/contracts/leisure-colouring.md.
//
// - Pages and backgrounds load through COLOURING_ART_MANIFEST when this scene opens (never at boot, AC-34).
// - The page is pre-segmented: region paths come from the page SVG; taps resolve with Path2D.isPointInPath
//   (regions.hitTest) in viewBox units. Fills are painted into a canvas texture under the multiplied line art.
// - Time is spent only through LeisureSession (1 s tick, 5 s grace, endedNow).
// - Hooks live in src/game/createGame.ts under ?e2e=1 (getColouringInfo, seedColouringState).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { setAppScreen } from '../../pwa';
import { queueArtManifest, assetUrl } from '../../anim/assetLoader';
import { COLOURING_ART_MANIFEST } from '../../assets/art/colouringManifest';
import { transitionTo } from '../../anim/transitions';
import { isReducedMotion } from '../../anim/motion';
import { gameRectToPageRect } from '../../testing/pageRect';
import { loadColouringState, saveColouringState, type ColouringSave } from '../../core/colouring/store';
import type { SpeechRequest } from '../../core/audio/types';
import type { LeisureSession } from '../../core/leisure';
import type { ColouringGeometry, ColouringHud } from '../../ui/colouringChrome';
import heStrings from '../../content/i18n/he.json';
import { effectiveColour, type ColouringRegionDef } from './regions';
import type { VuRect } from './pageGeometry';
import { chooseTapPoint, createPageTester, parsePageSvg, VIEWBOX, type PageGeometry, type PageTester } from './pageGeometry';
import { measureDecorations } from './decorations';
import { computeColouringLayout } from './layout';
import { fillPulse } from './colouringMotion';
import { COLOURING_VOICE } from './voice';
import type { ColouringAgeTrack, ColouringInfo, PageRect, ColouringRegionInfo } from './types';

export type { ColouringInfo, ColouringRegionInfo, ColouringSeed, PageRect } from './types';

const LOW_BALANCE_WARNING_SEC = 30;
const UNDO_CAP = 50;
const SNAP_CSS_PX = 20;
const FILL_TEXTURE = 'colouring-fill-layer';
const PAPER = '#FFFDF9';

interface PageData {
  geometry: PageGeometry;
  tester: PageTester;
  tapPoints: Map<string, { x: number; y: number }>;
}

type Fills = Record<string, string>;

function baseSize(): { width: number; height: number } {
  return window.innerWidth >= window.innerHeight ? { width: 1280, height: 800 } : { width: 800, height: 1280 };
}

export class ColouringScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LeisureSession;
  private hud?: ColouringHud;
  private profileId = '';
  private ageTrack: ColouringAgeTrack = 'age5';
  private save!: ColouringSave;
  private pageIndex = 0;
  private selectedColor = 'red';
  private undoStack: Fills[] = [];
  private regionDefs: ColouringRegionDef[] = [];
  private pages = new Map<string, PageData>();
  private pageDefs = new Map<string, ColouringRegionDef[]>();
  private ready = false;
  private ended = false;
  private warnedLow = false;
  private alive = false;
  private geometry!: ColouringGeometry;
  private visuals: Phaser.GameObjects.GameObject[] = [];
  /** Craft-prop bboxes per background key, in that SVG's viewBox units (hook data only). */
  private decorations = new Map<string, Array<{ id: string; rect: VuRect }>>();
  private fillCanvas?: Phaser.Textures.CanvasTexture;
  private pulse: { regionId: string; alpha: number } | null = null;
  private tickTimer?: Phaser.Time.TimerEvent;
  private visibilityHandler?: () => void;
  private resizeHandler?: () => void;

  constructor() {
    super('ColouringScene');
  }

  create(): void {
    setAppScreen('colouring');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.profileId = this.context.requireProfileId();
    this.ageTrack = this.context.currentAgeTrack();
    this.session = this.context.createLeisureSession();
    this.ready = false;
    this.ended = false;
    this.warnedLow = false;
    this.alive = true;
    this.pages = new Map();
    this.pageDefs = new Map();
    this.undoStack = [];
    this.visuals = [];
    this.pulse = null;
    this.hud = undefined;

    const content = this.context.content.colouring;
    this.selectedColor = content.defaultColor;
    this.save = loadColouringState(window.localStorage, this.profileId);
    this.pageIndex = Math.max(0, content.pages.findIndex((p) => p.id === this.save.currentPageId));

    this.syncOrientation();
    this.cameras.main.setBackgroundColor('#fff4e6');

    this.visibilityHandler = () => {
      this.session.setHidden(document.hidden);
      if (document.hidden) this.context.audio.stopAll();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.resizeHandler = () => this.syncOrientation();
    window.addEventListener('resize', this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.buildChrome();
    this.tickTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    void this.say(COLOURING_VOICE.intro);

    this.loadArt(() => void this.loadAllPages());
    window.__GAME_READY__ = true;
  }

  // ---------------------------------------------------------------- lifecycle

  private cleanup(): void {
    this.alive = false;
    this.context.audio.stopAll();
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.textures.exists(FILL_TEXTURE)) this.textures.remove(FILL_TEXTURE);
    this.fillCanvas = undefined;
    this.ready = false;
  }

  private say(request: SpeechRequest): Promise<boolean> {
    return this.alive ? this.context.audio.play({ ...request }) : Promise.resolve(false);
  }

  /** Lazy-loads the pages and the backgrounds (only the active orientation's), once, when the scene opens. */
  private loadArt(done: () => void): void {
    const queued = queueArtManifest(this, COLOURING_ART_MANIFEST, import.meta.env.BASE_URL, this.scale.width >= this.scale.height);
    if (queued === 0) {
      done();
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done();
    };
    this.load.once(Phaser.Loader.Events.COMPLETE, finish);
    this.load.start();
  }

  /** Follows device rotation: the canvas is resized to the matching base size, then everything is re-laid out. */
  private syncOrientation(): void {
    const want = baseSize();
    if (this.scale.width !== want.width || this.scale.height !== want.height) {
      this.scale.setGameSize(want.width, want.height);
      this.scale.refresh();
      if (this.ready) {
        this.relayout();
        queueArtManifest(this, COLOURING_ART_MANIFEST, import.meta.env.BASE_URL, want.width >= want.height);
        if (this.load.list.size > 0) {
          this.load.once(Phaser.Loader.Events.COMPLETE, () => this.relayout());
          this.load.start();
        }
      }
    } else if (this.ready) {
      this.positionChrome();
    }
  }

  // ---------------------------------------------------------------- state helpers

  private get pageId(): string {
    return this.context.content.colouring.pages[this.pageIndex].id;
  }

  private get fills(): Fills {
    return this.save.pages[this.pageId] ?? {};
  }

  private paletteForTrack() {
    return this.context.content.colouring.palette.filter((c) => (this.ageTrack === 'age2' ? c.age2 : c.age5));
  }

  private persistSave(): void {
    this.save.currentPageId = this.pageId;
    saveColouringState(window.localStorage, this.profileId, this.save);
  }

  private setFills(fills: Fills): void {
    this.save.pages[this.pageId] = { ...fills };
    this.persistSave();
    this.redraw();
    this.refreshChrome();
  }

  // ---------------------------------------------------------------- chrome

  private buildChrome(): void {
    const palette = this.paletteForTrack();
    this.geometry = computeColouringLayout(this.scale.width, this.scale.height, palette.length);
    this.hud = this.context.shell.setColouringChrome({
      palette: palette.map((c) => ({ id: c.id, hex: c.hex })),
      selected: this.selectedColor,
      balanceSec: this.session.balanceSec,
      low: this.isLow(),
      undoEnabled: false,
      prevEnabled: false,
      nextEnabled: false,
      onBack: () => this.goBack(),
      onHelp: () => this.showHelp(),
      onSwatch: (id) => {
        if (this.ended) return;
        this.selectedColor = id;
        this.context.sfx.tap();
        this.refreshChrome();
      },
      onUndo: () => this.undo(),
      onClear: () => this.clearPage(),
      onPrev: () => this.changePage(-1),
      onNext: () => this.changePage(1),
      onPageTap: (x, y, w, h) => this.onPageTap(x, y, w, h),
    });
    this.positionChrome();
  }

  private positionChrome(): void {
    this.hud?.layout(this.geometry, this.game.canvas.getBoundingClientRect(), this.scale.width);
  }

  private refreshChrome(): void {
    const pages = this.context.content.colouring.pages;
    this.hud?.update({
      selected: this.selectedColor,
      balanceSec: this.session.balanceSec,
      low: this.isLow(),
      undoEnabled: this.undoStack.length > 0 && !this.ended,
      prevEnabled: this.pageIndex > 0 && !this.ended,
      nextEnabled: this.pageIndex < pages.length - 1 && !this.ended,
    });
  }

  private isLow(): boolean {
    return this.session.balanceSec <= LOW_BALANCE_WARNING_SEC;
  }

  private showHelp(): void {
    if (this.ended) return;
    this.context.sfx.tap();
    this.context.shell.showHelp(heStrings.colouring.helpText, () => this.context.audio.stopAll());
    void this.say(COLOURING_VOICE.help);
  }

  private goBack(): void {
    this.persistSave();
    this.context.store.persist();
    transitionTo(this, 'MapScene', { style: 'iris' });
  }

  // ---------------------------------------------------------------- page

  /** Fetches and parses every page once, so a page change is synchronous and the hook is never null mid-session. */
  private async loadAllPages(): Promise<void> {
    const pages = this.context.content.colouring.pages;
    const parsed = await Promise.all(
      pages.map(async (def) => {
        const defs: ColouringRegionDef[] = def.regions.map((r) => ({ id: r.id, age2: r.age2, parent: r.parent }));
        const geometry = parsePageSvg(await this.fetchSvg(def.id), defs.map((r) => r.id));
        return { id: def.id, defs, geometry };
      }),
    );
    const bgs = await Promise.all(
      COLOURING_ART_MANIFEST.filter((e) => e.key.startsWith('leisure-colouring-bg-')).map(async (e) => {
        try {
          const text = await (await fetch(assetUrl(import.meta.env.BASE_URL, e.url))).text();
          return [e.key, measureDecorations(text)] as const;
        } catch {
          return [e.key, [] as Array<{ id: string; rect: VuRect }>] as const;
        }
      }),
    );
    if (!this.alive) return;
    for (const [key, list] of bgs) this.decorations.set(key, list);
    for (const { id, defs, geometry } of parsed) {
      this.pageDefs.set(id, defs);
      this.pages.set(id, { geometry, tester: createPageTester(geometry, defs, this.ageTrack), tapPoints: new Map() });
    }
    this.showPage();
  }

  private showPage(): void {
    this.regionDefs = this.pageDefs.get(this.pageId) ?? [];
    if (!this.fillCanvas) {
      if (this.textures.exists(FILL_TEXTURE)) this.textures.remove(FILL_TEXTURE);
      this.fillCanvas = this.textures.createCanvas(FILL_TEXTURE, VIEWBOX, VIEWBOX) ?? undefined;
    }
    this.ready = true;
    this.relayout();
    this.refreshChrome();
  }

  private async fetchSvg(pageId: string): Promise<string> {
    const entry = COLOURING_ART_MANIFEST.find((e) => e.key === `colouring-page-${pageId}`);
    if (!entry) throw new Error(`No colouring art for page ${pageId}`);
    const response = await fetch(assetUrl(import.meta.env.BASE_URL, entry.url));
    return response.text();
  }

  private currentPage(): PageData | undefined {
    return this.pages.get(this.pageId);
  }

  /** Rebuilds the canvas objects and repositions the DOM chrome for the current orientation. */
  private relayout(): void {
    if (!this.alive) return;
    const palette = this.paletteForTrack();
    this.geometry = computeColouringLayout(this.scale.width, this.scale.height, palette.length);
    for (const obj of this.visuals) obj.destroy();
    this.visuals = [];
    const { width, height } = this.scale;
    const landscape = width >= height;
    const bgKey = landscape ? 'leisure-colouring-bg-landscape' : 'leisure-colouring-bg-portrait';
    if (this.textures.exists(bgKey)) {
      this.visuals.push(this.add.image(width / 2, height / 2, bgKey).setDisplaySize(width, height).setDepth(0));
    }
    const p = this.geometry.page;
    if (this.fillCanvas) {
      this.visuals.push(this.add.image(p.x, p.y, FILL_TEXTURE).setOrigin(0, 0).setDisplaySize(p.width, p.height).setDepth(1));
    }
    const lineKey = `colouring-page-${this.pageId}`;
    if (this.textures.exists(lineKey)) {
      // Multiplied over the colour layer: the page's paper-coloured fills tint nothing, the outlines stay dark.
      this.visuals.push(
        this.add.image(p.x, p.y, lineKey).setOrigin(0, 0).setDisplaySize(p.width, p.height).setDepth(2).setBlendMode(Phaser.BlendModes.MULTIPLY),
      );
    }
    this.redraw();
    this.positionChrome();
  }

  /** Repaints the colour layer: every region in SVG order with its effective colour. Only runs when a fill changes. */
  private redraw(): void {
    const data = this.currentPage();
    const canvas = this.fillCanvas;
    if (!data || !canvas) return;
    const ctx = canvas.getContext();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, VIEWBOX, VIEWBOX);
    const hexOf = new Map(this.context.content.colouring.palette.map((c) => [c.id, c.hex]));
    const fills = this.fills;
    for (const region of this.regionDefs) {
      const path = data.geometry.paths.get(region.id);
      if (!path) continue;
      const colorId = effectiveColour(region.id, fills, this.regionDefs);
      const hex = colorId === PAPER ? PAPER : (hexOf.get(colorId) ?? PAPER);
      ctx.fillStyle = hex;
      // The flash is clipped to the region path (Path2D fill), never scaled past the outline.
      ctx.globalAlpha = this.pulse?.regionId === region.id ? this.pulse.alpha : 1;
      ctx.fill(path);
    }
    ctx.globalAlpha = 1;
    canvas.refresh();
  }

  // ---------------------------------------------------------------- input

  private onPageTap(offsetX: number, offsetY: number, cssWidth: number, cssHeight: number): void {
    if (this.ended || !this.ready) return;
    const data = this.currentPage();
    if (!data || cssWidth <= 0) return;
    const vx = (offsetX / cssWidth) * VIEWBOX;
    const vy = (offsetY / cssHeight) * VIEWBOX;
    const snapRadiusVu = (SNAP_CSS_PX / cssWidth) * VIEWBOX;
    const regionId = data.tester.resolve(vx, vy, snapRadiusVu);
    if (!regionId) return;
    this.fillRegion(regionId);
  }

  private pushUndo(): void {
    this.undoStack.push({ ...this.fills });
    if (this.undoStack.length > UNDO_CAP) this.undoStack.shift();
  }

  private fillRegion(regionId: string): void {
    this.pushUndo();
    this.context.sfx.pop();
    this.startPulse(regionId);
    this.setFills({ ...this.fills, [regionId]: this.selectedColor });
  }

  private startPulse(regionId: string): void {
    const pulse = fillPulse(isReducedMotion());
    if (pulse.durationMs <= 0) {
      this.pulse = null;
      return;
    }
    this.pulse = { regionId, alpha: pulse.flashFrom };
    this.tweens.addCounter({
      from: pulse.flashFrom,
      to: pulse.flashTo,
      duration: pulse.durationMs,
      onUpdate: (tween) => {
        if (this.pulse?.regionId !== regionId) return;
        this.pulse.alpha = tween.getValue() ?? 1;
        this.redraw();
      },
      onComplete: () => {
        if (this.pulse?.regionId === regionId) this.pulse = null;
        this.redraw();
      },
    });
  }

  private undo(): void {
    if (this.ended || this.undoStack.length === 0) return;
    const previous = this.undoStack.pop() as Fills;
    this.context.sfx.tap();
    this.pulse = null;
    this.setFills(previous);
  }

  private clearPage(): void {
    if (this.ended) return;
    this.context.sfx.tap();
    if (Object.keys(this.fills).length === 0) return;
    this.pushUndo();
    this.pulse = null;
    this.setFills({});
  }

  private changePage(delta: number): void {
    if (this.ended) return;
    const pages = this.context.content.colouring.pages;
    const next = this.pageIndex + delta;
    if (next < 0 || next >= pages.length) return;
    this.context.sfx.tap();
    this.persistSave();
    this.pageIndex = next;
    this.undoStack = [];
    this.pulse = null;
    this.persistSave();
    this.refreshChrome();
    this.showPage();
  }

  // ---------------------------------------------------------------- time

  private tick(): void {
    if (this.ended) return;
    const result = this.session.tick(1);
    this.context.store.persist();
    this.refreshChrome();
    if (!this.warnedLow && this.isLow() && !result.endedNow) {
      this.warnedLow = true;
      void this.say(COLOURING_VOICE.lowWarning);
    }
    if (result.endedNow) this.endSession();
  }

  private endSession(): void {
    this.ended = true;
    this.tickTimer?.remove();
    this.persistSave();
    this.context.store.persist();
    this.context.sfx.end();
    this.context.audio.stopAll();
    void this.say(COLOURING_VOICE.end);
    this.context.shell.clearColouringChrome();
    this.context.shell.showColouringEndScreen(() => transitionTo(this, 'MapScene', { style: 'iris' }));
  }

  // ---------------------------------------------------------------- e2e hook data

  /** ColouringInfo while a page is shown (null before it is ready). Rectangles are page CSS px. */
  getColouringInfo(): ColouringInfo | null {
    if (!this.alive || !this.ready) return null;
    const data = this.currentPage();
    if (!data) return null;
    this.syncOrientation();
    const box = this.game.canvas.getBoundingClientRect();
    const canvasRect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const size = { width: this.scale.width, height: this.scale.height };
    const page = this.geometry.page;
    const pageRect = gameRectToPageRect(page, canvasRect, size);
    const k = pageRect.width / VIEWBOX;
    const regions: ColouringRegionInfo[] = [];
    for (const def of this.regionDefs) {
      if (this.ageTrack === 'age2' && !def.age2) continue;
      const bbox = data.geometry.bboxes.get(def.id);
      if (!bbox) continue;
      let tap = data.tapPoints.get(def.id);
      if (!tap) {
        tap = chooseTapPoint(def.id, bbox, data.tester);
        data.tapPoints.set(def.id, tap);
      }
      regions.push({
        id: def.id,
        hit: { x: pageRect.x + bbox.x * k, y: pageRect.y + bbox.y * k, width: bbox.width * k, height: bbox.height * k },
        tapPoint: { x: pageRect.x + tap.x * k, y: pageRect.y + tap.y * k },
      });
    }
    return {
      pageId: this.pageId,
      pageIndex: this.pageIndex,
      selectedColor: this.selectedColor,
      fills: { ...this.fills },
      undoCount: this.undoStack.length,
      ageTrack: this.ageTrack,
      balanceSec: this.session.balanceSec,
      inGrace: this.session.isInGrace,
      ended: this.ended,
      pageRect,
      pageSide: pageRect.width,
      regions,
      decorations: this.decorationRects(canvasRect, size),
      chromeButtons: this.chromeButtonRects(),
    };
  }

  private decorationRects(canvasRect: PageRect, size: { width: number; height: number }): Array<{ id: string; rect: PageRect }> {
    const landscape = size.width >= size.height;
    const key = landscape ? 'leisure-colouring-bg-landscape' : 'leisure-colouring-bg-portrait';
    // The background image is stretched to the canvas; the SVG viewBox equals the game size at the base sizes.
    const vb = landscape ? { width: 1280, height: 800 } : { width: 800, height: 1280 };
    const sx = size.width / vb.width;
    const sy = size.height / vb.height;
    return (this.decorations.get(key) ?? []).map(({ id, rect }) => ({
      id,
      rect: gameRectToPageRect({ x: rect.x * sx, y: rect.y * sy, width: rect.width * sx, height: rect.height * sy }, canvasRect, size),
    }));
  }

  /** DOM chrome buttons in page CSS px (the elements the child actually taps). */
  private chromeButtonRects(): Array<{ id: string; rect: PageRect }> {
    const out: Array<{ id: string; rect: PageRect }> = [];
    for (const el of document.querySelectorAll<HTMLElement>('.colouring-layer button[data-testid]')) {
      const b = el.getBoundingClientRect();
      out.push({ id: el.dataset.testid ?? '', rect: { x: b.left, y: b.top, width: b.width, height: b.height } });
    }
    return out;
  }
}
