// The shared Workshop lever (v5.1 §1.2): ONE tuned spec reused by L13, L14, L15 and L20. Phaser-free (the Matter library is passed in).
// A dynamic plank pinned with a length-0 constraint on a static post (the seesaw pattern); at rest it tilts 11 degrees left-up with
// a counterweight on the right tip resting on a static stop; a second static stop under the left arm limits it to 30 degrees of
// turn. It trips (fires the cord link once) when it is 10 degrees or more away from its angle at the first run step.
// Numbers: workshop-v5-notes sim/core.cjs `W.prototype.lever` (50/50 in L20 at timeScale 1.25 with the resolver pin).

export const LEVER = {
  length: 160,
  thickness: 10,
  density: 0.001,
  /** Rest angle: the right end sits this far DOWN (the left end up), on the stop. */
  restDeg: 11,
  counterweightMass: 1.2,
  counterweightRadius: 6,
  /** Trips at this many degrees from the angle at the first run step. */
  tripDeg: 10,
  /** The down-stop under the left arm limits the turn to this. */
  downStopDeg: 30,
  friction: 0.4,
} as const;

export interface LeverPoint {
  x: number;
  y: number;
}
export interface LeverBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface LeverGeometry {
  pivot: LeverPoint;
  leftTip: LeverPoint;
  rightTip: LeverPoint;
  /** Static block under the right tip (the counterweight rests on it). */
  rightStop: LeverBox;
  /** Static block under the left arm at the end of its 30 degree turn. */
  downStop: LeverBox;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Where the tips and the two stops are for a pivot (world px). Pure: the scene draws from the same numbers the world builds from. */
export function leverGeometry(pivot: LeverPoint): LeverGeometry {
  const th = rad(LEVER.restDeg);
  const half = LEVER.length / 2;
  const rightTip = { x: pivot.x + half * Math.cos(th), y: pivot.y + half * Math.sin(th) };
  const leftTip = { x: pivot.x - half * Math.cos(th), y: pivot.y - half * Math.sin(th) };
  const th2 = th - rad(LEVER.downStopDeg);
  const ld = { x: pivot.x - half * Math.cos(th2), y: pivot.y - half * Math.sin(th2) };
  return {
    pivot: { ...pivot },
    leftTip,
    rightTip,
    rightStop: { x0: rightTip.x - 11, y0: rightTip.y + 5, x1: rightTip.x + 11, y1: rightTip.y + 15 },
    downStop: { x0: ld.x - 8, y0: ld.y + 5, x1: ld.x + 8, y1: ld.y + 15 },
  };
}

/** The few Matter calls the lever uses (typed loosely: Phaser ships its Matter build untyped). */
export interface LeverBody {
  label: string;
  angle: number;
  position: LeverPoint;
}
export interface LeverMatter {
  Bodies: {
    rectangle(x: number, y: number, w: number, h: number, opts?: object): LeverBody;
    circle(x: number, y: number, r: number, opts?: object): LeverBody;
  };
  Body: { create(opts: object): LeverBody; rotate(b: LeverBody, a: number, point?: LeverPoint): void };
  Composite: { add(world: unknown, item: unknown): void };
  Constraint: { create(opts: object): unknown };
}

export interface Lever {
  readonly body: LeverBody;
  readonly geometry: LeverGeometry;
  /** True once the cord link has fired. */
  readonly tripped: boolean;
  /** Current distance (degrees) from the angle at the first `check()`; 0 before it. */
  readonly deviationDeg: number;
  /** Call once per step BEFORE the engine step. Returns true exactly once: on the first step the lever is >= 10 degrees from its start. */
  check(): boolean;
}

const STATIC = { isStatic: true, friction: 0.05, restitution: 0 };

/** Builds the lever, its pin and its two stops in `world`, in the sim's creation order (plank + counterweight, pin, right stop, down-stop). */
export function createLever(M: LeverMatter, world: unknown, pivot: LeverPoint): Lever {
  const { Bodies, Body, Composite, Constraint } = M;
  const geometry = leverGeometry(pivot);
  const th = rad(LEVER.restDeg);
  const plank = Bodies.rectangle(pivot.x, pivot.y, LEVER.length, LEVER.thickness, { density: LEVER.density });
  const weight = Bodies.circle(pivot.x + LEVER.length / 2, pivot.y, LEVER.counterweightRadius, {
    density: LEVER.counterweightMass / (Math.PI * LEVER.counterweightRadius * LEVER.counterweightRadius),
  });
  const body = Body.create({ parts: [plank, weight], friction: LEVER.friction, restitution: 0 });
  Body.rotate(body, th, pivot);
  Composite.add(world, body);
  body.label = 'lever';
  Composite.add(
    world,
    Constraint.create({ pointA: { ...pivot }, bodyB: body, pointB: { x: pivot.x - body.position.x, y: pivot.y - body.position.y }, length: 0, stiffness: 1 }),
  );
  for (const b of [geometry.rightStop, geometry.downStop]) {
    Composite.add(world, Bodies.rectangle((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.x1 - b.x0, b.y1 - b.y0, STATIC));
  }
  let a0: number | null = null;
  let tripped = false;
  return {
    body,
    geometry,
    get tripped() {
      return tripped;
    },
    get deviationDeg() {
      return a0 === null ? 0 : (Math.abs(body.angle - a0) * 180) / Math.PI;
    },
    check() {
      if (a0 === null) a0 = body.angle;
      if (tripped) return false;
      if ((Math.abs(body.angle - a0) * 180) / Math.PI >= LEVER.tripDeg) {
        tripped = true;
        return true;
      }
      return false;
    },
  };
}
