// Mystery Egg game shell: the interactive world map (docs/specs/game-shell.md). The nest and egg are HOME in the centre,
// five worlds sit around it joined by cobblestone paths. Tapping the open world makes the friends walk along its path,
// then the world's entry slides (first arrival) and its game start; tapping a locked world wiggles it and plays a sleepy
// cue. A first-visit intro (4 slides) tells the story. Entry: the big egg button on the map HUD (`mystery-egg-btn`);
// exit: the home button. All media is optional: missing art is drawn, missing sounds are synthesized.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { setAppScreen } from '../../pwa';
import { transitionTo } from '../../anim/transitions';
import { floatIdle } from '../../anim/tweens';
import { createRobot, eggArt } from './art';
import { assetEntry, displaySize } from './assets';
import { boardRectToPage, fitBoard } from './boardView';
import { loadEggAssets, mapArtIds } from './eggAssetLoader';
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
import type { EggPageRect, EggPhase, EggTarget, MysteryEggInfo, WorldInfo } from './types';
import { drawHomeIcon, makeButton, speechCue, type EggButton } from './ui';
import { friendRoute, walkDurationMs, walkFrame, type WalkOptions } from './walk';
import {
  FRIEND_HOMES,
  NEST,
  PIECE_NEST_SPOTS,
  WORLDS,
  friendsFor,
  pieceArtId,
  worldArtId,
  type FriendId,
  type WorldDef,
  type WorldId,
} from './worlds';

/** The robot's heart panel (bottom centre, 1x scale); socket positions follow Gemini's geometry (layout.ts). */
const PANEL = { x: 640, y: 755, scale: 1 } as const;
const WALK: WalkOptions = { speed: 300, staggerMs: 260 };
const PATH_STAMP_SPACING = 56;
const FLIGHT_MS = 1100;
const ROBOT_LINE_LOCKED = 'vo-he-robot-locked';

const shownPiecesKey = (profileId: string): string => `mystery-egg-shown-pieces:${profileId}`;

interface Friend {
  id: FriendId;
  /** Positioned by the walk; its child `body` keeps the idle bob and wiggles. */
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  scale: number;
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
  private robotView: ReturnType<typeof createRobot> | null = null;
  private egg: Phaser.GameObjects.Container | null = null;
  private eggShownLevel = 0;
  private readonly piecesInNest = new Set<string>();
  private walk: { world: WorldDef; routes: Point2[][]; elapsed: number } | null = null;
  private walkingTo: WorldId | null = null;
  private lockedTaps = 0;
  private pieceFlights: string[] = [];

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
    this.robotView = null;
    this.egg = null;
    this.piecesInNest.clear();
    this.walk = null;
    this.walkingTo = null;
    this.lockedTaps = 0;
    this.pieceFlights = [];
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

    eggArt(this, 'map-bg', 640, 400).setDepth(0);
    this.drawPaths();
    for (const def of WORLDS) this.addWorld(def);
    this.addNest(arriving);
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

