// First scene: preloads the registered art manifest with a tiny, cute loading
// indicator, then starts the next scene. Never blocks: missing files are skipped and a
// hard timeout moves on regardless.
import Phaser from 'phaser';
import { getArtManifest } from './artRegistry';
import { queueArtManifest } from './assetLoader';
import { PALETTE } from '../assets/colors';

const HARD_TIMEOUT_MS = 12000;
const FILE_TIMEOUT_MS = 8000;

export interface PreloadData {
  next?: string;
}

export class PreloadScene extends Phaser.Scene {
  private next = 'MapScene';
  private safety: number | undefined;
  private started = false;

  constructor() {
    super('PreloadScene');
  }

  init(data: PreloadData): void {
    this.next = data?.next ?? 'MapScene';
    this.started = false;
  }

  preload(): void {
    const queued = queueArtManifest(this, getArtManifest(), import.meta.env.BASE_URL);
    if (queued === 0) return;
    this.load.xhr.timeout = FILE_TIMEOUT_MS;
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[art] failed to load ${file.key} (${file.src}); using fallback art`);
    });
    this.drawIndicator();
    this.safety = window.setTimeout(() => this.goNext(), HARD_TIMEOUT_MS);
  }

  private drawIndicator(): void {
    const { width: w, height: h } = this.scale;
    const colors = [PALETTE.pink, PALETTE.yellow, PALETTE.blue];
    const dots = colors.map((c, i) => this.add.circle(w / 2 + (i - 1) * 46, h / 2, 14, c).setStrokeStyle(4, PALETTE.outline));
    // The scene clock does not tick while loading, so animate with a plain rAF loop.
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / 1000;
      for (let i = 0; i < dots.length; i++) {
        const phase = Math.max(0, Math.sin(t * 6 - i * 0.7));
        dots[i].y = h / 2 - phase * 26;
        dots[i].setScale(1 + phase * 0.12, 1 - phase * 0.08);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const barW = 180;
    const track = this.add.rectangle(w / 2, h / 2 + 52, barW, 10, 0xffffff, 0.7).setStrokeStyle(3, PALETTE.outline);
    const fill = this.add.rectangle(w / 2 - barW / 2, h / 2 + 52, 1, 10, PALETTE.green).setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => fill.setSize(Math.max(1, barW * v), 10));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cancelAnimationFrame(raf);
      track.destroy();
    });
  }

  create(): void {
    this.goNext();
  }

  private goNext(): void {
    if (this.started) return;
    this.started = true;
    if (this.safety !== undefined) window.clearTimeout(this.safety);
    this.safety = undefined;
    this.scene.start(this.next);
  }
}
