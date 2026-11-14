// An animated animal built from an AnimalRig (layered SVG parts) or, until that art is
// available, from the single-image fallback rig. Visual states are driven by the pure
// CharacterStateMachine; all feel values come from ANIM_PROFILE.
//
// Display tree (all containers pivot at the feet unless noted):
//   root     position + constant rig scale (displayHeight / rig.height)
//   motion   action layer: hops (y), tilt (angle), squash & stretch (scaleX/Y)
//   breath   ambient layer: breathing scale + slow sway, always running
//   parts    body-level parts, plus `head` container at the head pivot holding the
//            head-attached parts (ears, eyes, mouth, mane) so they follow the head.
import Phaser from 'phaser';
import { ANIM_PROFILE } from './profiles';
import { amp, ampScale } from './motion';
import { CharacterStateMachine, type CharacterState } from './stateMachine';
import { resolveCharacterArt } from './characterArt';
import { fallbackAnchors, type CharacterArtPlan } from './fallbackRig';
import { PART_IDS, type RigPart } from './rigTypes';
import { randomBetween } from './arc';
import { Juice } from './juice';
import { chain } from './tweens';

const C = ANIM_PROFILE.character;
type AnyTween = Phaser.Tweens.Tween | Phaser.Tweens.TweenChain;
type MouthMode = 'smile' | 'open' | 'hmm';

export interface CharacterOptions {
  kind: string;
  x: number;
  /** Feet y in scene coordinates. */
  y: number;
  /** On-screen height of the full character, px. */
  displayHeight: number;
  depth?: number;
}

export class Character {
  readonly root: Phaser.GameObjects.Container;
  readonly kind: string;
  readonly isFallback: boolean;
  private readonly motion: Phaser.GameObjects.Container;
  private readonly breath: Phaser.GameObjects.Container;
  private head?: Phaser.GameObjects.Container;
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  private accessories: Phaser.GameObjects.GameObject[] = [];
  private readonly plan: CharacterArtPlan;
  private readonly sm = new CharacterStateMachine();
  private readonly ambientTweens: Phaser.Tweens.Tween[] = [];
  private readonly ambientTimers = new Map<string, Phaser.Time.TimerEvent>();
  private readonly actionTweens = new Set<AnyTween>();
  private readonly actionTimers = new Set<Phaser.Time.TimerEvent>();
  private pendingResolve: (() => void) | null = null;
  private destroyed = false;
  private readonly onShutdown = () => this.destroy();
  private readonly mouthAnchorY: number;
  private readonly headAnchorY: number;

