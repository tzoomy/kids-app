// StickerBoardScene: Art Studio free-creation sticker & finger-drawing board (Pass 1).
// Spec: docs/specs/sticker-board.md.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { setAppScreen } from '../../pwa';
import { queueArtManifest } from '../../anim/assetLoader';
import { STICKER_BOARD_ART_MANIFEST } from '../../assets/art/stickerBoardManifest';
import { transitionTo } from '../../anim/transitions';
import { popIn, pressSquash } from '../../anim/tweens';
import { Juice } from '../../anim/juice';
import { gameRectToPageRect } from '../../testing/pageRect';
import type { SpeechRequest } from '../../core/audio/types';
import type { LearningSession } from '../../core/leisure';
import {
  addToAlbum,
  loadStickerBoardState,
  saveStickerBoardState,
  type StickerBoardSave,
} from '../../core/stickers/store';
import type { StickerBoardHud } from '../../ui/stickerBoardChrome';
import {
  addSticker,
  clearBoard,
  cloneBoard,
  extendStroke,
  hitSticker,
  moveSticker,
  startStroke,
  TAP_SLOP_CSS,
  undoKeepingBackground,
  UndoStack,
  type Board,
} from './board';
import { runTeardown } from './teardown';
import { computeStickerBoardLayout, type StickerBoardGeometry } from './layout';
import { stickerLeisureMode } from './leisure';
import { isRequestMet, pickRequest, requestLine, type StickerRequest } from './request';
import { STICKER_VOICE } from './voice';
import type {
  PageRect,
  PlacedStickerInfo,
  StickerAgeTrack,
  StickerBoardInfo,
} from './types';

function baseSize(): { width: number; height: number } {
  return window.innerWidth >= window.innerHeight ? { width: 1280, height: 800 } : { width: 800, height: 1280 };
}

type DragState =
  | {
      kind: 'sticker';
      index: number;
      stickerId: string;
      startCssX: number;
      startCssY: number;
      pointerOffsetX: number;
      pointerOffsetY: number;
      moved: boolean;
      snapshot: Board;
    }
  | {
      kind: 'stroke';
      snapshot: Board;
    };

export class StickerBoardScene extends Phaser.Scene {
  private context!: AppContext;
  private profileId = '';
  private ageTrack: StickerAgeTrack = 'age5';
  private save!: StickerBoardSave;
  private board!: Board;
  private selectedColor = 'red';
  private undoStack = new UndoStack();
  private hud?: StickerBoardHud;
  private geometry!: StickerBoardGeometry;
  private learningSession?: LearningSession;

  private bgImage?: Phaser.GameObjects.Image;
  private strokeGraphics?: Phaser.GameObjects.Graphics;
  private stickerImages: Phaser.GameObjects.Image[] = [];

  private dragState: DragState | null = null;
  private ready = false;
  private alive = false;

  private requestsEnabled = false;
  private requestIndex = 0;
  private previousStickerId: string | null = null;
  private currentRequest: StickerRequest | null = null;
  private requestsMet = 0;
  private nextRequestTimer?: Phaser.Time.TimerEvent;
  private speakSeq = 0;

  private tickTimer?: Phaser.Time.TimerEvent;
  private visibilityHandler?: () => void;
  private resizeHandler?: () => void;

  constructor() {
    super('StickerBoardScene');
  }

