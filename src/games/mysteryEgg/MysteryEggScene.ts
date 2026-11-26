// Mystery Egg game shell: the interactive world map (docs/specs/game-shell.md). The nest and egg are HOME in the centre,
// five worlds sit around it joined by cobblestone paths. Tapping the open world makes the friends walk along its path,
// then the world's entry slides (first arrival) and its game start; tapping a closed world only wiggles it (no voice).
// A first-visit intro (4 slides) tells the story. Entry: the big egg button on the map HUD (`mystery-egg-btn`);
// exit: the home button. All media is optional: missing art is drawn, missing sounds are synthesized.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { setAppScreen } from '../../pwa';
import { transitionTo } from '../../anim/transitions';
import { floatIdle } from '../../anim/tweens';
import { ensureSpriteAnim, eggArt } from './art';
import { displaySize } from './assets';
import { boardRectToPage, fitBoard } from './boardView';
import { loadEggAssets, mapArtIds } from './eggAssetLoader';
import { WiggleGuard, worldTapAllowed } from './mapRules';
import { playEggSfx } from './eggSound';
import { heartSlotCentres, type Point2 } from './layout';
import {
  HEART_SLOT_COUNT,
  earnedPieces,
  eggLevel,
  gearFill,
  litHearts,
  loadProgress,
  markEntrySeen,
  markIntroSeen,
  newPieces,
  readyToHatch,
  saveProgress,
  type MysteryEggProgress,
} from './progress';
import { SlideOverlay, type SlideEnd } from './slideView';
import { ENTRY_SLIDES, INTRO_SLIDES, entrySlides } from './slides';
import { drawPieceShape } from './shellArt';
import type { EggPageRect, EggPhase, EggTarget, MysteryEggInfo, WorldInfo } from './types';
import { drawHomeIcon, makeButton, type EggButton } from './ui';
import { friendRoute, walkDurationMs, walkFrame, type WalkOptions } from './walk';
import {
  FRIEND_HOMES,
  MAP_FRIENDS,
  NEST,
  PIECE_ART,
  PIECE_NEST_SPOTS,
  WORLDS,
  worldArtId,
  type FriendId,
  type WorldDef,
  type WorldId,
} from './worlds';

/** The robot's heart panel (bottom centre, 1x scale); socket positions follow Gemini's geometry (layout.ts). */
const PANEL = { x: 640, y: 755, scale: 1 } as const;
const WALK: WalkOptions = { speed: 300, staggerMs: 260 };
const FLIGHT_MS = 1100;

const shownPiecesKey = (profileId: string): string => `mystery-egg-shown-pieces:${profileId}`;

interface Friend {
  id: FriendId;
  /** Positioned by the walk; its child `body` keeps the idle bob, the wiggle and the left/right flip. */
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  /** `map-<friend>-idle` (drawn placeholder when the file is missing). */
  idle: Phaser.GameObjects.Container;
  /** `map-<friend>-walk` strip (4 frames, 8 fps), null while the strip is missing: the idle art walks instead. */
  walkSprite: Phaser.GameObjects.Sprite | null;
  walking: boolean;
}

interface WorldView {
  def: WorldDef;
  art: Phaser.GameObjects.Container;
}

export class MysteryEggScene extends Phaser.Scene {
  private context!: AppContext;
  private profileId = '';
  private progress!: MysteryEggProgress;
  private ready = false;
  private alive = false;
  private phase: EggPhase = 'hub';
  private overlay: SlideOverlay | null = null;
  private readonly buttons = new Map<EggTarget, EggButton>();
  private readonly worldViews = new Map<WorldId, WorldView>();
  private readonly friends = new Map<FriendId, Friend>();
  private nest: Phaser.GameObjects.Container | null = null;
  private glow: Phaser.GameObjects.Container | null = null;
  private eggShownLevel = 0;
  private readonly piecesInNest = new Set<string>();
  private walk: { world: WorldDef; routes: Point2[][]; elapsed: number } | null = null;
  private walkingTo: WorldId | null = null;
  private lockedTaps = 0;
  private pieceFlights: string[] = [];
  /** One wiggle per target: a new tap stops the running one and restores the rest angle (no stacking). */
  private readonly wiggles = new WiggleGuard<Phaser.GameObjects.Container>((t) => t.setAngle(0));

  constructor() {
    super('MysteryEggScene');
  }

