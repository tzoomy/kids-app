import Phaser from 'phaser';
import type { AppContext } from '../game/appContext';
import { drawWorldBuilding, paintMapBackdrop } from '../assets/vectorArt';
import type { MapPin } from '../ui/hud';
import { heLine } from '../content/voiceLines';
import { transitionTo } from '../anim/transitions';
import { popIn, floatIdle, pressSquash } from '../anim/tweens';
import { setAppScreen } from '../pwa';
import { LEISURE_PICKER_GAMES, NUMBER_GARDEN_PICKER_GAMES, SCIENCE_WORLD_PICKER_GAMES, NATURE_LAB_PICKER_GAMES, WORLD_GAMES } from '../ui/picker/pickerModel';
import { worldEntry } from '../ui/picker/trailModel';
import { stationsForActiveProfile } from './worldTrail';

/** Module scope = once per page load / app session. */
let mapGuidancePlayed = false;

export class MapScene extends Phaser.Scene {
  /** Building objects by world id (read-only access for the e2e hit-rectangle hook). */
  private readonly buildings = new Map<string, Phaser.GameObjects.Container>();

  constructor() {
    super('MapScene');
  }

  /** Current tap rectangle of a world's building in game coordinates (follows the idle float), or null. */
  getBuildingRect(worldId: string): { x: number; y: number; width: number; height: number } | null {
    const b = this.buildings.get(worldId);
    if (!b || !b.scene) return null;
    const width = b.width * Math.abs(b.scaleX);
    const height = b.height * Math.abs(b.scaleY);
    return { x: b.x - width / 2, y: b.y - height / 2, width, height };
  }

