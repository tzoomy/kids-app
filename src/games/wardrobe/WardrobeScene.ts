// WardrobeScene (docs/specs/wardrobe.md, Pass 1): the child dresses the bear with items she has unlocked.
// - Entry: the map HUD button `wardrobe-btn`; exit: `hud-back`. No leisure earning, no learning session.
// - Item buttons are DOM (src/ui/wardrobeChrome.ts); the character and its accessories are drawn here.
// - Accessory art loads lazily when the scene opens (WARDROBE_ART_MANIFEST), never at boot.
// - Every change is saved immediately on the wardrobe key (src/core/wardrobe/store.ts).
// - Hooks live in src/game/createGame.ts under ?e2e=1 (getWardrobeInfo, seedWardrobeState, recordCompletedRound).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { setAppScreen } from '../../pwa';
import { Character } from '../../anim/Character';
import { queueArtManifest } from '../../anim/assetLoader';
import { transitionTo } from '../../anim/transitions';
import { popIn } from '../../anim/tweens';
import { WARDROBE_ART_MANIFEST, wardrobeArtKey } from '../../assets/art/wardrobeManifest';
import { layoutOutfit, type PlacedItem } from '../../core/wardrobe/layout';
import { findItem, offeredItems, toggleItem, wornItems, canEquip, type WardrobeState } from '../../core/wardrobe/model';
import { loadWardrobeState, saveWardrobeState } from '../../core/wardrobe/store';
import type { AgeTrack } from '../../core/storage/schema';
import type { WardrobeItemView } from '../../ui/wardrobeChrome';
import { WARDROBE_CHARACTER } from './wardrobeInfo';

export class WardrobeScene extends Phaser.Scene {
  private context!: AppContext;
  private profileId = '';
  private track: AgeTrack = 'age5';
  private state!: WardrobeState;
  private character?: Character;
  private alive = false;
  private artReady = false;
  /** Ids drawn at the last refresh, to pop in only what was just put on. */
  private drawn = new Set<string>();

  constructor() {
    super('WardrobeScene');
  }

  create(): void {
    setAppScreen('wardrobe');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.profileId = this.context.requireProfileId();
    this.track = this.context.currentAgeTrack();
    this.state = loadWardrobeState(window.localStorage, this.profileId);
    this.alive = true;
    this.artReady = false;
    this.drawn = new Set();
    this.character = undefined;

    this.cameras.main.setBackgroundColor('#e6f3ff');
    this.paintFloor();
    this.buildCharacter();
    this.buildChrome();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.character = undefined;
    });

    this.loadArt(() => {
      this.artReady = true;
      this.refreshCharacter(false);
    });
    window.__GAME_READY__ = true;
  }

  // ---------------------------------------------------------------- build

  private paintFloor(): void {
    const { width, height } = this.scale;
    const feetY = this.feetY();
    this.add.ellipse(width / 2, feetY + 10, Math.min(width * 0.6, 560), 70, 0xffd9a8);
    this.add.rectangle(width / 2, (feetY + 10 + height) / 2 + 40, width, height - feetY, 0xfff1d6, 0.6);
  }

  private feetY(): number {
    const { width, height } = this.scale;
    return width >= height ? height * 0.7 : height * 0.62;
  }

  private buildCharacter(): void {
    const { width, height } = this.scale;
    const displayHeight = width >= height ? height * 0.5 : Math.min(width * 0.75, height * 0.42);
    this.character = new Character(this, { kind: WARDROBE_CHARACTER, x: width / 2, y: this.feetY(), displayHeight });
    this.refreshCharacter(false);
  }

  private loadArt(done: () => void): void {
    const queued = queueArtManifest(this, WARDROBE_ART_MANIFEST, import.meta.env.BASE_URL);
    if (queued === 0) {
      done();
      return;
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (this.alive) done();
    });
    this.load.start();
  }

  private buildChrome(): void {
    this.context.shell.setWardrobeChrome({
      items: this.itemViews(),
      onBack: () => this.goBack(),
      onItem: (id) => this.onItem(id),
    });
  }

  private itemViews(): WardrobeItemView[] {
    return offeredItems(this.track).map((item) => ({
      id: item.id,
      locked: !canEquip(this.state, this.track, item.id),
      worn: this.state.outfit[item.slot] === item.id && canEquip(this.state, this.track, item.id),
    }));
  }

  // ---------------------------------------------------------------- actions

  private onItem(itemId: string): void {
    if (!canEquip(this.state, this.track, itemId)) return;
    this.context.sfx.tap();
    this.state = toggleItem(this.state, this.track, itemId);
    saveWardrobeState(window.localStorage, this.profileId, this.state);
    this.context.shell.updateWardrobeChrome(this.itemViews());
    this.refreshCharacter(true);
  }

  private goBack(): void {
    this.context.audio.stopAll();
    transitionTo(this, 'MapScene', { style: 'iris' });
  }

  // ---------------------------------------------------------------- drawing

  /** Rebuilds the accessories from the pure layout; only newly worn items pop in. */
  private refreshCharacter(animate: boolean): void {
    if (!this.alive || !this.character || !this.artReady) return;
    const placed = layoutOutfit(WARDROBE_CHARACTER, wornItems(this.state, this.track));
    const layers = { behindHead: [] as Phaser.GameObjects.Image[], head: [] as Phaser.GameObjects.Image[], front: [] as Phaser.GameObjects.Image[] };
    const fresh: Array<{ img: Phaser.GameObjects.Image; scale: number }> = [];
    for (const p of placed) {
      const img = this.makeImage(p);
      if (!img) continue;
      layers[p.band].push(img);
      if (animate && !this.drawn.has(p.itemId)) fresh.push({ img, scale: p.scale });
    }
    this.character.setAccessories(layers);
    this.drawn = new Set(placed.map((p) => p.itemId));
    for (const { img, scale } of fresh) if (img.scene) void popIn(this, img, 0, scale);
  }

  /** One accessory image: pivot on the anchor, rotated and scaled around the pivot, never mirrored. */
  private makeImage(p: PlacedItem): Phaser.GameObjects.Image | null {
    const item = findItem(p.itemId);
    const key = wardrobeArtKey(p.itemId);
    if (!item || !this.textures.exists(key)) return null;
    const img = this.make.image({ key, x: p.left + p.originX, y: p.top + p.originY, add: false });
    img.setOrigin(item.pivot.x, item.pivot.y);
    img.setScale(p.scale);
    img.setAngle(p.rotate);
    img.setFlipX(p.flipX);
    return img;
  }
}