  create(): void {
    setAppScreen('mystery-egg');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.profileId = this.context.requireProfileId();
    this.progress = loadProgress(window.localStorage, this.profileId);
    this.ready = false;
    this.alive = true;
    // `hub`: not interactive yet (assets loading, or a nest piece flying in); `map` only once the child can tap a world.
    this.phase = 'hub';
    this.overlay = null;
    this.buttons.clear();
    this.worldViews.clear();
    this.friends.clear();
    this.nest = null;
    this.glow = null;
    this.piecesInNest.clear();
    this.walk = null;
    this.walkingTo = null;
    this.lockedTaps = 0;
    this.pieceFlights = [];
    this.wiggles.clear();
    // The map's DOM chrome (top bar, world labels, egg button) must not stay on top of this canvas scene.
    this.context.shell.clearChrome();
    fitBoard(this, '#fdeee0');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.overlay?.destroy();
      this.overlay = null;
      this.context.audio.stopAll();
    });
    loadEggAssets(
      this,
      import.meta.env.BASE_URL,
      () => {
        if (!this.alive) return;
        this.build();
        this.ready = true;
        window.__GAME_READY__ = true;
      },
      mapArtIds(),
    );
  }

  // ---------------------------------------------------------------- building the map

  private build(): void {
    const registry = this.game.registry;
    const key = shownPiecesKey(this.profileId);
    // A piece earned since the map last showed it flies in now; on the first map of a session everything earned is "shown".
    const shown = (registry.get(key) as string[] | undefined) ?? earnedPieces(this.progress);
    const arriving = newPieces(this.progress, shown);
    registry.set(key, earnedPieces(this.progress));

    // Layers (Gemini's contract): map-bg at (0,0), a procedural path glow, the centre, the tiles, then the characters.
    eggArt(this, 'map-bg', 640, 400).setDepth(0);
    this.drawPathGlow();
    this.addNest(arriving);
    for (const def of WORLDS) this.addWorld(def);
    this.addHeartPanel();
    this.addFriends();

    const back = makeButton(this, 70, 70, 96, 96, drawHomeIcon, () => this.goBack());
    back.container.setDepth(40);
    this.buttons.set('backBtn', back);

    if (!this.progress.introSeen) this.startSlides('intro', null, INTRO_SLIDES, () => {
      this.progress = markIntroSeen(this.progress);
      saveProgress(window.localStorage, this.profileId, this.progress);
      this.afterIntro(arriving);
    });
    else this.afterIntro(arriving);
  }

  private afterIntro(arriving: string[]): void {
    if (arriving.length > 0) void this.flyPieces(arriving);
    else this.phase = 'map';
  }

  /** A soft glow drawn in code along each path (the cobblestones are baked into `map-bg`); the open world's path pulses. */
  private drawPathGlow(): void {
    for (const def of WORLDS) {
      const g = this.add.graphics().setDepth(1);
      g.lineStyle(64, 0xffd45e, def.open ? 0.4 : 0.08);
      g.beginPath();
      def.path.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.strokePath();
      if (def.open) this.tweens.add({ targets: g, alpha: { from: 1, to: 0.35 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private addWorld(def: WorldDef): void {
    const art = eggArt(this, worldArtId(def), def.x, def.y).setDepth(8);
    if (def.open) {
      const glow = this.add.ellipse(def.x, def.y + 30, def.artW * 0.9, def.artH * 0.7, 0xffe9a8, 0.35).setDepth(7);
      this.tweens.add({ targets: glow, alpha: 0.12, scale: 1.08, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      floatIdle(this, art, 4, 1800 + Math.random() * 400);
    }
    this.worldViews.set(def.id, { def, art });
    // The tap area is a fixed rectangle (the visible art, >= 96 px), above everything, so a wiggling art never moves it.
    const zone = this.add.zone(def.hit.x, def.hit.y, def.hit.w, def.hit.h).setDepth(30).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.onWorldTap(def));
  }

  /** The centrepiece: `map-nest-home`, a procedural glow that grows with the egg level, and the earned piece placeholders. */
  private addNest(arriving: string[]): void {
    const nest = eggArt(this, 'map-nest-home', NEST.x, NEST.y).setDepth(3);
    nest.setInteractive({ useHandCursor: true });
    nest.on('pointerdown', () => {
      playEggSfx('sfx-robot-beep-2');
      this.wiggle(nest, 6 + this.eggShownLevel * 2);
    });
    this.tweens.add({ targets: nest, angle: 1.2, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.nest = nest;
    this.setGlow(eggLevel(this.progress) - arriving.length);
    for (const piece of earnedPieces(this.progress)) if (!arriving.includes(piece)) this.restPiece(piece);
  }

  /** The egg-progress glow around the nest (level 0..5): more and bigger soft rings as the level rises. */
  private setGlow(level: number, pop = false): void {
    this.glow?.destroy();
    const g = this.add.graphics();
    for (let i = 0; i < level + 1 && level > 0; i++) {
      g.fillStyle(0xfff2a8, 0.1 + level * 0.025);
      g.fillCircle(0, -25, 105 + level * 18 + i * 24);
    }
    const glow = this.add.container(NEST.x, NEST.y, [g]).setDepth(2);
    if (level > 0) this.tweens.add({ targets: glow, alpha: { from: 1, to: 0.6 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (pop) this.tweens.add({ targets: this.nest, scale: { from: 1.15, to: 1 }, duration: 420, ease: 'Back.easeOut' });
    this.glow = glow;
    this.eggShownLevel = level;
  }

  /** A nest piece: the feather has art, the other pieces are drawn placeholders (no art id yet). */
  private pieceView(piece: string, x: number, y: number): Phaser.GameObjects.Container {
    const art = PIECE_ART[piece];
    if (art) return eggArt(this, art, x, y);
    const g = this.add.graphics();
    drawPieceShape(g, piece, 120);
    return this.add.container(x, y, [g]);
  }

  private restPiece(piece: string): void {
    const spot = PIECE_NEST_SPOTS[piece] ?? { x: NEST.x, y: NEST.y + 40, angle: 0 };
    this.pieceView(piece, spot.x, spot.y).setDepth(4).setAngle(spot.angle).setScale(0.7);
    this.piecesInNest.add(piece);
  }

  /** The robot's heart panel: a lit slot per world that has a success, each with a placeholder gear-fill arc. */
  private addHeartPanel(): void {
    const lit = new Set(litHearts(this.progress));
    eggArt(this, 'heart-panel', PANEL.x, PANEL.y).setDepth(5).setScale(PANEL.scale);
    const sockets = heartSlotCentres(PANEL.x, PANEL.y, displaySize('heart-panel'), PANEL.scale);
    for (let i = 0; i < HEART_SLOT_COUNT; i++) {
      const filled = lit.has(i);
      const slot = eggArt(this, filled ? 'slot-filled' : 'slot-empty', sockets[i].x, sockets[i].y).setDepth(6).setScale(PANEL.scale);
      if (filled) this.tweens.add({ targets: slot, scale: PANEL.scale * 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const world = WORLDS.find((w) => w.heartSlot === i);
      const fill = world ? gearFill(this.progress, world.id) : 0;
      const ring = this.add.graphics().setDepth(7);
      ring.lineStyle(5, 0x8a8fa8, 0.35);
      ring.strokeCircle(sockets[i].x, sockets[i].y, 31);
      if (fill > 0) {
        ring.lineStyle(6, 0xf2b632, 1);
        ring.beginPath();
        ring.arc(sockets[i].x, sockets[i].y, 31, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill, false);
        ring.strokePath();
      }
    }
  }

  /** The friends stand by the nest: idle art at rest, the 4-frame walk strip while walking. */
  private addFriends(): void {
    for (const id of MAP_FRIENDS) {
      const home = FRIEND_HOMES[id];
      const root = this.add.container(home.x, home.y).setDepth(14);
      const idle = eggArt(this, `map-${id}-idle`, 0, 0);
      const walkId = `map-${id}-walk`;
      const spec = ensureSpriteAnim(this, walkId, -1);
      const walkSprite = spec ? this.add.sprite(0, 0, walkId, '0').setDisplaySize(spec.w, spec.h).setVisible(false) : null;
      const body = this.add.container(0, 0, walkSprite ? [idle, walkSprite] : [idle]);
      body.setSize(idle.width, idle.height);
      root.add(body);
      floatIdle(this, body, 6, 1500 + Math.random() * 500);
      body.setInteractive({ useHandCursor: true });
      body.on('pointerdown', () => {
        if (id === 'robot') playEggSfx('sfx-robot-beep-1');
        this.wiggle(body, 5);
      });
      this.friends.set(id, { id, root, body, idle, walkSprite, walking: false });
    }
  }

  /** Swaps a friend between its idle art and its walk strip (the idle art keeps going while the strip is missing). */
  private setWalking(f: Friend, on: boolean): void {
    if (f.walking === on) return;
    f.walking = on;
    if (!f.walkSprite) return;
    f.idle.setVisible(!on);
    f.walkSprite.setVisible(on);
    if (on) f.walkSprite.play(`map-${f.id}-walk`);
    else f.walkSprite.stop().setFrame('0');
  }

  /** A short wiggle (angle) of the whole image, then back to rest. */
  private wiggle(target: Phaser.GameObjects.Container, deg: number): void {
    this.wiggles.start(target, () =>
      this.tweens.add({
        targets: target,
        angle: { from: -deg, to: deg },
        duration: 90,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          target.setAngle(0);
          this.wiggles.finish(target);
        },
      }),
    );
  }

  // ---------------------------------------------------------------- slides

  private startSlides(kind: 'intro' | 'entry', world: WorldId | null, slides: typeof INTRO_SLIDES, done: (end: SlideEnd) => void): void {
    // The phase flips to `intro` / `entry` only once the overlay exists, so it always comes with a slide in the read hook.
    // The slide images are loaded on demand (the map itself never needs them).
    loadEggAssets(
      this,
      import.meta.env.BASE_URL,
      () => {
        if (!this.alive) return;
        this.phase = kind === 'intro' ? 'intro' : 'entry';
        this.overlay = new SlideOverlay(this, this.context, {
          kind,
          world,
          slides,
          onDone: (end) => {
            this.overlay = null;
            done(end);
          },
        });
      },
      slides.map((s) => s.image),
    );
  }

  // ---------------------------------------------------------------- tapping a world

  private onWorldTap(def: WorldDef): void {
    if (!worldTapAllowed({ alive: this.alive, ready: this.ready, phase: this.phase })) return;
    if (def.open) this.startWalk(def);
    else this.lockedFeedback(def);
  }

  /** A closed world: a cute wiggle, floating z's and a soft pop. No voice line; the child stays on the map. */
  private lockedFeedback(def: WorldDef): void {
    this.lockedTaps++;
    const view = this.worldViews.get(def.id);
    if (view) this.wiggle(view.art, 4);
    this.floatZs(def);
    playEggSfx('sfx-pop');
  }

  private floatZs(def: WorldDef): void {
    for (let i = 0; i < 3; i++) {
      const g = this.add.graphics().setDepth(35);
      g.lineStyle(5, 0x6b5b95, 1);
      const s = 8 + i * 4;
      g.beginPath();
      g.moveTo(-s, -s);
      g.lineTo(s, -s);
      g.lineTo(-s, s);
      g.lineTo(s, s);
      g.strokePath();
      g.setPosition(def.x + 20 + i * 22, def.y - def.artH * 0.25);
      g.setAlpha(0);
      this.tweens.add({ targets: g, alpha: { from: 1, to: 0 }, y: g.y - 70 - i * 14, duration: 1100, delay: i * 220, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
    }
  }

  // ---------------------------------------------------------------- the walk

  private startWalk(def: WorldDef): void {
    this.phase = 'walking';
    this.walkingTo = def.id;
    const routes = [...this.friends.values()].map((f) => friendRoute(FRIEND_HOMES[f.id], def));
    this.walk = { world: def, routes, elapsed: 0 };
  }

  update(_time: number, delta: number): void {
    const walk = this.walk;
    if (!walk || !this.alive) return;
    walk.elapsed += Math.min(delta, 120);
    const frame = walkFrame(walk.routes, walk.elapsed, WALK);
    [...this.friends.values()].forEach((f, i) => {
      const w = frame.friends[i];
      f.root.setPosition(w.x, w.y + w.bob);
      this.setWalking(f, w.moving);
      // Face the walking direction (the art faces right): flip while the current path segment goes left.
      if (w.moving) f.body.setScale(Math.cos(w.angle) < -0.2 ? -1 : 1, 1);
    });
    if (frame.done || walk.elapsed > walkDurationMs(walk.routes, WALK) + 400) {
      this.walk = null;
      for (const f of this.friends.values()) this.setWalking(f, false);
      this.arrive(walk.world);
    }
  }

  private arrive(def: WorldDef): void {
    const slides = entrySlides(def.id);
    if (slides.length > 0 && !this.progress.entrySeen.includes(def.id)) {
      this.startSlides('entry', def.id, ENTRY_SLIDES[def.id] ?? slides, () => {
        this.progress = markEntrySeen(this.progress, def.id);
        saveProgress(window.localStorage, this.profileId, this.progress);
        this.enterGame(def);
      });
    } else {
      this.enterGame(def);
    }
  }

  private enterGame(def: WorldDef): void {
    if (!this.alive || !def.gameScene) {
      this.phase = 'map';
      this.walkingTo = null;
      return;
    }
    this.context.audio.stopAll();
    transitionTo(this, def.gameScene, { style: 'fade' });
  }

  // ---------------------------------------------------------------- a piece flies into the nest

  /** Back from a game: each newly earned piece flies from its world's door into the nest and the nest glow grows. */
  private async flyPieces(pieces: string[]): Promise<void> {
    this.phase = 'hub';
    for (const piece of pieces) {
      if (!this.alive) return;
      const world = WORLDS.find((w) => w.piece === piece);
      const from = world?.door ?? { x: NEST.x, y: NEST.y - 200 };
      const spot = PIECE_NEST_SPOTS[piece] ?? { x: NEST.x, y: NEST.y + 40, angle: 0 };
      const flyer = this.pieceView(piece, from.x, from.y).setDepth(50).setScale(1);
      await new Promise<void>((resolve) => {
        this.tweens.add({
          targets: flyer,
          x: spot.x,
          y: spot.y,
          angle: 720 + spot.angle,
          scale: 0.7,
          delay: 400,
          duration: FLIGHT_MS,
          ease: 'Sine.easeInOut',
          onComplete: () => resolve(),
        });
      });
      if (!this.alive) return;
      flyer.destroy();
      this.restPiece(piece);
      this.setGlow(this.eggShownLevel + 1, true);
      playEggSfx('sfx-robot-beep-3');
      this.pieceFlights.push(piece);
      await new Promise<void>((resolve) => this.time.delayedCall(450, () => resolve()));
    }
    if (this.alive) this.phase = 'map';
  }

  private goBack(): void {
    if (this.phase !== 'map') return;
    this.context.sfx.tap();
    transitionTo(this, 'MapScene', { style: 'fade' });
  }

  // ---------------------------------------------------------------- e2e read hook

  /** ?e2e=1 read hook. */
  getMysteryEggInfo(): MysteryEggInfo {
    const rects: MysteryEggInfo['rects'] = {};
    for (const [target, b] of this.buttons) rects[target] = boardRectToPage(this, b.container.x, b.container.y, b.width, b.height);
    for (const def of WORLDS) rects[`world-${def.id}`] = boardRectToPage(this, def.hit.x, def.hit.y, def.hit.w, def.hit.h);
    const slideRects: { skipBtn?: EggPageRect; slideTap?: EggPageRect } = this.overlay?.rects() ?? {};
    if (this.overlay && slideRects.skipBtn && slideRects.slideTap) {
      rects.skipBtn = slideRects.skipBtn;
      rects.slideTap = slideRects.slideTap;
    }
    const worlds = {} as Record<WorldId, WorldInfo>;
    for (const def of WORLDS) {
      const w = this.progress.worlds[def.id];
      worlds[def.id] = { open: def.open, level: w.level, completed: [...w.completed], fill: gearFill(this.progress, def.id) };
    }
    const worldAngles = {} as Record<WorldId, number>;
    for (const def of WORLDS) worldAngles[def.id] = Math.round((this.worldViews.get(def.id)?.art.angle ?? 0) * 100) / 100;
    const friendPositions: Partial<Record<FriendId, { x: number; y: number }>> = {};
    for (const [id, f] of this.friends) friendPositions[id] = { x: Math.round(f.root.x), y: Math.round(f.root.y) };
    return {
      scene: 'MysteryEggScene',
      phase: this.phase,
      ready: this.ready,
      heartsLit: litHearts(this.progress),
      eggLevel: this.eggShownLevel,
      featherInNest: this.piecesInNest.has('feather'),
      failedRuns: 0,
      hintsGiven: 0,
      hintVisible: false,
      slotFilled: false,
      ballAtStart: true,
      partsInTray: [],
      rects,
      map: {
        heartFill: Array.from({ length: HEART_SLOT_COUNT }, (_, i) => {
          const world = WORLDS.find((w) => w.heartSlot === i);
          return world ? gearFill(this.progress, world.id) : 0;
        }),
        pieces: [...this.piecesInNest],
        readyToHatch: readyToHatch(this.progress),
        friends: [...this.friends.keys()],
        friendPositions,
        worlds,
        worldAngles,
        slide: this.overlay ? this.overlay.info : null,
        introSeen: this.progress.introSeen,
        entrySeen: [...this.progress.entrySeen],
        walkingTo: this.walkingTo,
        lockedTaps: this.lockedTaps,
        pieceFlights: [...this.pieceFlights],
      },
    };
  }
}
