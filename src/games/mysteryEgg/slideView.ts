// Game shell slide player view (docs/specs/game-shell.md AC-09..AC-11): a thin Phaser overlay over the pure SlidePlayer.
// One picture per slide, its voice lines played in order through the Mystery Egg voice path (a missing file is a chime
// plus a speech-bubble cue). A tap anywhere advances (and stops the current voice); a picture-only skip button ends it
// all. No video, no auto-advance.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { eggArt } from './art';
import { assetEntry } from './assets';
import { boardRectToPage } from './boardView';
import { BOARD } from './layout';
import { SlidePlayer, type SlideDef } from './slides';
import type { EggPageRect, SlideInfo } from './types';
import { MIN_TAP, speechCue } from './ui';
import type { WorldId } from './worlds';

const DEPTH = 2000;
const SKIP = { x: 1210, y: 90, size: 112 } as const;

export type SlideEnd = 'ended' | 'skipped';

export interface SlideOverlayOptions {
  kind: SlideInfo['kind'];
  world: WorldId | null;
  slides: readonly SlideDef[];
  onDone: (end: SlideEnd) => void;
}

export class SlideOverlay {
  readonly player: SlidePlayer;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly dots: Phaser.GameObjects.Graphics;
  private picture: Phaser.GameObjects.Container | null = null;
  private voiceToken = 0;
  private closed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: AppContext,
    private readonly opts: SlideOverlayOptions,
  ) {
    this.player = new SlidePlayer(opts.slides);
    this.layer = scene.add.container(0, 0).setDepth(DEPTH);
    this.layer.add(scene.add.rectangle(BOARD.width / 2, BOARD.height / 2, BOARD.width + 1200, BOARD.height + 1200, 0x2b1d14, 1));
    this.dots = scene.add.graphics();

    // Tap anywhere: next slide. Added first so the skip button (above it) wins taps on its own area.
    const tapZone = scene.add.zone(BOARD.width / 2, BOARD.height / 2, BOARD.width + 1200, BOARD.height + 1200).setInteractive();
    tapZone.on('pointerdown', () => this.advance());

    const skip = scene.add.container(SKIP.x, SKIP.y);
    skip.add(eggArt(scene, 'icon-skip', 0, 0).setScale(SKIP.size / 96));
    skip.setSize(SKIP.size, SKIP.size);
    skip.setInteractive({ useHandCursor: true });
    skip.on('pointerdown', () => this.skip());
    this.layer.add([tapZone, this.dots, skip]);
    this.layer.bringToTop(skip);
    scene.tweens.add({ targets: skip, scale: 1.06, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.showCurrent();
  }

  get info(): SlideInfo {
    return { kind: this.opts.kind, world: this.opts.world, index: Math.min(this.player.index, this.player.count - 1), count: this.player.count };
  }

  /** Page rectangles of the tap targets (e2e read hook). */
  rects(): { skipBtn: EggPageRect; slideTap: EggPageRect } {
    return {
      skipBtn: boardRectToPage(this.scene, SKIP.x, SKIP.y, Math.max(SKIP.size, MIN_TAP), Math.max(SKIP.size, MIN_TAP)),
      slideTap: boardRectToPage(this.scene, BOARD.width / 2, BOARD.height / 2, BOARD.width, BOARD.height),
    };
  }

  private advance(): void {
    if (this.closed) return;
    this.stopVoice();
    const step = this.player.advance();
    if (step.finished) this.finish(this.player.state === 'skipped' ? 'skipped' : 'ended');
    else this.showCurrent();
  }

  private skip(): void {
    if (this.closed) return;
    this.stopVoice();
    this.player.skip();
    this.finish('skipped');
  }

  private finish(end: SlideEnd): void {
    if (this.closed) return;
    this.closed = true;
    this.layer.destroy();
    this.opts.onDone(end);
  }

  /** Removes the overlay without calling `onDone` (the scene is shutting down). */
  destroy(): void {
    this.closed = true;
    this.stopVoice();
    if (this.layer.scene) this.layer.destroy();
  }

  private stopVoice(): void {
    this.voiceToken++;
    this.context.audio.stopAll();
  }

  private showCurrent(): void {
    const slide = this.player.current;
    if (!slide) return;
    this.picture?.destroy();
    this.picture = eggArt(this.scene, slide.image, BOARD.width / 2, BOARD.height / 2);
    // Behind the dim backdrop's neighbours: the picture sits just above the backdrop (index 1), below the tap zone.
    this.layer.addAt(this.picture, 1);
    this.drawDots();
    void this.playLines(slide);
  }

  private drawDots(): void {
    const g = this.dots.clear();
    const n = this.player.count;
    for (let i = 0; i < n; i++) {
      const x = BOARD.width / 2 + (i - (n - 1) / 2) * 34;
      g.fillStyle(0xffffff, i === this.player.index ? 1 : 0.4);
      g.fillCircle(x, BOARD.height - 40, i === this.player.index ? 11 : 8);
    }
  }

  /** French hero line, then the Hebrew robot line (each a chime plus a speech cue when its file is missing). */
  private async playLines(slide: SlideDef): Promise<void> {
    const token = ++this.voiceToken;
    for (const lineId of slide.lines) {
      if (this.closed || token !== this.voiceToken) return;
      const entry = assetEntry(lineId);
      if (entry.kind !== 'vo' || !entry.lang || !entry.transcript) continue;
      const hero = entry.lang === 'fr';
      speechCue(this.scene, hero ? 420 : 860, BOARD.height - 120).setDepth(DEPTH + 10);
      await this.context.audio.play({ lineId, lang: entry.lang, text: entry.transcript }).catch(() => false);
    }
  }
}