  /** Cobblestone patches stamped along each world's path, under everything else. */
  private drawPaths(): void {
    for (const def of WORLDS) {
      let n = 0;
      for (let i = 1; i < def.path.length; i++) {
        const a = def.path[i - 1];
        const b = def.path[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        for (let d = 0; d < len; d += PATH_STAMP_SPACING) {
          const k = d / len;
          const stamp = eggArt(this, 'map-path', a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k).setDepth(2);
          stamp.setAngle((n * 47) % 360);
          n++;
        }
      }
      eggArt(this, 'map-path', def.door.x, def.door.y).setDepth(2).setAngle((n * 47) % 360);
    }
  }

  private addWorld(def: WorldDef): void {
    const art = eggArt(this, worldArtId(def), def.x, def.y).setDepth(4);
    if (def.open) {
      const glow = this.add.ellipse(def.x, def.y + 30, def.artW * 0.9, def.artH * 0.7, 0xffe9a8, 0.35).setDepth(3);
      this.tweens.add({ targets: glow, alpha: 0.12, scale: 1.08, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      floatIdle(this, art, 4, 1800 + Math.random() * 400);
    }
    this.worldViews.set(def.id, { def, art });
    // The tap area is a fixed rectangle (80% of the art, >= 96 px), above everything, so a wiggling art never moves it.
    const zone = this.add.zone(def.x, def.y, def.hit.w, def.hit.h).setDepth(30).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.onWorldTap(def));
  }

  private addNest(arriving: string[]): void {
    this.eggShownLevel = eggLevel(this.progress) - arriving.length;
    this.setEgg(this.eggShownLevel);
    for (const piece of earnedPieces(this.progress)) if (!arriving.includes(piece)) this.restPiece(piece);
  }

  private setEgg(level: number, pop = false): void {
    this.egg?.destroy();
    const egg = eggArt(this, `egg-nest-${level}`, NEST.x, NEST.y).setDepth(10);
    egg.setInteractive({ useHandCursor: true });
    egg.on('pointerdown', () => {
      playEggSfx('sfx-robot-beep-2');
      this.wiggle(egg, 6 + level * 2);
    });
    this.tweens.add({ targets: egg, angle: 1.5 + level * 0.8, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (pop) this.tweens.add({ targets: egg, scale: { from: 1.18, to: 1 }, duration: 420, ease: 'Back.easeOut' });
    this.egg = egg;
    this.eggShownLevel = level;
  }

  private restPiece(piece: string): void {
    const spot = PIECE_NEST_SPOTS[piece] ?? { x: NEST.x, y: NEST.y + 40, angle: 0 };
    eggArt(this, pieceArtId(piece), spot.x, spot.y).setDepth(12).setAngle(spot.angle).setScale(0.7);
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

  /** The friends stand by the nest; each has a positioned root and an idle-bobbing body. */
  private addFriends(): void {
    const track = this.context.currentAgeTrack();
    const make = (id: FriendId): Friend => {
      const home = FRIEND_HOMES[id];
      const root = this.add.container(home.x, home.y).setDepth(14);
      let body: Phaser.GameObjects.Container;
      let scale = 1;
      if (id === 'robot') {
        this.robotView = createRobot(this, 0, 0);
        body = this.robotView.container;
        scale = 0.8;
        this.robotView.startIdleBlinks();
      } else {
        body = eggArt(this, id, 0, 0);
        scale = { bunny: 0.72, capybara: 0.62, frog: 0.8 }[id];
      }
      body.setScale(scale);
      root.add(body);
      floatIdle(this, body, 6, 1500 + Math.random() * 500);
      body.setInteractive({ useHandCursor: true });
      body.on('pointerdown', () => {
        if (id === 'robot') playEggSfx('sfx-robot-beep-1');
        this.wiggle(body, 5);
      });
      return { id, root, body, scale };
    };
    for (const id of friendsFor({ ageTrack: track })) this.friends.set(id, make(id));
  }

  /** A short wiggle (angle) of the whole image, then back to rest. */
  private wiggle(target: Phaser.GameObjects.Container, deg: number): void {
    this.tweens.add({ targets: target, angle: { from: -deg, to: deg }, duration: 90, yoyo: true, repeat: 2, onComplete: () => target.setAngle(0) });
  }

  // ---------------------------------------------------------------- slides

  private startSlides(kind: 'intro' | 'entry', world: WorldId | null, slides: typeof INTRO_SLIDES, done: (end: SlideEnd) => void): void {
    this.phase = kind === 'intro' ? 'intro' : 'entry';
    // The slide images are loaded on demand (the map itself never needs them).
    loadEggAssets(
      this,
      import.meta.env.BASE_URL,
      () => {
        if (!this.alive) return;
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
    if (!this.alive || !this.ready || this.phase !== 'map') return;
    if (def.open) this.startWalk(def);
    else this.lockedFeedback(def);
  }

  /** A closed world: a wiggle, floating z's, a sleepy sound and the robot's line. The child stays on the map. */
  private lockedFeedback(def: WorldDef): void {
    this.lockedTaps++;
    const view = this.worldViews.get(def.id);
    if (view) this.wiggle(view.art, 4);
    this.floatZs(def);
    playEggSfx('sfx-locked');
    const entry = assetEntry(ROBOT_LINE_LOCKED);
    if (entry.lang && entry.transcript) {
      void this.context.audio.play({ lineId: ROBOT_LINE_LOCKED, lang: entry.lang, text: entry.transcript }).catch(() => false);
      const robot = this.friends.get('robot');
      if (robot) speechCue(this, robot.root.x - 70, robot.root.y - 150);
    }
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
    playEggSfx('sfx-walk');
    const routes = [...this.friends.values()].map((f) => friendRoute(FRIEND_HOMES[f.id], def.path));
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
      // Face the walking direction (the art faces right) and tilt a little with the bob.
      const left = Math.cos(w.angle) < -0.2;
      f.body.setScale(left ? -f.scale : f.scale, f.scale);
      f.root.setAngle(w.moving ? Math.sin(walk.elapsed / 90 + i) * 3 : 0);
    });
    if (frame.done || walk.elapsed > walkDurationMs(walk.routes, WALK) + 400) {
      this.walk = null;
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

  /** Back from a game: each newly earned piece flies from its world's door into the nest and the egg glows brighter. */
  private async flyPieces(pieces: string[]): Promise<void> {
    this.phase = 'hub';
    for (const piece of pieces) {
      if (!this.alive) return;
      const world = WORLDS.find((w) => w.piece === piece);
      const from = world?.door ?? { x: NEST.x, y: NEST.y - 200 };
      const spot = PIECE_NEST_SPOTS[piece] ?? { x: NEST.x, y: NEST.y + 40, angle: 0 };
      const flyer = eggArt(this, pieceArtId(piece), from.x, from.y).setDepth(50).setScale(1);
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
      this.setEgg(this.eggShownLevel + 1, true);
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
    for (const def of WORLDS) rects[`world-${def.id}`] = boardRectToPage(this, def.x, def.y, def.hit.w, def.hit.h);
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
