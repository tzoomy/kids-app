// SortingScene: Sorting Beds (Number Garden). Spec: docs/specs/sorting-beds.md. Contract: docs/contracts/sorting-beds.md.
//
// CONTRACT (implemented against the tests; do not change these without a spec change):
// - Scene key: 'SortingScene'. Started from MapScene when the world's `entryGameId` is 'sorting-beds'.
// - create() calls setAppScreen('sorting') and sets window.__GAME_READY__ = true.
// - `getSortingInfo(): SortingInfo | null` (src/games/sorting/types.ts). Rectangles are page CSS px (see
//   src/testing/pageRect.ts, `gameRectToPageRect`). Return null when no round exists; `ready` is true only
//   when the current flower is in the basket and bed taps are accepted.
// - Hooks live in src/game/createGame.ts under ?e2e=1: `getSortingInfo()` and `seedSortingLevel(level)`.
//   They only read or seed state; they never act in the game or navigate.
// - Chrome test ids: hud-back, hud-help, prompt-bubble, help-card, help-card-close (RestaurantHud, renderPromptBubble,
//   showHelpOverlay via context.shell). star-count and leisure-balance come from the same HUD.
// - Pure rules live in ./sortingLogic.ts, layout in ./sortingLayout.ts, art (with procedural fallbacks) in
//   ./sortingArt.ts, Phaser motion in ./sortingMotion.ts (ANIM_PROFILE.sorting).
// - Tap targets: beds and the basket flower are at least 64 CSS px in both orientations; never shrink them.
// - One tap on a bed places the current flower (no select step). A wrong tap leaves the flower in the basket and
//   locks bed taps for WRONG_TAP_LOCK_MS. Tapping the basket flower replays the rule line and is not a hint.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import type { LearningSession } from '../../core/leisure';
import { buildMeta, type GameLevelsMeta, type SkillSession } from '../../core/adaptive';
import type { AgeTrackConfig, SortingBedsContent } from '../../content/schema';
import { Juice } from '../../anim/juice';
import { transitionTo } from '../../anim/transitions';
import { bounce, hintPulse, popIn, shakeSoft, wait, wobble } from '../../anim/tweens';
import { setAppScreen } from '../../pwa';
import { gameRectToPageRect } from '../../testing/pageRect';
import type { Lang } from '../templates/choiceServe';
import { nextRoundLanguage } from '../restaurant/trialTracker';
import {
  RULE_SWITCH_AFTER_PLACEMENTS,
  SortingTrialTracker,
  WRONG_TAP_LOCK_MS,
  bedPresentation,
  buildRound,
  chooseFirstFlower,
  levelLevers,
  placementWordLines,
  ruleLine,
  switchLine,
  visitAttribute,
  flowerId,
  type BedAccepts,
  type BedPresentation,
  type FlowerSpec,
  type LineRequest,
  type RoundPlan,
  type RoundFlowerPlan,
} from './sortingLogic';
import { computeSortingLayout, type BedSlotLayout, type LayoutRect, type SortingLayout } from './sortingLayout';
import { addBackground, makeBasket, makeBed, makeFlower, makeRuleIcon, makeSign } from './sortingArt';
import { bloomFlowers, dropIntoBed, hopToward, switchRule } from './sortingMotion';
import { SORTING_LINE_TEXT, rtlIsolate } from './sortingVoice';
import type { SortingInfo, SortRule } from './types';

export type { SortingInfo, SortingBedInfo, SortingCurrentItem, SortRule, SortAttribute, FlowerColor, FlowerShape, FlowerSize, PageRect } from './types';

/** Longest wait for a Hebrew guidance line before the game moves on (device TTS can hang without a voice). */
const HE_LINE_MAX_MS = 3600;
/** Longest wait for one English or French token. */
const WORD_LINE_MAX_MS = 1600;
const ROUND_END_HOLD_MS = 900;