  constructor(private readonly scene: Phaser.Scene, opts: CharacterOptions) {
    this.kind = opts.kind;
    this.plan = resolveCharacterArt(scene, opts.kind);
    this.isFallback = this.plan.fallback;
    const rig = this.plan.rig;

    this.root = scene.add.container(opts.x, opts.y);
    this.root.setScale(opts.displayHeight / rig.height);
    if (opts.depth !== undefined) this.root.setDepth(opts.depth);
    this.motion = scene.add.container(0, 0);
    this.breath = scene.add.container(0, 0);
    this.root.add(this.motion);
    this.motion.add(this.breath);

    if (this.isFallback) {
      this.breath.add(this.makePart(PART_IDS.body, rig.parts.body, 0, 0));
      const anchors = fallbackAnchors();
      this.mouthAnchorY = anchors.mouthY;
      this.headAnchorY = anchors.headY;
    } else {
      this.buildLayered();
      const head = rig.parts[PART_IDS.head];
      const mouth = rig.parts[PART_IDS.mouth];
      this.mouthAnchorY = mouth ? mouth.y : -rig.height * 0.6;
      this.headAnchorY = head ? head.y - head.height * 0.5 : -rig.height * 0.7;
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    this.startAmbient();
  }

  // ---------------------------------------------------------------- building

  private makePart(id: string, part: RigPart, offsetX: number, offsetY: number): Phaser.GameObjects.Image {
    const textureKey = this.plan.textures[part.key];
    const img = this.scene.make.image({ key: textureKey, x: part.x - offsetX, y: part.y - offsetY, add: false });
    img.setOrigin(part.originX, part.originY);
    img.setDisplaySize(part.width, part.height);
    if (part.flipX) img.setFlipX(true);
    this.images.set(id, img);
    return img;
  }

  private buildLayered(): void {
    const parts = this.plan.rig.parts;
    const headPart = parts[PART_IDS.head];
    const bodyLevel: { depth: number; obj: Phaser.GameObjects.GameObject }[] = [];
    const headLevel: { depth: number; obj: Phaser.GameObjects.GameObject }[] = [];

    if (headPart) {
      this.head = this.scene.add.container(headPart.x, headPart.y);
      bodyLevel.push({ depth: headPart.depth, obj: this.head });
      headLevel.push({ depth: headPart.depth, obj: this.makePart(PART_IDS.head, headPart, headPart.x, headPart.y) });
    }
    for (const [id, part] of Object.entries(parts)) {
      if (id === PART_IDS.head) continue;
      if (part.parent === 'head' && headPart) {
        headLevel.push({ depth: part.depth, obj: this.makePart(id, part, headPart.x, headPart.y) });
      } else {
        bodyLevel.push({ depth: part.depth, obj: this.makePart(id, part, 0, 0) });
      }
    }
    bodyLevel.sort((a, b) => a.depth - b.depth).forEach((e) => this.breath.add(e.obj));
    if (this.head) headLevel.sort((a, b) => a.depth - b.depth).forEach((e) => this.head!.add(e.obj));
  }

  // ---------------------------------------------------------------- accessories

  /**
   * Mounts wardrobe accessories (replacing the previous ones). Coordinates inside each object are in rig
   * reference px: head items are relative to the head pivot and follow the head; the other two groups are
   * relative to the feet centre. `behindHead` sits between the body and the head group, `head` above the head
   * parts, `front` above everything (the scarf). Layered rigs only: the single-image fallback has no head group,
   * so its head items are not drawn.
   */
  setAccessories(layers: {
    behindHead: Phaser.GameObjects.GameObject[];
    head: Phaser.GameObjects.GameObject[];
    front: Phaser.GameObjects.GameObject[];
  }): void {
    if (this.destroyed) return;
    this.scene.tweens.killTweensOf(this.accessories);
    for (const obj of this.accessories) obj.destroy();
    this.accessories = [];
    layers.behindHead.forEach((obj) => {
      const at = this.head ? this.breath.getIndex(this.head) : this.breath.length;
      this.breath.addAt(obj, at);
      this.accessories.push(obj);
    });
    for (const obj of layers.head) {
      if (this.head) {
        this.head.add(obj);
        this.accessories.push(obj);
      } else obj.destroy();
    }
    for (const obj of layers.front) {
      this.breath.add(obj);
      this.accessories.push(obj);
    }
  }

  // ---------------------------------------------------------------- queries

  get state(): CharacterState {
    return this.sm.state;
  }

  get x(): number {
    return this.root.x;
  }

  /** Scene-space point of the mouth, for food flying in. */
  mouthPoint(out: Phaser.Math.Vector2 = new Phaser.Math.Vector2()): Phaser.Math.Vector2 {
    const mouth = this.images.get(PART_IDS.mouth);
    if (mouth && this.head) {
      return this.head.getWorldTransformMatrix().transformPoint(mouth.x, mouth.y, out) as Phaser.Math.Vector2;
    }
    return this.breath.getWorldTransformMatrix().transformPoint(0, this.mouthAnchorY, out) as Phaser.Math.Vector2;
  }

  /** Scene-space point just above the head, for hearts. */
  headPoint(out: Phaser.Math.Vector2 = new Phaser.Math.Vector2()): Phaser.Math.Vector2 {
    return this.breath.getWorldTransformMatrix().transformPoint(0, this.headAnchorY, out) as Phaser.Math.Vector2;
  }

  /** Bounding size in scene px, for hit areas. */
  displaySize(): { width: number; height: number } {
    const h = this.plan.rig.height * this.root.scaleY;
    return { width: h * 0.8, height: h };
  }

  // ---------------------------------------------------------------- internals

  private trackTween<T extends AnyTween>(t: T): T {
    this.actionTweens.add(t);
    t.once(Phaser.Tweens.Events.TWEEN_COMPLETE, () => this.actionTweens.delete(t));
    return t;
  }

  private trackTimer(t: Phaser.Time.TimerEvent): Phaser.Time.TimerEvent {
    this.actionTimers.add(t);
    return t;
  }

  /** Stops the running action and resolves whoever was awaiting it. */
  private stopActions(): void {
    for (const t of this.actionTweens) t.stop();
    this.actionTweens.clear();
    for (const t of this.actionTimers) t.remove(false);
    this.actionTimers.clear();
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve?.();
  }

  /** Starts an action for `state`; returns its token, or -1 if the transition is not allowed. */
  private begin(state: CharacterState): number {
    if (this.destroyed) return -1;
    if (!this.sm.canEnter(state)) return -1;
    const previous = this.sm.state;
    this.stopActions();
    // A head tilt left over from an interrupted hmm/talk must not stick through munch/happy.
    if (this.head && state !== 'talking' && state !== 'hmm' && (previous === 'hmm' || previous === 'talking')) {
      this.trackTween(this.scene.tweens.add({ targets: this.head, angle: 0, duration: 80, ease: 'Sine.easeOut' }));
    }
    return this.sm.request(state);
  }

  /** Promise that resolves when `finish(token)` runs or the action is superseded. */
  private actionPromise(): Promise<void> {
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  private finish(token: number): void {
    if (!this.sm.isCurrent(token)) return;
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    this.setMouth('smile');
    this.relax();
    this.sm.settle(token);
    resolve?.();
  }

  /** Eases the action layer back to rest (used when settling or switching states). */
  private relax(duration = 160, headAngle = true): void {
    this.trackTween(this.scene.tweens.add({ targets: this.motion, y: 0, angle: 0, scaleX: 1, scaleY: 1, duration, ease: 'Sine.easeOut' }));
    if (this.head) {
      // `headAngle: false` leaves the angle alone so a nod tween started right after does not fight it.
      const props = headAngle ? { angle: 0, scaleX: 1, scaleY: 1 } : { scaleX: 1, scaleY: 1 };
      this.trackTween(this.scene.tweens.add({ targets: this.head, ...props, duration, ease: 'Sine.easeOut' }));
    }
  }

  private setMouth(mode: MouthMode): void {
    const mouth = this.images.get(PART_IDS.mouth);
    if (!mouth) return;
    const fileKey = this.plan.rig.mouthKeys[mode];
    const key = this.plan.textures[fileKey];
    if (key && mouth.texture.key !== key) mouth.setTexture(key);
  }

  private setEyes(closed: boolean): void {
    const rig = this.plan.rig;
    for (const id of [PART_IDS.eyeL, PART_IDS.eyeR]) {
      const eye = this.images.get(id);
      const part = rig.parts[id];
      if (!eye || !part) continue;
      const key = this.plan.textures[closed ? rig.eyeClosedKey : part.key];
      if (key) eye.setTexture(key);
    }
  }

  private hop(fromX: number, toX: number, duration: number, hops: number, height: number): Phaser.Tweens.Tween {
    this.root.x = fromX;
    const h = amp(height);
    const motion = this.motion;
    const root = this.root;
    const dir = Math.sign(toX - fromX) || 1;
    return this.trackTween(
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: 'Linear',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          root.x = fromX + (toX - fromX) * Phaser.Math.Easing.Sine.Out(t);
          const phase = Math.abs(Math.sin(t * Math.PI * hops));
          motion.y = -phase * h;
          // Stretch in the air, squash near the ground.
          const s = phase > 0.15 ? 1 + 0.06 * phase : 1 - 0.08 * (1 - phase / 0.15);
          motion.scaleY = ampScale(s);
          motion.scaleX = ampScale(2 - s);
          motion.angle = amp(4) * dir * phase;
        },
      }),
    );
  }

  // ---------------------------------------------------------------- ambient life

  private startAmbient(): void {
    const s = this.scene;
    this.ambientTweens.push(
      s.tweens.add({
        targets: this.breath,
        scaleX: ampScale(C.breath.scaleX),
        scaleY: ampScale(C.breath.scaleY),
        duration: C.breath.duration,
        yoyo: true,
        repeat: -1,
        ease: C.breath.ease,
      }),
      s.tweens.add({
        targets: this.breath,
        angle: { from: -amp(C.sway.angle), to: amp(C.sway.angle) },
        duration: C.sway.duration,
        yoyo: true,
        repeat: -1,
        ease: C.sway.ease,
      }),
    );
    if (this.isFallback) return;
    this.schedule('blink', C.blink.minDelay, C.blink.maxDelay, () => {
      this.setEyes(true);
      this.ambientTimers.set('blinkOpen', s.time.delayedCall(C.blink.closedFor, () => this.setEyes(false)));
    });
    this.schedule('ears', C.ear.minDelay, C.ear.maxDelay, () => {
      const ears = [this.images.get(PART_IDS.earL), this.images.get(PART_IDS.earR)].filter(Boolean);
      ears.forEach((ear, i) =>
        s.tweens.add({
          targets: ear,
          angle: (i === 0 ? -1 : 1) * amp(C.ear.angle),
          duration: C.ear.duration,
          yoyo: true,
          repeat: C.ear.repeats,
          delay: i * 60,
          ease: 'Sine.easeInOut',
        }),
      );
    });
    this.schedule('tail', C.tail.minDelay, C.tail.maxDelay, () => {
      const tail = this.images.get(PART_IDS.tail);
      if (!tail) return;
      s.tweens.add({
        targets: tail,
        angle: { from: -amp(C.tail.angle), to: amp(C.tail.angle) },
        duration: C.tail.duration,
        yoyo: true,
        repeat: C.tail.repeats,
        ease: 'Sine.easeInOut',
        onComplete: () => tail.setAngle(0),
      });
    });
  }

  /** Repeats `fn` at random intervals in [min, max) ms until destroyed. */
  private schedule(name: string, min: number, max: number, fn: () => void): void {
    const next = () => {
      if (this.destroyed) return;
      this.ambientTimers.set(
        name,
        this.scene.time.delayedCall(randomBetween(min, max), () => {
          if (this.destroyed) return;
          if (this.sm.state !== 'exit') fn();
          next();
        }),
      );
    };
    next();
  }

  // ---------------------------------------------------------------- states

  /** Hops in from `fromX` to the current x, lands with a squash, then idles. */
  enter(fromX: number): Promise<void> {
    const toX = this.root.x;
    const token = this.begin('enter');
    if (token < 0) return Promise.resolve();
    const p = this.actionPromise();
    this.hop(fromX, toX, C.enter.duration, C.enter.hops, C.enter.hopHeight).once(Phaser.Tweens.Events.TWEEN_COMPLETE, () => {
      this.trackTween(
        chain(this.scene, {
          targets: this.motion,
          tweens: [
            { y: 0, angle: 0, scaleX: ampScale(1.12), scaleY: ampScale(0.88), duration: 90, ease: 'Quad.easeOut' },
            { scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.easeOut' },
          ],
          onComplete: () => this.finish(token),
        }),
      );
    });
    return p;
  }

  /** Mouth flaps while `speech` is pending (capped), then returns to idle. */
  async talk(speech: Promise<unknown>, maxMs = 10000): Promise<void> {
    const settled = speech.then(
      () => undefined,
      () => undefined,
    );
    const token = this.begin('talking');
    if (token < 0) {
      await settled;
      return;
    }
    this.relax(120, false);
    let open = false;
    this.trackTimer(
      this.scene.time.addEvent({
        delay: C.talk.flapMs,
        loop: true,
        callback: () => {
          open = !open;
          this.setMouth(open ? 'open' : 'smile');
        },
      }),
    );
    this.trackTween(
      this.scene.tweens.add({
        targets: this.head ?? this.motion,
        ...(this.head ? { angle: amp(C.talk.nodAngle) } : { scaleY: ampScale(1.025), scaleX: ampScale(0.985) }),
        duration: C.talk.nodDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );
    const p = this.actionPromise();
    const cap = this.trackTimer(this.scene.time.delayedCall(maxMs, () => this.finish(token)));
    void settled.then(() => {
      cap.remove(false);
      this.finish(token);
    });
    await p;
  }

  /** Bounce with squash-and-stretch and a heart burst. */
  happy(): Promise<void> {
    const token = this.begin('happy');
    if (token < 0) return Promise.resolve();
    const p = this.actionPromise();
    this.setMouth('open');
    const jump = amp(C.happy.jumpHeight);
    const d = C.happy.duration;
    const head = this.headPoint();
    Juice.for(this.scene).burst('heart', head.x, head.y, C.happy.hearts);
    this.trackTween(
      chain(this.scene, {
        targets: this.motion,
        tweens: [
          { scaleX: ampScale(1.16), scaleY: ampScale(0.84), y: 0, duration: d * 0.14, ease: 'Quad.easeOut' },
          { scaleX: ampScale(0.9), scaleY: ampScale(1.12), y: -jump, duration: d * 0.3, ease: 'Quad.easeOut' },
          { scaleX: 1, scaleY: 1, y: 0, duration: d * 0.26, ease: 'Quad.easeIn' },
          { scaleX: ampScale(1.12), scaleY: ampScale(0.88), duration: d * 0.1, ease: 'Quad.easeOut' },
          { scaleX: 1, scaleY: 1, duration: d * 0.2, ease: 'Back.easeOut' },
        ],
        onComplete: () => this.finish(token),
      }),
    );
    return p;
  }

  /** Chew loop with crumbs, for `duration` ms. */
  munch(duration: number = C.munch.duration): Promise<void> {
    const token = this.begin('munch');
    if (token < 0) return Promise.resolve();
    const p = this.actionPromise();
    const juice = Juice.for(this.scene);
    const mouth = this.mouthPoint();
    juice.burst('crumb', mouth.x, mouth.y, C.munch.crumbs);
    let open = true;
    this.setMouth('open');
    this.trackTimer(
      this.scene.time.addEvent({
        delay: C.munch.chewMs,
        loop: true,
        callback: () => {
          open = !open;
          this.setMouth(open ? 'open' : 'smile');
        },
      }),
    );
    this.trackTimer(
      this.scene.time.delayedCall(duration * 0.5, () => {
        const m = this.mouthPoint();
        juice.burst('crumb', m.x, m.y, Math.ceil(C.munch.crumbs / 2));
      }),
    );
    this.trackTween(
      this.scene.tweens.add({
        targets: this.head ?? this.motion,
        scaleY: ampScale(C.munch.chewScaleY),
        scaleX: this.head ? 1 : ampScale(2 - C.munch.chewScaleY),
        duration: C.munch.chewMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );
    this.trackTimer(this.scene.time.delayedCall(duration, () => this.finish(token)));
    return p;
  }

  /** Gentle "hmm": head tilt and hmm mouth. Never a shake, never sad. */
  hmm(): Promise<void> {
    const token = this.begin('hmm');
    if (token < 0) return Promise.resolve();
    const p = this.actionPromise();
    this.setMouth('hmm');
    const d = C.hmm.duration;
    const target = this.head ?? this.motion;
    const angle = amp(this.head ? C.hmm.headAngle : C.hmm.bodyAngle);
    this.trackTween(
      chain(this.scene, {
        targets: target,
        tweens: [
          { angle, duration: d * 0.3, ease: C.hmm.ease },
          { angle: angle * 0.7, duration: d * 0.4, ease: C.hmm.ease },
          { angle: 0, duration: d * 0.3, ease: C.hmm.ease },
        ],
        onComplete: () => this.finish(token),
      }),
    );
    return p;
  }

  /** Small squash when the child pokes the animal. Not a state; skipped while busy. */
  poke(): void {
    if (this.destroyed || this.sm.isBusy() || this.sm.state === 'hmm') return;
    const P = ANIM_PROFILE.character.poke;
    this.trackTween(
      this.scene.tweens.add({
        targets: this.motion,
        scaleX: ampScale(P.scaleX),
        scaleY: ampScale(P.scaleY),
        duration: P.duration,
        yoyo: true,
        ease: 'Quad.easeOut',
      }),
    );
  }

  /** Waves (a happy rock), then hops off toward `toX`. Ends in state `gone`. */
  exit(toX: number): Promise<void> {
    const token = this.begin('exit');
    if (token < 0) return Promise.resolve();
    const p = this.actionPromise();
    this.setMouth('smile');
    const a = amp(C.exit.waveAngle);
    const done = () => {
      if (!this.sm.isCurrent(token)) return;
      this.sm.request('gone');
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve?.();
    };
    this.trackTween(
      chain(this.scene, {
        targets: this.motion,
        tweens: [
          { angle: a, duration: C.exit.waveDuration, ease: 'Sine.easeInOut' },
          { angle: -a, duration: C.exit.waveDuration, ease: 'Sine.easeInOut', yoyo: true, repeat: C.exit.waveRepeats - 1 },
          { angle: 0, duration: C.exit.waveDuration, ease: 'Sine.easeInOut' },
        ],
        onComplete: () => {
          if (!this.sm.isCurrent(token)) return;
          this.hop(this.root.x, toX, C.exit.duration, C.exit.hops, C.exit.hopHeight).once(Phaser.Tweens.Events.TWEEN_COMPLETE, done);
        },
      }),
    );
    return p;
  }

  /** Kills every tween/timer this character owns and removes it from the scene. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    this.stopActions();
    for (const t of this.ambientTweens) t.remove();
    this.ambientTweens.length = 0;
    for (const t of this.ambientTimers.values()) t.remove(false);
    this.ambientTimers.clear();
    const animated: Phaser.GameObjects.GameObject[] = [this.root, this.motion, this.breath, ...this.images.values()];
    if (this.head) animated.push(this.head);
    this.scene.tweens.killTweensOf(animated);
    this.root.destroy();
    this.images.clear();
    if (this.sm.state !== 'gone') this.sm.request('gone');
  }
}
