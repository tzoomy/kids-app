// Workshop L20 physics world (v5.1 one chain): Phaser-free (the Matter library is passed in: Phaser's bundled build in the scene, the
// same build headless in tests). The geometry, masses, frictions, step and creation order match workshop-v5-notes sim/levels.cjs `X.L20`
// + sim/core.cjs (timeScale 1.25, resolver pin, the shared lever), so a seeded jittered run here equals the simulator's.
// "Fresh engine for every Play" (v4 §1.1): the scene builds a new L20World. There is NO snip at Play: the scissors close only when the
// lever trips and the cord link fires. Events (decision 9, names not yet approved): bell:coco:<body> (cosmetic stir), lever:tripped,
// snip:A|B (only with scissors on that string), bell:morning:<body> (any body), goal:morning (the seesaw rang it), domino:<x>:fallen,
// plus sandbag:hit-seesaw and lantern:floor for sound. Steps are counted from the release of the ball (step 0).
import { RAMP_POLY } from '../layout';
import { applyPhysicsConfig, withResolverPin } from '../physicsConfig';
import { createLever, type Lever, type LeverMatter } from './lever';
import {
  BALL_START,
  BELL_MIN_ANGULAR,
  BELL_MIN_SPEED,
  BELL_RADIUS,
  BRACKET,
  CHUTE_X,
  COCO_BELL,
  CUP,
  DOMINO,
  DOMINO_Y,
  FIXED_DOMINOES,
  FLOOR_Y,
  LEDGE,
  LEVER_PIVOT,
  POST,
  SEESAW_REST_ANGLE,
  L20_REST_ANGULAR,
  L20_REST_SPEED,
  L20_REST_STEPS,
  L20_SETTLE_STEPS,
  L20_STEP_MS,
  L20_TIMEOUT_STEPS,
  LANTERN,
  MORNING_BELL,
  PIVOT,
  R1,
  ROPE_STIFFNESS,
  SAND_LIP,
  SAND_TRAY,
  SANDBAG,
  SEESAW,
  TABLE,
  WALLS,
  type L20Config,
} from './l20Level';

/** The few Matter calls this module uses (typed loosely: Phaser ships its Matter build untyped). */
export interface L20Body {
  label: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  angle: number;
  speed: number;
  angularSpeed: number;
  isStatic: boolean;
  parent: L20Body;
}
export interface L20Constraint {
  bodyB: L20Body | null;
}
interface L20Engine {
  world: unknown;
  gravity: { x: number; y: number; scale: number };
  timing: { timeScale: number };
}
export interface L20Matter extends LeverMatter {
  Resolver?: Partial<Record<'_restingThresh' | '_restingThreshTangent' | '_positionDampen' | '_positionWarming' | '_frictionNormalMultiplier', number>>;
  Engine: { create(opts?: object): L20Engine; update(engine: L20Engine, delta?: number): void };
  Bodies: {
    circle(x: number, y: number, r: number, opts?: object): L20Body;
    rectangle(x: number, y: number, w: number, h: number, opts?: object): L20Body;
    fromVertices(x: number, y: number, vertexSets: Array<Array<{ x: number; y: number }>>, opts?: object): L20Body;
  };
  Body: {
    create(opts: object): L20Body;
    setAngle(b: L20Body, a: number): void;
    rotate(b: L20Body, a: number, point?: { x: number; y: number }): void;
    setVelocity(b: L20Body, v: { x: number; y: number }): void;
  };
  Composite: { add(world: unknown, item: unknown): void; remove(world: unknown, item: unknown): void; allBodies(world: unknown): L20Body[] };
  Constraint: { create(opts: object): L20Constraint };
  Vertices: { centre(vertices: Array<{ x: number; y: number }>): { x: number; y: number } };
  Collision: { collides(a: L20Body, b: L20Body): { collided: boolean } | null };
  Events: { on(engine: L20Engine, name: string, cb: (e: { pairs: Array<{ bodyA: L20Body; bodyB: L20Body }> }) => void): void };
}

export interface L20Event {
  id: string;
  /** Step since the ball's release (0 = the release itself). */
  step: number;
}

