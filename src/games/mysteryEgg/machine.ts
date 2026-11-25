// Mystery Egg physics: builds the mission-1.1 board on a Matter engine and steps it at a fixed 60 Hz.
// Pure TS: the Matter library is passed in (Phaser's bundled build in the scene, the same build headless in tests).
// Spec: docs/specs/mystery-egg.md (AC-09).
import { BALL, BELL, FLOOR, LAUNCH_SPEED, PIT_WALL, RAMP_SLOT, RIGHT_WALL, SHELF, TABLE } from './layout';
import { RUN_TIMEOUT_STEPS, RunWatcher, STEP_MS, type RunResult, type RunSample, type RunWatcherConfig } from './run';

/** The few Matter calls this module uses, so it needs neither Phaser nor the matter-js typings. */
export interface MBody {
  position: { x: number; y: number };
  speed: number;
}
export interface MEngine {
  world: unknown;
}
export interface MatterLib {
  Engine: { create(opts?: object): MEngine; update(engine: MEngine, delta?: number): void };
  Bodies: {
    circle(x: number, y: number, r: number, opts?: object): MBody;
    rectangle(x: number, y: number, w: number, h: number, opts?: object): MBody;
  };
  Body: {
    setPosition(b: MBody, p: { x: number; y: number }): void;
    setVelocity(b: MBody, v: { x: number; y: number }): void;
    setAngularVelocity(b: MBody, v: number): void;
    setAngle(b: MBody, a: number): void;
  };
  Composite: { add(world: unknown, body: MBody): void; remove(world: unknown, body: MBody): void };
}

export interface Offset {
  x: number;
  y: number;
}

const STATIC = { isStatic: true, friction: 0.05, restitution: 0 };
const BALL_OPTS = { restitution: 0.1, friction: 0.02, frictionStatic: 0.05, frictionAir: 0.002, density: 0.002, label: 'ball' };

export const RUN_WATCHER_CONFIG: RunWatcherConfig = {
  reach: BALL.radius + BELL.radius,
  bounds: { minX: -100, maxX: 1380, maxY: 900 },
  restSpeed: 0.08,
  restSteps: 45,
  timeoutSteps: RUN_TIMEOUT_STEPS,
};

/** The board on one engine. The ramp body exists only while a ramp is placed in the slot. */
export class Machine {
  readonly ball: MBody;
  private ramp: MBody | null = null;
  private readonly scenery: MBody[] = [];
  private steps = 0;

  constructor(
    private readonly M: MatterLib,
    private readonly engine: MEngine,
    ballOffset: Offset = { x: 0, y: 0 },
  ) {
    const { Bodies, Composite } = M;
    const shelf = Bodies.rectangle(SHELF.x, SHELF.y, SHELF.w, SHELF.h, STATIC);
    M.Body.setAngle(shelf, SHELF.angle);
    this.scenery.push(
      shelf,
      Bodies.rectangle(TABLE.x, TABLE.y, TABLE.w, TABLE.h, STATIC),
      Bodies.rectangle(RIGHT_WALL.x, RIGHT_WALL.y, RIGHT_WALL.w, RIGHT_WALL.h, STATIC),
      Bodies.rectangle(FLOOR.x, FLOOR.y, FLOOR.w, FLOOR.h, STATIC),
      Bodies.rectangle(PIT_WALL.x, PIT_WALL.y, PIT_WALL.w, PIT_WALL.h, STATIC),
    );
    for (const b of this.scenery) Composite.add(engine.world, b);
    this.ball = Bodies.circle(BALL.x + ballOffset.x, BALL.y + ballOffset.y, BALL.radius, BALL_OPTS);
    Composite.add(engine.world, this.ball);
    this.ballOffset = ballOffset;
    this.freeze();
  }

  private readonly ballOffset: Offset;
  /** Parked until Play: gravity must not move the ball before the child presses Play. */
  private parked = true;
  private parkedAt: Offset = { x: 0, y: 0 };

  private freeze(): void {
    this.parked = true;
    this.parkedAt = { x: BALL.x + this.ballOffset.x, y: BALL.y + this.ballOffset.y };
  }

  get rampPlaced(): boolean {
    return this.ramp !== null;
  }

  /** Puts the ramp into the slot (the snap already put the part at the slot centre). Idempotent. */
  placeRamp(offset: Offset = { x: 0, y: 0 }): void {
    if (this.ramp) return;
    const { Bodies, Body, Composite } = this.M;
    this.ramp = Bodies.rectangle(RAMP_SLOT.x + offset.x, RAMP_SLOT.y + offset.y, RAMP_SLOT.w, RAMP_SLOT.h, STATIC);
    Body.setAngle(this.ramp, RAMP_SLOT.angle);
    Composite.add(this.engine.world, this.ramp);
  }

  removeRamp(): void {
    if (!this.ramp) return;
    this.M.Composite.remove(this.engine.world, this.ramp);
    this.ramp = null;
  }

  /** Back to the shelf, at rest. Placed parts stay. */
  resetBall(): void {
    const { Body } = this.M;
    Body.setPosition(this.ball, { x: BALL.x + this.ballOffset.x, y: BALL.y + this.ballOffset.y });
    Body.setVelocity(this.ball, { x: 0, y: 0 });
    Body.setAngularVelocity(this.ball, 0);
    this.steps = 0;
    this.freeze();
  }

  /** Play: the ball gets its small push and the clock starts. */
  launch(): void {
    this.parked = false;
    this.steps = 0;
    this.M.Body.setVelocity(this.ball, { x: LAUNCH_SPEED, y: 0 });
  }

  /** One fixed step. While parked the ball is held on the shelf and the sample reports a standing ball. */
  step(): RunSample {
    if (this.parked) {
      this.M.Body.setPosition(this.ball, this.parkedAt);
      this.M.Body.setVelocity(this.ball, { x: 0, y: 0 });
      return this.sample(0);
    }
    this.M.Engine.update(this.engine, STEP_MS);
    this.steps++;
    return this.sample(this.steps);
  }

  private sample(step: number): RunSample {
    const { x, y } = this.ball.position;
    return { step, x, y, speed: this.ball.speed, bellDistance: Math.hypot(x - BELL.x, y - BELL.y) };
  }

  dispose(): void {
    const { Composite } = this.M;
    this.removeRamp();
    for (const b of this.scenery) Composite.remove(this.engine.world, b);
    Composite.remove(this.engine.world, this.ball);
    this.scenery.length = 0;
  }
}

export interface SimOptions {
  rampPlaced: boolean;
  ballOffset?: Offset;
  rampOffset?: Offset;
}

export interface SimResult {
  result: RunResult;
  steps: number;
  final: { x: number; y: number };
}

/** Runs one complete Play on a fresh engine, headless. Used by unit tests and as the solver check from the GDD. */
export function simulateRun(M: MatterLib, opts: SimOptions): SimResult {
  const engine = M.Engine.create();
  const machine = new Machine(M, engine, opts.ballOffset);
  if (opts.rampPlaced) machine.placeRamp(opts.rampOffset);
  machine.launch();
  const watcher = new RunWatcher(RUN_WATCHER_CONFIG);
  let result: RunResult = { status: 'running' };
  let steps = 0;
  let last = machine.ball.position;
  while (result.status === 'running' && steps < RUN_TIMEOUT_STEPS + 5) {
    const s = machine.step();
    steps = s.step;
    last = { x: s.x, y: s.y };
    result = watcher.update(s);
  }
  const final = { x: Math.round(last.x * 1000) / 1000, y: Math.round(last.y * 1000) / 1000 };
  machine.dispose();
  return { result, steps, final };
}