  create(): void {
    setAppScreen('stickers');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.profileId = this.context.requireProfileId();
    this.ageTrack = this.context.currentAgeTrack();

    const content = this.context.content.stickers;
    this.save = loadStickerBoardState(window.localStorage, this.profileId);
    this.board = cloneBoard(this.save.current);
    this.selectedColor = content.defaultColor;
    this.undoStack = new UndoStack();
    this.dragState = null;
    this.ready = false;
    this.alive = true;

    this.requestsEnabled = this.ageTrack === 'age5';
    this.requestIndex = 0;
    this.previousStickerId = null;
    this.currentRequest = null;
    this.requestsMet = 0;
    this.nextRequestTimer = undefined;
    this.speakSeq = 0;

    this.stickerImages = [];
    this.bgImage = undefined;
    this.strokeGraphics = undefined;
    this.hud = undefined;

    const leisureMode = stickerLeisureMode(content.earnsLeisure, this.context.isTimeEarningEnabled());
    if (leisureMode === 'earn') {
      this.learningSession = this.context.createLearningSession();
      this.learningSession.start();
      this.tickTimer = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => {
          this.learningSession?.tick(1);
          this.context.store.persist();
          this.refreshChrome();
        },
      });
    } else {
      this.learningSession = undefined;
      this.tickTimer = undefined;
    }

    this.syncOrientation();
    this.cameras.main.setBackgroundColor('#243B6B');

    this.visibilityHandler = () => {
      this.learningSession?.setHidden(document.hidden);
      if (document.hidden) this.context.audio.stopAll();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.resizeHandler = () => this.syncOrientation();
    window.addEventListener('resize', this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.buildChrome();
    this.loadArt(() => this.onArtLoaded());
    window.__GAME_READY__ = true;
  }

  // ---------------------------------------------------------------- lifecycle

  private cleanup(): void {
    this.alive = false;
    this.ready = false;
    runTeardown(
      [
        () => this.tickTimer?.remove(),
        () => this.nextRequestTimer?.remove(),
        () => this.learningSession?.exit(),
        () => {
          this.learningSession = undefined;
        },
        () => this.context.audio.stopAll(),
        () => {
          if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
        },
        () => {
          if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
        },
        () => this.context.shell.clearStickerBoardChrome(),
      ],
      () => this.persistSave(),
    );
    this.stickerImages = [];
    this.bgImage = undefined;
    this.strokeGraphics = undefined;
    this.hud = undefined;
  }

  private say(request: SpeechRequest): Promise<boolean> {
    return this.alive ? this.context.audio.play({ ...request }) : Promise.resolve(false);
  }

  private loadArt(done: () => void): void {
    const queued = queueArtManifest(
      this,
      STICKER_BOARD_ART_MANIFEST,
      import.meta.env.BASE_URL,
      this.scale.width >= this.scale.height,
    );
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

  private onArtLoaded(): void {
    if (!this.alive) return;
    this.ready = true;
    if (this.ageTrack === 'age5' && this.requestsEnabled) {
      this.startNextRequest(false);
    }
    this.relayout();
    this.refreshChrome();
    void this.playIntroAndFirstRequest();
  }

  private async playIntroAndFirstRequest(): Promise<void> {
    const seq = ++this.speakSeq;
    this.learningSession?.reportListening(true);
    try {
      await this.say(STICKER_VOICE.intro);
      if (!this.alive || seq !== this.speakSeq) return;
      if (this.ageTrack === 'age5' && this.requestsEnabled && this.currentRequest) {
        await this.say(requestLine(this.currentRequest, this.context.content.stickers));
      }
    } finally {
      if (seq === this.speakSeq) this.learningSession?.reportListening(false);
    }
  }

  private syncOrientation(): void {
    const want = baseSize();
    if (this.scale.width !== want.width || this.scale.height !== want.height) {
      this.scale.setGameSize(want.width, want.height);
      this.scale.refresh();
      if (this.ready) {
        this.relayout();
        queueArtManifest(
          this,
          STICKER_BOARD_ART_MANIFEST,
          import.meta.env.BASE_URL,
          want.width >= want.height,
        );
        if (this.load.list.size > 0) {
          this.load.once(Phaser.Loader.Events.COMPLETE, () => {
            if (this.alive && this.ready) this.relayout();
          });
          this.load.start();
        }
      }
    } else if (this.ready) {
      this.positionChrome();
    }
  }

  // ---------------------------------------------------------------- helpers

  private crayonsForTrack() {
    return this.context.content.stickers.crayons.filter((c) =>
      this.ageTrack === 'age2' ? c.age2 : c.age5,
    );
  }

  private stickerDisplaySize(): number {
    return this.ageTrack === 'age2' ? 128 : 112;
  }

  private currentBalanceSec(): number {
    return this.context.store.getProfileState(this.profileId, new Date(this.context.nowMs())).balanceSec;
  }

  private persistSave(): void {
    if (!this.profileId || !this.save) return;
    this.save.current = cloneBoard(this.board);
    saveStickerBoardState(window.localStorage, this.profileId, this.save);
  }

  private isBoardEmpty(): boolean {
    return this.board.stickers.length === 0 && this.board.strokes.length === 0;
  }

  private stickerArtKey(stickerId: string): string | null {
    return this.context.content.stickers.stickers.find((s) => s.id === stickerId)?.artKey ?? null;
  }

  // ---------------------------------------------------------------- chrome

  private buildChrome(): void {
    const content = this.context.content.stickers;
    const crayons = this.crayonsForTrack();
    this.geometry = computeStickerBoardLayout(
      this.scale.width,
      this.scale.height,
      this.ageTrack,
      crayons.length,
    );
    const showTime =
      stickerLeisureMode(content.earnsLeisure, this.context.isTimeEarningEnabled()) === 'earn';

    this.hud = this.context.shell.setStickerBoardChrome({
      ageTrack: this.ageTrack,
      baseUrl: import.meta.env.BASE_URL,
      stickers: content.stickers.map((s) => ({ id: s.id, artKey: s.artKey })),
      backgrounds: content.backgrounds.map((b) => ({ id: b.id })),
      crayons: crayons.map((c) => ({ id: c.id, hex: c.hex })),
      selectedBackground: this.board.backgroundId,
      selectedColor: this.selectedColor,
      undoEnabled: !this.undoStack.isEmpty,
      saveEnabled: !this.isBoardEmpty(),
      requestsEnabled: this.requestsEnabled,
      requestStickerArtKey: this.currentRequest ? this.stickerArtKey(this.currentRequest.stickerId) : null,
      showTime,
      balanceSec: this.currentBalanceSec(),
      onBack: () => this.goBack(),
      onHelp: () => this.showHelp(),
      onSelectTraySticker: (id) => this.onTrayStickerTap(id),
      onSelectBackground: (id) => this.onSelectBackground(id),
      onSelectCrayon: (id) => this.onSelectCrayon(id),
      onUndo: () => this.onUndo(),
      onClear: () => this.onClear(),
      onSave: () => this.onSaveToAlbum(),
      onOpenAlbum: () => this.onOpenAlbum(),
      onSelectAlbumItem: (i) => this.onLoadAlbumItem(i),
      onToggleRequests: () => this.onToggleRequests(),
      onRepeatRequest: () => this.onRepeatRequest(),
      onBoardPointerDown: (x, y, w, h) => this.onBoardPointerDown(x, y, w, h),
      onBoardPointerMove: (x, y, w, h) => this.onBoardPointerMove(x, y, w, h),
      onBoardPointerUp: (x, y, w, h) => this.onBoardPointerUp(x, y, w, h),
      onBoardPointerCancel: () => this.onBoardPointerCancel(),
    });
    this.positionChrome();
  }

  private positionChrome(): void {
    this.hud?.layout(this.geometry, this.game.canvas.getBoundingClientRect(), this.scale.width);
  }

  private refreshChrome(): void {
    this.hud?.update({
      selectedBackground: this.board.backgroundId,
      selectedColor: this.selectedColor,
      undoEnabled: !this.undoStack.isEmpty,
      saveEnabled: !this.isBoardEmpty(),
      requestsEnabled: this.requestsEnabled,
      requestStickerArtKey: this.currentRequest ? this.stickerArtKey(this.currentRequest.stickerId) : null,
      balanceSec: this.currentBalanceSec(),
    });
  }

  private goBack(): void {
    this.persistSave();
    this.context.store.persist();
    transitionTo(this, 'MapScene', { style: 'iris' });
  }

  private showHelp(): void {
    this.learningSession?.reportInteraction();
    this.context.sfx.tap();
    const seq = ++this.speakSeq;
    this.context.shell.showHelp(this.context.content.he.stickerBoard.helpText, () => {
      if (seq === this.speakSeq) this.context.audio.stopAll();
    });
    void this.say(STICKER_VOICE.help);
  }

  // ---------------------------------------------------------------- rendering

  private relayout(): void {
    if (!this.alive) return;
    const crayons = this.crayonsForTrack();
    this.geometry = computeStickerBoardLayout(
      this.scale.width,
      this.scale.height,
      this.ageTrack,
      crayons.length,
    );
    this.renderBackground();
    this.renderStrokes();
    this.renderStickers();
    this.positionChrome();
  }

  private renderBackground(): void {
    this.bgImage?.destroy();
    this.bgImage = undefined;
    const { width, height } = this.scale;
    const orientation = width >= height ? 'landscape' : 'portrait';
    const key = `sticker-board-bg-${this.board.backgroundId}-${orientation}`;
    if (this.textures.exists(key)) {
      this.bgImage = this.add.image(width / 2, height / 2, key).setDisplaySize(width, height).setDepth(0);
    }
  }

  private renderStrokes(): void {
    if (!this.strokeGraphics) {
      this.strokeGraphics = this.add.graphics().setDepth(5);
    }
    const g = this.strokeGraphics;
    g.clear();
    const b = this.geometry.board;
    const width = this.ageTrack === 'age2' ? 18 : 14;
    const radius = width / 2;
    const hexMap = new Map(
      this.context.content.stickers.crayons.map((c) => [c.id, parseInt(c.hex.slice(1), 16)]),
    );

    for (const stroke of this.board.strokes) {
      const pts = stroke.points;
      if (pts.length < 2) continue;
      const color = hexMap.get(stroke.colorId) ?? 0xe2554f;
      g.fillStyle(color, 1);
      g.lineStyle(width, color, 1);
      let prevX = b.x + pts[0] * b.width;
      let prevY = b.y + pts[1] * b.height;
      g.fillCircle(prevX, prevY, radius);
      for (let i = 2; i + 1 < pts.length; i += 2) {
        const nextX = b.x + pts[i] * b.width;
        const nextY = b.y + pts[i + 1] * b.height;
        g.lineBetween(prevX, prevY, nextX, nextY);
        g.fillCircle(nextX, nextY, radius);
        prevX = nextX;
        prevY = nextY;
      }
    }
  }

  private renderStickers(popIndex = -1): void {
    for (const img of this.stickerImages) img.destroy();
    this.stickerImages = [];
    const b = this.geometry.board;
    const size = this.stickerDisplaySize();

    this.board.stickers.forEach((s, idx) => {
      const key = this.stickerArtKey(s.stickerId);
      if (!key || !this.textures.exists(key)) return;
      const gx = b.x + s.x * b.width;
      const gy = b.y + s.y * b.height;
      const img = this.add.image(gx, gy, key).setDisplaySize(size, size).setDepth(10 + idx);
      const restScale = img.scaleX;
      this.stickerImages.push(img);
      if (idx === popIndex) {
        void popIn(this, img, 0, restScale);
      }
    });
  }

  // ---------------------------------------------------------------- actions

  private onTrayStickerTap(stickerId: string): void {
    if (!this.alive || !this.ready) return;
    this.learningSession?.reportInteraction();
    this.undoStack.push(this.board);
    this.board = addSticker(this.board, stickerId);
    this.context.sfx.pop();
    this.persistSave();
    const addedIndex = this.board.stickers.length - 1;
    this.renderStickers(addedIndex);
    this.refreshChrome();
    const added = this.board.stickers[addedIndex];
    if (added) this.checkRequestMet(stickerId, added.x, added.y);
  }

  private onSelectBackground(backgroundId: string): void {
    if (!this.alive || !this.ready) return;
    this.learningSession?.reportInteraction();
    this.context.sfx.tap();
    if (this.board.backgroundId === backgroundId) return;
    this.board = { ...this.board, backgroundId };
    this.persistSave();
    this.renderBackground();
    if (this.ageTrack === 'age5' && this.requestsEnabled) {
      this.nextRequestTimer?.remove();
      this.startNextRequest(true);
    }
    this.refreshChrome();
  }

  private onSelectCrayon(colorId: string): void {
    if (!this.alive || !this.ready) return;
    this.learningSession?.reportInteraction();
    this.context.sfx.tap();
    this.selectedColor = colorId;
    this.refreshChrome();
  }

  private onUndo(): void {
    if (!this.alive || !this.ready || this.undoStack.isEmpty) return;
    this.learningSession?.reportInteraction();
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.board = undoKeepingBackground(this.board, previous);
    this.context.sfx.tap();
    this.persistSave();
    this.renderStrokes();
    this.renderStickers();
    this.refreshChrome();
  }

  private onClear(): void {
    if (!this.alive || !this.ready) return;
    this.learningSession?.reportInteraction();
    this.context.sfx.tap();
    if (this.isBoardEmpty()) return;
    this.undoStack.push(this.board);
    this.board = clearBoard(this.board);
    this.persistSave();
    this.renderStrokes();
    this.renderStickers();
    this.refreshChrome();
  }

  private onSaveToAlbum(): void {
    if (!this.alive || !this.ready || this.ageTrack !== 'age5' || this.isBoardEmpty()) return;
    this.learningSession?.reportInteraction();
    this.save = addToAlbum(this.save, this.board);
    this.persistSave();
    const b = this.geometry.board;
    Juice.for(this).burst('sparkle', b.x + b.width / 2, b.y + b.height / 2);
    this.context.sfx.yay();
    this.speakSingle(STICKER_VOICE.saved);
    this.refreshChrome();
  }

  private onOpenAlbum(): void {
    if (!this.alive || !this.ready || this.ageTrack !== 'age5') return;
    this.learningSession?.reportInteraction();
    this.context.sfx.tap();
    this.hud?.showAlbum(this.save.album);
  }

  private onLoadAlbumItem(index: number): void {
    if (!this.alive || !this.ready || this.ageTrack !== 'age5') return;
    const item = this.save.album[index];
    if (!item) return;
    this.learningSession?.reportInteraction();
    this.undoStack.push(this.board);
    this.board = cloneBoard(item);
    this.context.sfx.tap();
    this.persistSave();
    this.renderBackground();
    this.renderStrokes();
    this.renderStickers();
    if (
      this.requestsEnabled &&
      this.currentRequest &&
      this.currentRequest.backgroundId !== this.board.backgroundId
    ) {
      this.nextRequestTimer?.remove();
      this.startNextRequest(true);
    }
    this.refreshChrome();
  }

  private onToggleRequests(): void {
    if (!this.alive || !this.ready || this.ageTrack !== 'age5') return;
    this.learningSession?.reportInteraction();
    this.context.sfx.tap();
    this.requestsEnabled = !this.requestsEnabled;
    this.nextRequestTimer?.remove();
    this.nextRequestTimer = undefined;
    if (this.requestsEnabled) {
      this.startNextRequest(true);
    } else {
      this.currentRequest = null;
      this.speakSeq++;
      this.context.audio.stopAll();
    }
    this.refreshChrome();
  }

  private onRepeatRequest(): void {
    if (!this.alive || !this.ready || !this.currentRequest) return;
    this.learningSession?.reportInteraction();
    this.context.sfx.tap();
    this.speakSingle(requestLine(this.currentRequest, this.context.content.stickers));
  }

  private startNextRequest(speakNow: boolean): void {
    const langSetting = this.context.store.getState().settings.languages;
    const req = pickRequest(
      this.context.content.stickers,
      this.board.backgroundId,
      langSetting,
      this.requestIndex++,
      this.previousStickerId,
    );
    this.currentRequest = req;
    this.previousStickerId = req.stickerId;
    this.refreshChrome();
    if (speakNow) {
      this.speakSingle(requestLine(req, this.context.content.stickers));
    }
  }

  private speakSingle(line: SpeechRequest): void {
    const seq = ++this.speakSeq;
    this.learningSession?.reportListening(true);
    void this.say(line).finally(() => {
      if (seq === this.speakSeq) this.learningSession?.reportListening(false);
    });
  }

  private checkRequestMet(stickerId: string, normX: number, normY: number): void {
    if (this.ageTrack !== 'age5' || !this.requestsEnabled || !this.currentRequest) return;
    if (!isRequestMet(this.currentRequest, stickerId, this.board.backgroundId)) return;
    this.requestsMet++;
    this.previousStickerId = stickerId;
    this.currentRequest = null;
    this.refreshChrome();

    const b = this.geometry.board;
    Juice.for(this).burst('sparkle', b.x + normX * b.width, b.y + normY * b.height);
    this.context.sfx.yay();
    this.speakSingle(STICKER_VOICE.praise);

    this.nextRequestTimer?.remove();
    this.nextRequestTimer = this.time.delayedCall(1500, () => {
      if (!this.alive || !this.requestsEnabled) return;
      this.startNextRequest(true);
    });
  }

  // ---------------------------------------------------------------- board pointer

  private onBoardPointerDown(offsetX: number, offsetY: number, cssWidth: number, cssHeight: number): void {
    if (!this.alive || !this.ready || cssWidth <= 0 || cssHeight <= 0) return;
    this.learningSession?.reportInteraction();
    const nx = Math.max(0, Math.min(1, offsetX / cssWidth));
    const ny = Math.max(0, Math.min(1, offsetY / cssHeight));
    const b = this.geometry.board;
    const size = this.stickerDisplaySize();
    const halfNormX = size / 2 / b.width;
    const halfNormY = size / 2 / b.height;

    const hitIdx = hitSticker(this.board, nx, ny, halfNormX, halfNormY);
    if (hitIdx >= 0) {
      const target = this.board.stickers[hitIdx];
      this.dragState = {
        kind: 'sticker',
        index: hitIdx,
        stickerId: target.stickerId,
        startCssX: offsetX,
        startCssY: offsetY,
        pointerOffsetX: nx - target.x,
        pointerOffsetY: ny - target.y,
        moved: false,
        snapshot: cloneBoard(this.board),
      };
      return;
    }

    const snapshot = cloneBoard(this.board);
    this.board = startStroke(this.board, this.selectedColor, nx, ny);
    this.dragState = { kind: 'stroke', snapshot };
    this.renderStrokes();
  }

  private onBoardPointerMove(offsetX: number, offsetY: number, cssWidth: number, cssHeight: number): void {
    if (!this.alive || !this.ready || !this.dragState || cssWidth <= 0 || cssHeight <= 0) return;
    this.learningSession?.reportInteraction();
    const nx = Math.max(0, Math.min(1, offsetX / cssWidth));
    const ny = Math.max(0, Math.min(1, offsetY / cssHeight));

    if (this.dragState.kind === 'sticker') {
      const dist = Math.hypot(offsetX - this.dragState.startCssX, offsetY - this.dragState.startCssY);
      if (!this.dragState.moved && dist < TAP_SLOP_CSS) return;
      this.dragState.moved = true;
      const b = this.geometry.board;
      const size = this.stickerDisplaySize();
      const padX = Math.min(0.45, size / 2 / b.width);
      const padY = Math.min(0.45, size / 2 / b.height);
      this.board = moveSticker(
        this.board,
        this.dragState.index,
        nx - this.dragState.pointerOffsetX,
        ny - this.dragState.pointerOffsetY,
        padX,
        padY,
      );
      this.dragState.index = this.board.stickers.length - 1;
      this.renderStickers();
      return;
    }

    this.board = extendStroke(this.board, nx, ny);
    this.renderStrokes();
  }

  private onBoardPointerUp(_offsetX: number, _offsetY: number, _cssWidth: number, _cssHeight: number): void {
    if (!this.alive || !this.ready || !this.dragState) return;
    const drag = this.dragState;
    this.dragState = null;

    if (drag.kind === 'sticker') {
      if (drag.moved) {
        this.undoStack.push(drag.snapshot);
        this.persistSave();
        this.refreshChrome();
        const dropped = this.board.stickers[this.board.stickers.length - 1];
        if (dropped) this.checkRequestMet(drag.stickerId, dropped.x, dropped.y);
      } else {
        this.context.sfx.tap();
        const img = this.stickerImages[drag.index];
        if (img) {
          const base = img.scaleX;
          void pressSquash(this, img, base, base);
        }
      }
      return;
    }

    this.undoStack.push(drag.snapshot);
    this.persistSave();
    this.refreshChrome();
  }

  private onBoardPointerCancel(): void {
    if (!this.alive || !this.dragState) return;
    this.board = this.dragState.snapshot;
    this.dragState = null;
    this.renderStrokes();
    this.renderStickers();
  }

  // ---------------------------------------------------------------- e2e hook

  getStickerBoardInfo(): StickerBoardInfo | null {
    if (!this.alive || !this.ready) return null;
    this.syncOrientation();
    const box = this.game.canvas.getBoundingClientRect();
    const canvasRect: PageRect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const size = { width: this.scale.width, height: this.scale.height };
    const b = this.geometry.board;
    const boardRect = gameRectToPageRect(b, canvasRect, size);
    const stickerSize = this.stickerDisplaySize();

    const stickers: PlacedStickerInfo[] = this.board.stickers.map((s, index) => {
      const gx = b.x + s.x * b.width;
      const gy = b.y + s.y * b.height;
      const rect = gameRectToPageRect(
        {
          x: gx - stickerSize / 2,
          y: gy - stickerSize / 2,
          width: stickerSize,
          height: stickerSize,
        },
        canvasRect,
        size,
      );
      return {
        index,
        stickerId: s.stickerId,
        center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        rect,
      };
    });

    return {
      ageTrack: this.ageTrack,
      backgroundId: this.board.backgroundId,
      selectedColor: this.selectedColor,
      boardRect,
      stickers,
      strokes: this.board.strokes.map((st) => ({
        colorId: st.colorId,
        pointCount: Math.floor(st.points.length / 2),
      })),
      request: this.currentRequest ? { ...this.currentRequest } : null,
      requestsEnabled: this.requestsEnabled,
      requestsMet: this.requestsMet,
      albumCount: this.save.album.length,
      undoCount: this.undoStack.length,
      earnsLeisure: this.context.content.stickers.earnsLeisure,
      chromeButtons: this.chromeButtonRects(),
    };
  }

  private chromeButtonRects(): Array<{ id: string; rect: PageRect }> {
    const out: Array<{ id: string; rect: PageRect }> = [];
    for (const node of document.querySelectorAll<HTMLElement>('.sticker-layer button[data-testid]')) {
      const b = node.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0) continue;
      out.push({
        id: node.dataset.testid ?? '',
        rect: { x: b.left, y: b.top, width: b.width, height: b.height },
      });
    }
    return out;
  }
}