export type L20RunState = 'idle' | 'running' | 'ended';
/**
 * Why a run ended: `goal` (win), `lever-not-hit` (the chain stopped before the lever: wrong dominoes, no or wrong ramp), `empty-hook`
 * (the lever tripped but there are no scissors), `wrong-string` (the scissors cut B: the lantern drops), `no-goal` (anything else).
 */
export type L20Reason = 'goal' | 'lever-not-hit' | 'empty-hook' | 'wrong-string' | 'no-goal';
export interface L20Run {
  state: L20RunState;
  result: 'win' | 'fail' | null;
  reason: L20Reason | null;
  endStep: number | null;
}

export interface L20Options {
  /** Seeded jitter: every placed part and start object moves by up to +-`jitter` px (the sim's `j()`); 0 = none. */
  seed?: number;
  jitter?: number;
}

function mulberry(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BellGoal {
  id: 'coco' | 'morning';
  x: number;
  y: number;
  hit: number | null;
  by: string | null;
  sensor: L20Body;
}

export interface L20Bodies {
  ball: L20Body | null;
  lever: L20Body;
  sandbag: L20Body;
  lantern: L20Body;
  seesaw: L20Body;
  ramp: L20Body | null;
  dominoes: L20Body[];
}

const STATIC = { isStatic: true, friction: 0.05, restitution: 0 };

export class L20World {
  readonly engine: L20Engine;
  readonly events: L20Event[] = [];
  readonly bodies: L20Bodies;
  readonly run: L20Run = { state: 'idle', result: null, reason: null, endStep: null };
  /** Rope constraints still attached (A, B), for drawing. */
  readonly ropes: { A: L20Constraint | null; B: L20Constraint | null };
  readonly goals: { coco: BellGoal | null; morning: BellGoal | null } = { coco: null, morning: null };
  /** The string the cord cut (null until the lever trips, and for ever with no scissors). */
  snipped: 'A' | 'B' | null = null;
  /** Step of the lever trip / of the snip (null = not yet). */
  trippedAt: number | null = null;
  snipAt: number | null = null;
  private readonly lever: Lever;
  private readonly rng: () => number;
  private readonly fallen = new Set<string>();
  private n = 0;
  private restSteps = 0;
  private hitSeesaw = false;
  private lanternLanded = false;
  private ropeA: L20Constraint;
  private ropeB: L20Constraint;

  constructor(
    private readonly M: L20Matter,
    readonly config: L20Config,
    private readonly opts: L20Options = {},
  ) {
    const { Engine, Bodies, Body, Composite, Constraint, Vertices } = M;
    this.rng = mulberry(opts.seed ?? 1);
    this.engine = Engine.create();
    applyPhysicsConfig(this.engine);
    const world = this.engine.world;
    const add = <T>(b: T): T => {
      Composite.add(world, b);
      return b;
    };
    const rect = (cx: number, cy: number, w: number, h: number, o: object = {}): L20Body => add(Bodies.rectangle(cx, cy, w, h, { ...STATIC, ...o }));
    const box = (x0: number, y0: number, x1: number, y1: number): L20Body => rect((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0);
    const dyn = (b: L20Body, label: string): L20Body => {
      b.label = label;
      return b;
    };

    // Floor, walls, ceiling, chute (inner width 84, walls x +-42..48, y 40..150).
    box(-200, FLOOR_Y, 1500, FLOOR_Y + 40);
    box(WALLS.left.x0, WALLS.left.y0, WALLS.left.x1, WALLS.left.y1);
    box(WALLS.right.x0, WALLS.right.y0, WALLS.right.x1, WALLS.right.y1);
    box(WALLS.ceiling.x0, WALLS.ceiling.y0, WALLS.ceiling.x1, WALLS.ceiling.y1);
    box(CHUTE_X - 48, 40, CHUTE_X - 42, 150);
    box(CHUTE_X + 42, 40, CHUTE_X + 48, 150);
    // Domino table and the sunk cup (L5 geometry).
    box(TABLE.x0, TABLE.y0, TABLE.x1, TABLE.y1);
    box(CUP.floor.x0, CUP.floor.y0, CUP.floor.x1, CUP.floor.y1);
    box(CUP.lip.x0, CUP.lip.y0, CUP.lip.x1, CUP.lip.y1);

    // R1 ramp (the live RAMP_POLY, mirrored for down-left).
    let ramp: L20Body | null = null;
    if (config.ramp !== 'none') {
      const flip = config.ramp === 'down-left';
      const x = this.j(R1.x);
      const y = this.j(R1.y);
      const verts = RAMP_POLY.map((p) => ({ x: flip ? -p.x : p.x, y: p.y }));
      const c = Vertices.centre(verts);
      ramp = add(Bodies.fromVertices(x + c.x, y + c.y, [verts], STATIC));
    }

    // Dominoes: the fixed ones and the child's, in the sim's order (400, 540, <slots ascending>, 710, 780, 860, 940).
    const slots = [...config.slots].sort((a, b) => a - b);
    const dominoes: L20Body[] = [];
    for (const x of [FIXED_DOMINOES[0], FIXED_DOMINOES[1], ...slots, ...FIXED_DOMINOES.slice(2)]) {
      const d = Bodies.rectangle(this.j(x), DOMINO_Y, DOMINO.w, DOMINO.h, { friction: 0.3, frictionStatic: 0.5, restitution: 0.05, density: 0.002 });
      dominoes.push(add(dyn(d, `dom${x}`)));
    }

    // Ledge under the seesaw's right end, sand tray + lip under the left end (catches the bag).
    box(LEDGE.x0, LEDGE.top, LEDGE.x1, LEDGE.top + LEDGE.thickness);
    box(SAND_TRAY.x0, SAND_TRAY.y0, SAND_TRAY.x1, SAND_TRAY.y1);
    box(SAND_LIP.x0, SAND_LIP.y0, SAND_LIP.x1, SAND_LIP.y1);

    // Seesaw: one compound body, pivot pinned by a length-0 constraint, starts right-end-down on the ledge.
    const len = SEESAW.armLeft + SEESAW.armRight;
    const cx = PIVOT.x + (SEESAW.armRight - SEESAW.armLeft) / 2;
    const plank = Bodies.rectangle(cx, PIVOT.y, len, SEESAW.thickness, { density: SEESAW.density });
    const seesaw = Body.create({ parts: [plank], friction: 0.4, restitution: 0 });
    const phi = SEESAW_REST_ANGLE;
    Body.rotate(seesaw, phi, { x: PIVOT.x, y: PIVOT.y });
    add(seesaw);
    add(
      Constraint.create({
        pointA: { x: PIVOT.x, y: PIVOT.y },
        bodyB: seesaw,
        pointB: { x: PIVOT.x - seesaw.position.x, y: PIVOT.y - seesaw.position.y },
        length: 0,
        stiffness: 1,
      }),
    );
    seesaw.label = 'seesaw';
    // Bracket from the ceiling (stops above the plank).
    box(BRACKET.x0, BRACKET.y0, BRACKET.x1, BRACKET.y1);

    // Hanging objects on their ropes.
    const heavy = (x: number, y: number, mass: number, r: number, label: string): L20Body =>
      add(dyn(Bodies.circle(this.j(x), this.j(y), r, { restitution: 0.1, friction: 0.02, frictionStatic: 0.05, frictionAir: 0.002, density: mass / (Math.PI * r * r) }), label));
    const sandbag = heavy(SANDBAG.x, SANDBAG.y, SANDBAG.mass, SANDBAG.radius, 'sandbag');
    const lantern = heavy(LANTERN.x, LANTERN.y, LANTERN.mass, LANTERN.radius, 'lantern');
    this.ropeA = Constraint.create({ pointA: { x: this.j(SANDBAG.x), y: SANDBAG.anchorY }, bodyB: sandbag, length: SANDBAG.y - SANDBAG.anchorY, stiffness: ROPE_STIFFNESS });
    this.ropeB = Constraint.create({ pointA: { x: LANTERN.x, y: LANTERN.anchorY }, bodyB: lantern, length: LANTERN.ropeLength, stiffness: ROPE_STIFFNESS });
    Composite.add(world, [this.ropeA, this.ropeB]);
    this.ropes = { A: this.ropeA, B: this.ropeB };

    // The shared lever on its post (sim order: lever + stops, then the post), then the 60 settle steps.
    this.lever = createLever(M, world, LEVER_PIVOT);
    box(POST.x0, POST.y0, POST.x1, POST.y1);
    this.bodies = { ball: null, lever: this.lever.body as unknown as L20Body, sandbag, lantern, seesaw, ramp, dominoes };

    for (let i = 0; i < L20_SETTLE_STEPS; i++) this.advance();

    M.Events.on(this.engine, 'collisionStart', (e) => {
      for (const pair of e.pairs) {
        const a = pair.bodyA.parent?.label ?? pair.bodyA.label;
        const b = pair.bodyB.parent?.label ?? pair.bodyB.label;
        const has = (l: string): boolean => a === l || b === l;
        if (!this.hitSeesaw && has('sandbag') && has('seesaw')) {
          this.hitSeesaw = true;
          this.ev('sandbag:hit-seesaw');
        }
        // The cut lantern lands on the table (about y 536 now that the table runs to x 1150), not on the floor: any landing below y 500.
        if (!this.lanternLanded && this.run.state === 'running' && has('lantern') && this.bodies.lantern.position.y > 500) {
          this.lanternLanded = true;
          this.ev('lantern:floor');
        }
      }
    });
  }

  /** One Matter step with the v5.1 resolver pin (physicsConfig.ts); the caller's global values are restored. */
  private advance(): void {
    withResolverPin(this.M, () => this.M.Engine.update(this.engine, L20_STEP_MS));
  }

  /** The sim's jitter: v +- opts.jitter px, drawn from the seeded generator in creation order. */
  private j(v: number): number {
    const jitter = this.opts.jitter ?? 0;
    return v + (jitter ? (this.rng() * 2 - 1) * jitter : 0);
  }

  private ev(id: string): void {
    this.events.push({ id, step: this.n });
  }

  /**
   * The cord link (v5.1 §1.2): the lever tripped, so the cord pulls the scissors handle once. With scissors on A or B that rope is cut
   * (`snip:A|B`); with an empty socket nothing is cut (only `lever:tripped` was emitted).
   */
  private pullCord(): void {
    this.ev('lever:tripped');
    this.trippedAt = this.n;
    const which = this.config.scissors;
    if (which === 'none') return;
    const rope = which === 'A' ? this.ropeA : this.ropeB;
    this.M.Composite.remove(this.engine.world, rope);
    this.ropes[which] = null;
    this.snipped = which;
    this.snipAt = this.n;
    this.ev(`snip:${which}`);
  }

  /** Play: the ball leaves the chute with zero velocity, the bells arm, the run starts. Nothing is cut here. */
  release(): void {
    const { Bodies, Body, Composite } = this.M;
    const b = Bodies.circle(this.j(BALL_START.x), this.j(BALL_START.y), BALL_START.radius, {
      restitution: 0.1,
      friction: 0.02,
      frictionStatic: 0.05,
      frictionAir: 0.002,
      density: 0.002,
    });
    b.label = 'std';
    Composite.add(this.engine.world, b);
    Body.setVelocity(b, { x: 0, y: 0 });
    this.bodies.ball = b;
    const bell = (id: 'coco' | 'morning', x: number, y: number): BellGoal => {
      const sensor = Bodies.circle(x, y, BELL_RADIUS, { isStatic: true, isSensor: true });
      Composite.add(this.engine.world, sensor);
      return { id, x, y, hit: null, by: null, sensor };
    };
    this.goals.coco = bell('coco', COCO_BELL.x, COCO_BELL.y);
    this.goals.morning = bell('morning', MORNING_BELL.x, MORNING_BELL.y);
    this.n = 0;
    this.restSteps = 0;
    this.run.state = 'running';
  }

  /** Dynamic bodies that can ring a bell (everything not static). */
  private dynamics(): L20Body[] {
    return this.M.Composite.allBodies(this.engine.world).filter((b) => !b.isStatic);
  }

  /** One fixed step; returns true while the run goes on. */
  step(): boolean {
    if (this.run.state !== 'running') return false;
    const { Collision } = this.M;
    if (this.lever.check()) this.pullCord();
    for (const g of [this.goals.coco, this.goals.morning]) {
      if (!g || g.hit !== null) continue;
      for (const b of this.dynamics()) {
        if (b.speed < BELL_MIN_SPEED && b.angularSpeed < BELL_MIN_ANGULAR) continue;
        const c = Collision.collides(g.sensor, b);
        if (c && c.collided) {
          g.hit = this.n;
          g.by = b.label;
          this.ev(`bell:${g.id}:${b.label}`);
          // THE goal: the seesaw rang the morning bell after the small bell stirred and the cord cut a string (the order check).
          if (g.id === 'morning' && b.label === 'seesaw' && this.cocoRung && this.snipAt !== null) this.ev('goal:morning');
          break;
        }
      }
    }
    for (const d of this.bodies.dominoes) {
      if (this.fallen.has(d.label)) continue;
      if (Math.abs(Math.sin(d.angle)) > 0.866) {
        this.fallen.add(d.label);
        this.ev(`domino:${d.label.slice(3)}:fallen`);
      }
    }
    this.advance();
    if (this.n > L20_SETTLE_STEPS) {
      const moving = this.dynamics().some((b) => b.speed > L20_REST_SPEED || b.angularSpeed > L20_REST_ANGULAR);
      this.restSteps = moving ? 0 : this.restSteps + 1;
    }
    this.n++;
    if (this.restSteps >= L20_REST_STEPS || this.n >= L20_TIMEOUT_STEPS) this.finish();
    return this.run.state === 'running';
  }

  /** Coco's small bell was rung by a domino (a cosmetic mid-chain stir, never a goal). */
  get cocoRung(): boolean {
    const g = this.goals.coco;
    return g !== null && g.hit !== null && (g.by ?? '').startsWith('dom');
  }

  /** The morning bell was rung by the seesaw. */
  get morningRung(): boolean {
    const g = this.goals.morning;
    return g !== null && g.hit !== null && g.by === 'seesaw';
  }

  /** Number of dominoes (fixed + placed) that have tipped so far. */
  get fallenCount(): number {
    return this.fallen.size;
  }

  /** The row stopped: some dominoes tipped but the chain did not reach Coco's bell. */
  get dominoRowStopped(): boolean {
    return !this.cocoRung && this.fallen.size > 0;
  }

  /** The win: the seesaw rang the morning bell, Coco's bell by a domino, and bell:coco <= snip < goal:morning (the one-chain order check). */
  private get won(): boolean {
    const coco = this.goals.coco?.hit;
    const morning = this.goals.morning?.hit;
    const snip = this.snipAt;
    return this.cocoRung && this.morningRung && coco != null && morning != null && snip !== null && coco <= snip && snip < morning;
  }

  private finish(): void {
    this.run.state = 'ended';
    this.run.endStep = this.n;
    if (this.won) {
      this.run.result = 'win';
      this.run.reason = 'goal';
      return;
    }
    this.run.result = 'fail';
    if (this.trippedAt === null) this.run.reason = 'lever-not-hit';
    else if (this.config.scissors === 'none') this.run.reason = 'empty-hook';
    else if (this.snipped === 'B') this.run.reason = 'wrong-string';
    else this.run.reason = 'no-goal';
  }
}

export interface L20Outcome {
  run: L20Run;
  events: L20Event[];
}

/** One complete headless Play on a fresh engine: settle, release, step until the run ends (the lever's cord does the snip). */
export function simulateL20(M: L20Matter, config: L20Config, opts: L20Options = {}): L20Outcome {
  const world = new L20World(M, config, opts);
  world.release();
  while (world.step()) {
    // stepping
  }
  return { run: { ...world.run }, events: world.events };
}