  create(): void {
    setAppScreen('map');
    const context = this.game.registry.get('appContext') as AppContext;
    const { worlds } = context.content.worlds;
    paintMapBackdrop(this);

    const cx = this.scale.width / 2;
    const cy = this.scale.height * 0.55;
    const portrait = this.scale.height > this.scale.width;
    const cols = Math.min(3, worlds.length);
    const spacingX = Math.min(portrait ? 210 : 280, this.scale.width / (cols + (portrait ? 0.85 : 0.4)));
    const spacingY = Math.min(portrait ? 230 : 250, this.scale.height * (portrait ? 0.3 : 0.36));
    const rows = Math.ceil(worlds.length / cols);
    const startX = cx - ((cols - 1) * spacingX) / 2;
    const startY = cy - ((rows - 1) * spacingY) / 2 + (portrait ? this.scale.height * 0.04 : 0);

    this.buildings.clear();
    const pins: MapPin[] = [];
    // Set once the child has tapped anything, so the "where to go" line never talks over a tap.
    let touched = false;

    worlds.forEach((world, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;
      const locked = world.status === 'locked';
      const building = drawWorldBuilding(this, world.id, locked, 180);
      building.setPosition(x, y);
      this.buildings.set(world.id, building);
      building.setAlpha(locked ? 0.72 : 1);

      // Staggered pop-in, then a gentle idle float.
      void popIn(this, building, 80 + i * 70).then(() => {
        if (building.scene) floatIdle(this, building, 8, 1800 + i * 140);
      });

      building.setInteractive({ useHandCursor: true });
      building.on('pointerdown', () => {
        context.sfx.tap();
        touched = true;
        context.audio.stopAll();
        void pressSquash(this, building);
        if (world.status === 'locked') {
          context.shell.showToast(`${context.content.he.worldMap.comingSoon} 🌱`);
          void context.audio.play(heLine('map.comingSoon'));
          return;
        }
        if (world.status === 'leisure') {
          const profileState = context.store.getProfileState(context.requireProfileId(), new Date(context.nowMs()));
          if (!context.isTimeEarningEnabled() || profileState.balanceSec > 0) {
            context.shell.showGamePicker({
              games: LEISURE_PICKER_GAMES,
              title: context.content.he.gamePicker.leisureTitle,
              onPick: (game) => {
                context.shell.hideGamePicker();
                context.sfx.tap();
                transitionTo(this, game.sceneKey, { style: 'iris', originX: x, originY: y });
              },
              onClose: () => {
                context.shell.hideGamePicker();
                context.sfx.tap();
              },
            });
          } else {
            context.shell.showToast(`⏳ 0:00`);
          }
          return;
        }
        // Temporary per-world pickers from main (Balloon Pop, Seed to Flower, Potion Lab / Science World).
        // The follow-up rework deletes these branches and moves every list into WORLD_GAMES.
        if (world.id === 'science-world') {
          // Science World is its own map area; its games are listed in SCIENCE_WORLD_PICKER_GAMES.
          // Until the first game lands, the picker shows a gentle "coming soon" card.
          const t = context.content.he.gamePicker;
          context.shell.showGamePicker({
            games: SCIENCE_WORLD_PICKER_GAMES,
            title: t.scienceWorldTitle,
            emptyText: t.scienceWorldEmpty,
            onPick: (game) => {
              context.shell.hideGamePicker();
              context.sfx.tap();
              transitionTo(this, game.sceneKey, { style: 'iris', originX: x, originY: y });
            },
            onClose: () => {
              context.shell.hideGamePicker();
              context.sfx.tap();
            },
          });
          if (SCIENCE_WORLD_PICKER_GAMES.length === 0) void context.audio.play(heLine('map.comingSoon'));
          return;
        }
        if (world.id === 'number-garden') {
          // Number Garden hosts Sorting Beds and Balloon Pop: the child picks one (or closes the picker).
          context.shell.showGamePicker({
            games: NUMBER_GARDEN_PICKER_GAMES,
            title: context.content.he.gamePicker.numberGardenTitle,
            onPick: (game) => {
              context.shell.hideGamePicker();
              context.sfx.tap();
              transitionTo(this, game.sceneKey, { style: 'iris', originX: x, originY: y });
            },
            onClose: () => {
              context.shell.hideGamePicker();
              context.sfx.tap();
            },
          });
          return;
        }
        if (world.id === 'nature-lab') {
          // Nature Lab hosts Who's Hiding? (entry game) and Seed to Flower: the child picks one.
          context.shell.showGamePicker({
            games: NATURE_LAB_PICKER_GAMES,
            title: context.content.he.gamePicker.natureLabTitle,
            onPick: (game) => {
              context.shell.hideGamePicker();
              context.sfx.tap();
              transitionTo(this, game.sceneKey, { style: 'iris', originX: x, originY: y });
            },
            onClose: () => {
              context.shell.hideGamePicker();
              context.sfx.tap();
            },
          });
          return;
        }
        // Registry-driven entry (docs/specs/station-trail.md): 2+ games open the station trail picker, exactly one
        // game is entered directly, and a world with no registered game falls back to its `entryGameId`.
        const entry = worldEntry(stationsForActiveProfile(context, world.id));
        if (entry.kind === 'picker') {
          // The child picks a station (or closes the picker and stays on the map). No station is ever locked.
          context.shell.showGamePicker({
            stations: entry.stations,
            title: world.nameHe,
            onPick: (game) => {
              context.shell.hideGamePicker();
              context.sfx.tap();
              transitionTo(this, game.sceneKey, { style: 'iris', originX: x, originY: y });
            },
            onClose: () => {
              context.shell.hideGamePicker();
              context.sfx.tap();
            },
          });
          return;
        }
        const target = entry.kind === 'direct' ? entry.game : WORLD_GAMES.find((g) => g.gameId === world.entryGameId);
        if (target) transitionTo(this, target.sceneKey, { style: 'iris', originX: x, originY: y });

      });

      const labels: Record<string, string> = {
        'language-house': context.content.he.worldMap.languageHouse,
        'number-garden': context.content.he.worldMap.numberGarden,
        'nature-lab': context.content.he.worldMap.natureLab,
        'science-world': context.content.he.worldMap.scienceWorld,
        'art-studio': context.content.he.worldMap.artStudio,
        'leisure-corner': context.content.he.worldMap.leisureCorner,
      };

      pins.push({
        id: world.id,
        label: labels[world.id] ?? world.id,
        locked,
        comingSoon: locked ? context.content.he.worldMap.comingSoon : undefined,
        gameX: x,
        gameY: y + 88,
      });
    });

    const paintChrome = () => {
      const profileState = context.store.getProfileState(context.requireProfileId(), new Date(context.nowMs()));
      context.shell.setMapChrome({
        title: context.content.he.worldMap.title,
        balanceSec: profileState.balanceSec,
        showTime: context.isTimeEarningEnabled(),
        onParent: () => context.onRequestParent?.(),
        onParentLongPress: () => context.onRequestParentSettings?.(),
        onSwitchProfile: () => context.onExitToProfileSelect?.(),
        pins,
        canvas: this.game.canvas,
        gameWidth: this.scale.width,
        gameHeight: this.scale.height,
      });
    };
    paintChrome();
    this.scale.on('resize', paintChrome);
    window.addEventListener('resize', paintChrome);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', paintChrome);
      window.removeEventListener('resize', paintChrome);
    });

    // One gentle "where shall we go" line per app session (not every visit), after a short pause.
    if (!mapGuidancePlayed) {
      this.time.delayedCall(1200, () => {
        if (touched) return;
        mapGuidancePlayed = true;
        void context.audio.play(heLine('map.choose'));
      });
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      context.audio.stopAll();
      context.shell.hideGamePicker();
    });

    window.__GAME_READY__ = true;
  }
}