interface BedView {
  plan: RoundPlanBed;
  slot: BedSlotLayout;
  root: Phaser.GameObjects.Container;
  /** Sign (post + plaque + icons), flipped on the L8 switch. */
  sign: Phaser.GameObjects.Container;
  plantLayer: Phaser.GameObjects.Container;
  ghostLayer: Phaser.GameObjects.Container;
  highlight: Phaser.GameObjects.Graphics;
  planted: Phaser.GameObjects.Container[];
  accepts: BedAccepts;
  count: number;
  bloomed: boolean;
  /** Next free planting slot index. */
  nextSlot: number;
  zone: Phaser.GameObjects.Zone | null;
}

type RoundPlanBed = RoundPlan['beds'][number];

export class SortingScene extends Phaser.Scene {
  private context!: AppContext;
  private content!: SortingBedsContent;
  private session!: LearningSession;
  private skills!: SkillSession;
  private meta!: GameLevelsMeta;
  private ageConfig!: AgeTrackConfig;
  private layout!: SortingLayout;
  private basket?: { back: Phaser.GameObjects.GameObject; front: Phaser.GameObjects.GameObject };
  private pileItems: Phaser.GameObjects.Container[] = [];
  private beds: BedView[] = [];
  private plan: RoundPlan | null = null;
  private presentation: BedPresentation | null = null;
  private roundLevel = 1;
  private roundLang: Lang = 'en';
  private roundIndex = 0;
  private rule: SortRule = 'color';
  private ruleSwitched = false;
  private flowerIndex = 0;
  private current: { plan: RoundFlowerPlan; view: Phaser.GameObjects.Container; tries: number } | null = null;
  private tracker: SortingTrialTracker | null = null;
  private ready = false;
  private lockedUntil = 0;
  private token = 0;
  private speakSeq = 0;
  private speaking = false;
  private helpOpen = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private visibilityHandler?: () => void;

  constructor() {
    super('SortingScene');
  }

