// Game shell slide player view (docs/specs/game-shell.md AC-09..AC-11): a thin Phaser overlay over the pure SlidePlayer.
// One picture per slide, its voice lines played in order through the Mystery Egg voice path (a missing file is a chime
// plus a speech-bubble cue). A tap anywhere advances (and stops the current voice); a picture-only skip button ends it
// all. No video, no auto-advance.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { eggArt } from './art';
import { boardRectToPage } from './boardView';
import { BOARD } from './layout';
import { SlidePlayer, SlideVoice, type SlideDef } from './slides';
import { eggSpeechRequest } from './speech';
import type { EggPageRect, SlideInfo } from './types';
import { MIN_TAP, drawSkipIcon, makeButton, speechCue } from './ui';
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
  private readonly voice: SlideVoice;
  private cues: Phaser.GameObjects.Container[] = [];
  private closed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: AppContext,
    private readonly opts: SlideOverlayOptions,
  ) {
    this.player = new SlidePlayer(opts.slides);
    this.voice = new SlideVoice({
      play: (lineId) => this.playClip(lineId),
      schedule: (fn, ms) => {
        const timer = scene.time.delayedCall(ms, fn);
        return () => timer.remove(false);
      },
    });
    this.layer = scene.add.container(0, 0).setDepth(DEPTH);
    this.layer.add(scene.add.rectangle(BOARD.width / 2, BOARD.height / 2, BOARD.width + 1200, BOARD.height + 1200, 0x2b1d14, 1));
    this.dots = scene.add.graphics();

    // Tap anywhere: next slide. Added first so the skip button (above it) wins taps on its own area.
    const tapZone = scene.add.zone(BOARD.width / 2, BOARD.height / 2, BOARD.width + 1200, BOARD.height + 1200).setInteractive();
    tapZone.on('pointerdown', () => this.advance());

    // Skip is code UI (drawn, no art id) and always shown: on the intro and on every entry, the first time included.
    const skip = makeButton(scene, SKIP.x, SKIP.y, SKIP.size, SKIP.size, drawSkipIcon, () => this.skip()).container;
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
    this.voice.stop();
    this.context.audio.stopAll();
    // The speech cues belong to the slide whose lines they mark.
    for (const cue of this.cues) if (cue.scene) cue.destroy();
    this.cues = [];
  }

  private showCurrent(): void {
    const slide = this.player.current;
    if (!slide) return;
    this.picture?.destroy();
    this.picture = eggArt(this.scene, slide.image, BOARD.width / 2, BOARD.height / 2);
    // Behind the dim backdrop's neighbours: the picture sits just above the backdrop (index 1), below the tap zone.
    this.layer.addAt(this.picture, 1);
    this.drawDots();
    this.voice.start(slide.lines);
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

  /** One clip (its file, or a chime plus a speech cue when it is missing); resolves when it ends or is cut. */
  private playClip(lineId: string): Promise<unknown> {
    // Slide voice-over plays at the recorded speed (SLIDE_SPEECH_RATE), not at the in-game rate.
    const request = eggSpeechRequest(lineId, 'slide');
    if (this.closed || !request) return Promise.resolve();
    this.cues.push(speechCue(this.scene, request.lang === 'fr' ? 420 : 860, BOARD.height - 120).setDepth(DEPTH + 10));
    return this.context.audio.play(request).catch(() => false);
  }
}