  create(): void {
    setAppScreen('sorting');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.content = this.context.content.sorting;
    const profileId = this.context.requireProfileId();
    const profile = this.context.store.getState().profiles.find((p) => p.id === profileId);
    const track = profile?.ageTrack ?? 'age5';
    const adaptive = this.content.adaptive;
    this.ageConfig = this.content.ageTracks[track];
    this.meta = buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules });
    this.skills = this.context.createSkillSession(this.content.world, this.content.id, this.meta);
    this.session = this.context.createLearningSession();
    this.session.start();
    this.beds = [];
    this.pileItems = [];
    this.plan = null;
    this.current = null;
    this.ready = false;
    this.helpOpen = false;
    this.speaking = false;
    this.roundIndex = 0;
    this.token++;

    // Visit counter per profile, persisted in the profile state (cycles colour, shape, size across visits, AC-21).
    const profileState = this.context.store.getProfileState(profileId, new Date(this.context.nowMs()));
    const visits = profileState.gameVisits ?? {};
    const visit = Number.isInteger(visits[this.content.id]) && visits[this.content.id] >= 0 ? visits[this.content.id] : 0;
    profileState.gameVisits = { ...visits, [this.content.id]: visit + 1 };
    this.context.store.persist();
    this.visitIndex = visit;

    this.visibilityHandler = () => {
      this.session.setHidden(document.hidden);
      if (document.hidden) this.context.audio.stopAll();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.session.tick(1);
        this.context.store.persist();
        this.updateHud();
      },
    });

    addBackground(this, this.scale.width, this.scale.height);
    this.buildHud();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.startRound(true);
    window.__GAME_READY__ = true;
  }

  private visitIndex = 0;

  // -------------------------------------------------------------------------------------------
  // Hook data
  // -------------------------------------------------------------------------------------------

  getSortingInfo(): SortingInfo | null {
    if (!this.plan || !this.presentation) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const toPage = (r: LayoutRect) =>
      gameRectToPageRect(r, { x: box.left, y: box.top, width: box.width, height: box.height }, { width: this.scale.width, height: this.scale.height });
    const pres = this.presentation;
    const current = this.current;
    const acceptingTaps = this.ready && current !== null && this.time.now >= this.lockedUntil;
    return {
      level: this.roundLevel,
      rule: this.rule,
      ruleSwitched: this.ruleSwitched,
      beds: this.beds.map((b) => ({
        id: b.plan.id,
        label: pres.label,
        ghostSlots: pres.ghostSlots,
        accepts: { ...b.accepts },
        example: b.plan.example ? flowerId(b.plan.example) : null,
        count: b.count,
        capacity: b.plan.capacity,
        bloomed: b.bloomed,
        hit: toPage(b.slot.hit),
      })),
      currentItem:
        current && this.ready
          ? {
              id: current.plan.id,
              color: current.plan.color,
              shape: current.plan.shape,
              size: current.plan.size,
              targetBedId: current.plan.targetBedId,
              tries: current.tries,
              hinted: this.tracker?.isHinted ?? false,
              hit: toPage(this.layout.basket.hit),
            }
          : null,
      lang: this.roundLang,
      ready: acceptingTaps,
    };
  }

  // -------------------------------------------------------------------------------------------
  // Lifecycle and chrome
  // -------------------------------------------------------------------------------------------

  private cleanup(): void {
    this.token++;
    this.hintTimer?.remove();
    this.context.audio.stopAll();
    this.context.shell.clearPromptBubble();
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.session.exit();
    this.skills.endVisit();
    this.beds = [];
    this.current = null;
    this.plan = null;
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  private profileState() {
    return this.context.store.getProfileState(this.context.requireProfileId(), new Date(this.context.nowMs()));
  }

  private buildHud(): void {
    const state = this.profileState();
    const settings = this.context.store.getState().settings;
    this.context.shell.setRestaurantChrome({
      starCount: state.stars,
      balanceSec: state.balanceSec,
      earnedTodaySec: state.earnedTodaySec,
      dailyCapSec: settings.dailyEarnCapMinutes * 60,
      onBack: () => this.goBack(),
      onHelp: () => this.showHelp(),
    });
  }

  private updateHud(): void {
    const state = this.profileState();
    const settings = this.context.store.getState().settings;
    this.context.shell.updateRestaurantChrome({
      balanceSec: state.balanceSec,
      earnedTodaySec: state.earnedTodaySec,
      dailyCapSec: settings.dailyEarnCapMinutes * 60,
    });
  }

  private goBack(): void {
    this.context.audio.stopAll();
    this.context.store.persist();
    this.context.shell.clearPromptBubble();
    transitionTo(this, 'MapScene', { style: 'iris' });
  }

  private showHelp(): void {
    this.session.reportInteraction();
    this.helpOpen = true;
    const text = SORTING_LINE_TEXT['sorting.help.he'];
    void this.say({ lineId: 'sorting.help.he', lang: 'he' }, HE_LINE_MAX_MS);
    this.context.shell.showHelp(text, () => {
      this.helpOpen = false;
      this.session.reportInteraction();
    });
  }

  // -------------------------------------------------------------------------------------------
  // Voice
  // -------------------------------------------------------------------------------------------

  /** Requests one line; resolves when it ends or after `maxMs`, whichever comes first. Never blocks forever. */
  private say(line: LineRequest, maxMs: number): Promise<void> {
    const seq = ++this.speakSeq;
    this.speaking = true;
    this.session.reportListening(true);
    const text = SORTING_LINE_TEXT[line.lineId] ?? '';
    const played = this.context.audio.play({ lineId: line.lineId, lang: line.lang, text });
    const done = () => {
      if (seq === this.speakSeq) {
        this.speaking = false;
        this.session.reportListening(false);
      }
    };
    void played.finally(done);
    return Promise.race([played.then(() => undefined), wait(this, maxMs)]).then(done);
  }

  private async sayAll(lines: readonly LineRequest[], token: number): Promise<void> {
    for (const line of lines) {
      if (token !== this.token) return;
      await this.say(line, line.lang === 'he' ? HE_LINE_MAX_MS : WORD_LINE_MAX_MS);
    }
  }

  private showRuleBubble(): void {
    const line = ruleLine(this.rule);
    this.context.shell.setPromptBubble(rtlIsolate(SORTING_LINE_TEXT[line.lineId] ?? ''), () => this.replayRule());
  }

  // -------------------------------------------------------------------------------------------
  // Rounds
  // -------------------------------------------------------------------------------------------

  private startRound(first: boolean): void {
    const token = ++this.token;
    this.hintTimer?.remove();
    this.ready = false;
    this.current = null;
    this.tracker = null;
    this.session.reportCelebrating(false);

    const settings = this.context.store.getState().settings;
    this.roundLang = nextRoundLanguage(first ? null : this.roundLang, this.skills.atRoundBoundary(this.roundLang), settings.languages);
    this.roundLevel = this.skills.level(this.roundLang);
    const level = this.content.adaptive.levels[this.roundLevel - 1];
    const levers = levelLevers(level);
    this.presentation = bedPresentation(level);
    this.plan = buildRound({
      levers,
      roundIndex: this.roundIndex,
      visitAttribute: visitAttribute(this.visitIndex, levers.choiceCount),
      flowerCount: this.meta.rules.trialsPerRound,
      random: Math.random,
      // The engine picks the first flower (a known one right after a level drop; this also clears afterDrop).
      preferredFirst: chooseFirstFlower(this.skills, this.roundLang),
    });
    this.roundIndex++;
    this.rule = this.plan.rule;
    this.ruleSwitched = false;
    this.flowerIndex = 0;

    this.buildGarden();
    this.showRuleBubble();
    void (async () => {
      await wait(this, 350);
      if (token !== this.token) return;
      await this.say(ruleLine(this.rule), HE_LINE_MAX_MS);
      if (token !== this.token) return;
      this.nextFlower(token);
    })();
    // Flowers may pop in while the rule line plays; the first one waits for the line (or its cap).
  }

  private buildGarden(): void {
    for (const b of this.beds) {
      b.root.destroy(true);
      b.zone?.destroy();
    }
    this.beds = [];
    this.pileItems.forEach((p) => p.destroy(true));
    this.pileItems = [];
    if (this.basket) {
      this.basket.back.destroy();
      this.basket.front.destroy();
    }
    const plan = this.plan!;
    const pres = this.presentation!;
    const twoIconSigns = pres.label !== 'none' && plan.beds.some((b) => Object.keys(b.accepts).length > 1);
    this.layout = computeSortingLayout(this.scale.width, this.scale.height, plan.beds.length, { twoIconSigns });

    plan.beds.forEach((bedPlan, i) => {
      const slot = this.layout.beds[i];
      const root = this.add.container(slot.x, slot.y).setDepth(20);
      const sign = makeSign(this, slot.sign.width, slot.sign.height);
      sign.setPosition(slot.sign.x - slot.x, slot.sign.y - slot.y);
      root.add(sign);
      this.fillPlaque(sign, bedPlan.accepts, pres, slot);
      const bed = makeBed(this, slot.width, slot.height);
      const highlight = this.add.graphics();
      highlight.fillStyle(0xfff3a0, 0.55);
      highlight.fillEllipse(0, 0, slot.width * 1.08, slot.height * 1.05);
      highlight.setAlpha(0);
      const ghostLayer = this.add.container(0, 0);
      const plantLayer = this.add.container(0, 0);
      root.add([highlight, bed.back, ghostLayer, plantLayer, bed.front]);
      if (pres.label === 'picture') {
        // Picture label: the rule icon repeated large on the front of the bed (inside the bed's tap target).
        const icons = this.iconsFor(bedPlan.accepts, slot.height * 0.34);
        const badgeY = slot.height * 0.2;
        icons.forEach((icon, k) => {
          icon.setPosition((k - (icons.length - 1) / 2) * slot.height * 0.46, badgeY);
          root.add(icon);
        });
      }
      const view: BedView = {
        plan: bedPlan,
        slot,
        root,
        sign,
        plantLayer,
        ghostLayer,
        highlight,
        planted: [],
        accepts: { ...bedPlan.accepts },
        count: 0,
        bloomed: false,
        nextSlot: 0,
        zone: null,
      };
      if (bedPlan.example) this.plant(view, bedPlan.example, false);
      if (pres.ghostSlots) this.drawGhosts(view);
      // Hit area: the whole bed column, as a fixed zone so shakes and pulses never move the target.
      const zone = this.add.zone(slot.hit.x + slot.hit.width / 2, slot.hit.y + slot.hit.height / 2, slot.hit.width, slot.hit.height);
      zone.setInteractive();
      zone.on('pointerdown', () => this.onBedTap(view));
      view.zone = zone;
      void popIn(this, root, 60 + i * 70);
      this.beds.push(view);
    });

    const b = this.layout.basket;
    this.basket = makeBasket(this, b.width, b.height);
    (this.basket.back as unknown as Phaser.GameObjects.Components.Transform).setPosition(b.x, b.y);
    (this.basket.front as unknown as Phaser.GameObjects.Components.Transform).setPosition(b.x, b.y);
    (this.basket.back as unknown as Phaser.GameObjects.Components.Depth).setDepth(60);
    (this.basket.front as unknown as Phaser.GameObjects.Components.Depth).setDepth(80);
    this.refreshPile();
  }

  private iconsFor(accepts: BedAccepts, size: number): Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform> {
    const icons: Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform> = [];
    if (accepts.size) icons.push(makeRuleIcon(this, 'size', accepts.size, size));
    if (accepts.color) icons.push(makeRuleIcon(this, 'color', accepts.color, size));
    if (accepts.shape) icons.push(makeRuleIcon(this, 'shape', accepts.shape, size));
    return icons;
  }

  /** Plaque icons: picture and symbol show the rule icon(s); label 'none' leaves the plaque blank. */
  private fillPlaque(sign: Phaser.GameObjects.Container, accepts: BedAccepts, pres: BedPresentation, slot: BedSlotLayout): void {
    sign.list.filter((o) => o.getData('ruleIcon')).forEach((o) => o.destroy());
    if (pres.label === 'none') return;
    // The plaque panel is the 160x160 square at (60..220, 54..214) of the 280x360 sign box.
    const panel = (160 / 280) * slot.sign.width;
    const panelCy = ((134 - 180) / 360) * slot.sign.height;
    const each = accepts.size && (accepts.color || accepts.shape) ? panel * 0.54 : panel * 0.92;
    const icons = this.iconsFor(accepts, each);
    icons.forEach((icon, k) => {
      icon.setPosition((k - (icons.length - 1) / 2) * each * 0.9, panelCy);
      icon.setData('ruleIcon', true);
      sign.add(icon);
    });
  }

  private slotPosition(view: BedView, slotIndex: number): { x: number; y: number } {
    const xs = view.slot.slotXs;
    const x = xs[Math.min(slotIndex, xs.length - 1)] - view.slot.x;
    const y = view.slot.soilY - view.slot.y;
    return { x, y };
  }

  /** Plants a flower in the next slot of a bed (local coordinates); counted unless it is an example. */
  private plant(view: BedView, spec: FlowerSpec, counted: boolean, existing?: Phaser.GameObjects.Container): Phaser.GameObjects.Container {
    const { x, y } = this.slotPosition(view, view.nextSlot);
    view.nextSlot++;
    const flower = existing ?? makeFlower(this, spec, view.slot.flowerHeight);
    flower.setPosition(x, y);
    flower.setScale(1);
    flower.setAngle(0);
    view.plantLayer.add(flower);
    view.planted.push(flower);
    if (counted) view.count++;
    // A planted flower covers its ghost slot.
    const ghost = view.ghostLayer.list.find((g) => g.getData('slot') === view.nextSlot - 1) as Phaser.GameObjects.Container | undefined;
    ghost?.setVisible(false);
    return flower;
  }

  private drawGhosts(view: BedView): void {
    const targets = this.plan!.flowers.filter((f) => f.targetBedId === view.plan.id);
    targets.forEach((spec, k) => {
      const slotIndex = view.nextSlot + k;
      const { x, y } = this.slotPosition(view, slotIndex);
      const ghost = makeFlower(this, spec, view.slot.flowerHeight);
      ghost.setPosition(x, y).setAlpha(0.28);
      ghost.setData('slot', slotIndex);
      view.ghostLayer.add(ghost);
    });
  }

  private refreshPile(): void {
    this.pileItems.forEach((p) => p.destroy(true));
    this.pileItems = [];
    const plan = this.plan;
    if (!plan) return;
    const waiting = plan.flowers.slice(this.flowerIndex + (this.current ? 1 : 0));
    waiting.slice(0, this.layout.pile.length).forEach((spec, i) => {
      const p = this.layout.pile[i];
      const f = makeFlower(this, spec, this.layout.basket.flowerHeight * 0.45);
      f.setPosition(p.x, p.y).setAngle(i % 2 === 0 ? -72 : 70).setDepth(50).setAlpha(0.95);
      this.pileItems.push(f);
    });
  }

  private nextFlower(token: number): void {
    const plan = this.plan;
    if (!plan || token !== this.token) return;
    const spec = plan.flowers[this.flowerIndex];
    if (!spec) return;
    const b = this.layout.basket;
    const view = makeFlower(this, spec, b.flowerHeight);
    view.setPosition(b.x, b.flowerBaseY).setDepth(70);
    this.current = { plan: spec, view, tries: 0 };
    this.tracker = new SortingTrialTracker(spec.id, this.roundLang);
    this.refreshPile();
    this.context.sfx.pop();
    // The basket flower is not a bed: tapping it wiggles and repeats the rule line.
    const hit = b.hit;
    const zone = this.add.zone(hit.x + hit.width / 2, hit.y + hit.height / 2, hit.width, hit.height).setDepth(75);
    zone.setInteractive();
    zone.on('pointerdown', () => this.replayRule());
    view.setData('zone', zone);
    void popIn(this, view, 0).then(() => {
      if (token !== this.token || this.current?.view !== view) return;
      this.ready = true;
      this.scheduleHint(token);
    });
  }

  private scheduleHint(token: number): void {
    this.hintTimer?.remove();
    this.hintTimer = undefined;
    if (this.ageConfig.hintMode !== 'demonstrate') return; // age 5: no idle hint (hint only after a mistake)
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint(token));
  }

  private giveHint(token: number): void {
    if (token !== this.token || !this.current || !this.ready || !this.tracker || this.tracker.isRecorded) return;
    if (this.helpOpen || this.speaking) {
      // Wait out a playing line or the open help card, then retry after another hintDelayMs.
      this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint(token));
      return;
    }
    this.hintTimer = undefined;
    this.tracker.onHint();
    this.context.sfx.hint();
    const bed = this.beds.find((b) => b.plan.id === this.current?.plan.targetBedId);
    if (bed) {
      void hintPulse(this, bed.root);
      Juice.for(this).burst('sparkle', bed.slot.x, bed.slot.y - bed.slot.height * 0.4);
      void hopToward(this, this.current.view, bed.slot.x, bed.slot.soilY);
    }
    void this.say(ruleLine(this.rule), HE_LINE_MAX_MS);
  }

  private replayRule(): void {
    this.session.reportInteraction();
    if (this.current) {
      this.tracker?.onReplay();
      void wobble(this, this.current.view);
    }
    void this.say(ruleLine(this.rule), HE_LINE_MAX_MS);
  }

  private onBedTap(view: BedView): void {
    if (!this.current || !this.ready || !this.tracker) return;
    if (this.time.now < this.lockedUntil) return; // swallowed by the 400 ms lock: not a try, not an interaction
    this.session.reportInteraction();
    this.context.sfx.tap();
    this.current.tries++;
    const correct = view.plan.id === this.current.plan.targetBedId;
    const result = this.tracker.onBedTap(correct);
    if (result) this.skills.record(this.roundLang, result);
    if (correct) this.placeCurrent(view);
    else this.onWrongBed(view);
  }

  private onWrongBed(view: BedView): void {
    this.lockedUntil = this.time.now + WRONG_TAP_LOCK_MS;
    this.context.sfx.hint();
    void shakeSoft(this, view.root);
    const target = this.beds.find((b) => b.plan.id === this.current?.plan.targetBedId);
    if (target) {
      target.highlight.setAlpha(1);
      void hintPulse(this, target.root).then(() => target.highlight.setAlpha(0));
    }
    void this.say({ lineId: 'sorting.wrong.hint.he', lang: 'he' }, HE_LINE_MAX_MS);
  }

  private placeCurrent(view: BedView): void {
    const current = this.current;
    if (!current) return;
    const token = this.token;
    this.ready = false;
    this.hintTimer?.remove();
    const zone = current.view.getData('zone') as Phaser.GameObjects.Zone | undefined;
    zone?.destroy();
    this.current = null;
    const flower = current.view;
    // An idle-hint hop (or a wobble) may still be running: stop it so its hop-back never pulls the flower during the
    // drop, and start the drop from the basket.
    this.tweens.killTweensOf(flower);
    flower.setPosition(this.layout.basket.x, this.layout.basket.flowerBaseY).setAngle(0);
    flower.setDepth(85);
    const slot = this.slotPosition(view, view.nextSlot);
    const toX = view.slot.x + slot.x;
    const toY = view.slot.y + slot.y;
    const spec: FlowerSpec = current.plan;
    const placedRule = this.rule;
    void (async () => {
      await dropIntoBed(this, flower, toX, toY);
      if (token !== this.token) return;
      flower.destroy();
      this.plant(view, spec, true);
      this.flowerIndex++;
      const filled = !view.bloomed && view.plan.capacity > 0 && view.count === view.plan.capacity;
      if (filled) view.bloomed = true;
      Juice.for(this).burst('sparkle', toX, toY - view.slot.flowerHeight * 0.5);
      this.context.sfx.yay();

      const lines: LineRequest[] = [{ lineId: 'sorting.correct.he', lang: 'he' }, ...placementWordLines(placedRule, spec, this.roundLang)];
      if (filled) {
        this.session.reportCelebrating(true);
        void bloomFlowers(this, view.planted);
        Juice.for(this).burst('sparkle', view.slot.x, view.slot.y - view.slot.height * 0.6);
        lines.push({ lineId: 'sorting.bed-full.he', lang: 'he' });
      }
      await this.sayAll(lines, token);
      if (token !== this.token) return;
      this.session.reportCelebrating(false);

      const plan = this.plan!;
      if (this.flowerIndex >= plan.flowers.length) {
        await this.finishRound(token);
        return;
      }
      if (plan.switchAfter !== null && !this.ruleSwitched && this.flowerIndex >= (plan.switchAfter ?? RULE_SWITCH_AFTER_PLACEMENTS)) {
        await this.switchToShape(token);
        if (token !== this.token) return;
      }
      this.nextFlower(token);
    })();
  }

  private async switchToShape(token: number): Promise<void> {
    const plan = this.plan!;
    if (!plan.ruleAfterSwitch) return;
    this.rule = plan.ruleAfterSwitch;
    this.ruleSwitched = true;
    for (const b of this.beds) b.accepts = { ...(b.plan.acceptsAfterSwitch ?? b.accepts) };
    this.showRuleBubble();
    const flips = this.beds.map((b) => switchRule(this, b.sign, () => this.fillPlaque(b.sign, b.accepts, this.presentation!, b.slot)));
    await Promise.all([...flips, this.say(switchLine(this.rule), HE_LINE_MAX_MS)]);
    if (token !== this.token) return;
  }

  private async finishRound(token: number): Promise<void> {
    this.session.complete();
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();
    this.context.shell.updateRestaurantChrome({ starCount: state.stars });
    this.context.sfx.yay();
    const juice = Juice.for(this);
    juice.burst('confetti', this.scale.width / 2, this.scale.height * 0.4);
    this.beds.forEach((b, i) => {
      b.planted.forEach((f, k) => {
        this.time.delayedCall(80 * (i + k), () => {
          if (token === this.token && f.scene) void bounce(this, f, 22);
        });
      });
    });
    await wait(this, ROUND_END_HOLD_MS);
    if (token !== this.token) return;
    this.startRound(false);
  }
}
