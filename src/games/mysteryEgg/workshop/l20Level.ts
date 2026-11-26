// Workshop level 20 "Bonjour, Ville des Surprises !": level data in world px (1280x800, y down). Pure data, no Phaser.
// Source of every number: design/v4-sim/l20.cjs + lib4.cjs (50/50 on both valid sets). The physics (l20World.ts) and the
// scene draw from these numbers, so they cannot drift apart. Spec: docs/specs/workshop-l20.md.

export type RampSetup = 'none' | 'down-right' | 'down-left';
export type ScissorsSetup = 'A' | 'B' | 'none';

/** What the child set up: the R1 ramp, the domino slots in use, and which string the scissors cut. */
export interface L20Config {
  ramp: RampSetup;
  slots: readonly number[];
  scissors: ScissorsSetup;
}

export const L20_WORLD = { width: 1280, height: 800 } as const;
export const FLOOR_Y = 700;

/** Fixed step (1/60 s) and the run timeout: 16 s of simulated time. */
export const L20_STEP_MS = 1000 / 60;
export const L20_TIMEOUT_STEPS = 16 * 60;
/** Settle steps before the scissors snip (the hanging objects come to rest). */
export const L20_SETTLE_STEPS = 60;
/** A run ends once every moving body has rested this long (1 s). */
export const L20_REST_STEPS = 60;
export const L20_REST_SPEED = 0.05;
export const L20_REST_ANGULAR = 0.005;

/** Strip slots the child can fill; slot 540 is pre-placed. Fixed dominoes stand on the table at floorY 560. */
export const DOMINO_SLOTS = [460, 500, 580, 620] as const;
export const FIXED_DOMINOES = [400, 540, 700, 780, 860, 940] as const;
export const DOMINO = { w: 20, h: 110, tableTop: 560 } as const;
/** Standing domino centre y (table top - h/2). */
export const DOMINO_Y = DOMINO.tableTop - DOMINO.h / 2;

export const CHUTE_X = 200;
export const BALL_START = { x: 200, y: 95, radius: 34 } as const;

/** The R1 ramp socket (below the chute). */
export const R1 = { x: 200, y: 440 } as const;

export const PIVOT = { x: 1000, y: 340 } as const;
export const SEESAW = { armLeft: 160, armRight: 160, thickness: 16, density: 0.001, ledge: { x0: 1150, x1: 1240, top: PIVOT.y + 68 } } as const;
export const BRACKET = { x0: PIVOT.x - 4, x1: PIVOT.x + 4, y0: 60, y1: PIVOT.y - 30 } as const;
export const SAND_TRAY = { x0: 720, y0: 420, x1: 900, y1: 434 } as const;
export const SAND_LIP = { x0: 720, y0: 380, x1: 732, y1: 420 } as const;
export const CUP = { lip: { x0: 268, y0: 560, x1: 300, y1: 624 }, floor: { x0: 280, y0: 600, x1: 390, y1: 624 } } as const;
export const TABLE = { x0: 390, y0: 560, x1: 1100, y1: 584 } as const;
export const WALLS = { left: { x0: 20, y0: 40, x1: 40, y1: 700 }, right: { x0: 1250, y0: 40, x1: 1270, y1: 700 }, ceiling: { x0: 20, y0: 40, x1: 1260, y1: 60 } } as const;
export const CEILING_Y = 60;

/** Hanging objects: the sandbag on rope A (above the seesaw's left end), the lantern on rope B (decoy). */
export const SANDBAG = { x: 860, y: 200, mass: 24, radius: 36, ropeLength: 140, anchorY: CEILING_Y } as const;
export const LANTERN = { x: 640, y: 220, mass: 3, radius: 24, ropeLength: 160, anchorY: CEILING_Y } as const;
export const ROPE_STIFFNESS = 0.9;

/** Bells (sensor circles r 44). Coco's rings for a domino, the morning bell for the seesaw. */
export const BELL_RADIUS = 44;
export const COCO_BELL = { x: 1050, y: 470 } as const;
export const MORNING_BELL = { x: 1150, y: 230 } as const;
/** A body counts as moving (it can ring a bell) from this speed. */
export const BELL_MIN_SPEED = 0.2;
export const BELL_MIN_ANGULAR = 0.01;

/** Typed sockets (world px). `ramp`: R1; `strip`: dominoes only; `string`: scissors only. */
export type L20PartKind = 'ramp' | 'domino' | 'scissors';
export interface L20Socket {
  id: string;
  type: 'ramp' | 'strip' | 'string';
  x: number;
  y: number;
  accepts: L20PartKind;
}
export const L20_SOCKETS: readonly L20Socket[] = [
  { id: 'R1', type: 'ramp', x: R1.x, y: R1.y, accepts: 'ramp' },
  ...DOMINO_SLOTS.map((x): L20Socket => ({ id: `slot-${x}`, type: 'strip', x, y: DOMINO_Y, accepts: 'domino' })),
  { id: 'string-A', type: 'string', x: SANDBAG.x, y: 110, accepts: 'scissors' },
  { id: 'string-B', type: 'string', x: LANTERN.x, y: 110, accepts: 'scissors' },
];

/** Tray parts: the ramp, two dominoes, the scissors. */
export const TRAY_COUNTS = { ramp: 1, domino: 2, scissors: 1 } as const;

/** Window spots (centres) of the six sleepers; frames 110x110, busts 92x92. */
export type SleeperId = 'moustache' | 'bruno' | 'pip' | 'grandpere' | 'cocopom' | 'plume';
export const SLEEPERS: ReadonlyArray<{ id: SleeperId; x: number; y: number }> = [
  { id: 'moustache', x: 300, y: 195 },
  { id: 'bruno', x: 460, y: 195 },
  { id: 'pip', x: 760, y: 195 },
  { id: 'grandpere', x: 300, y: 325 },
  { id: 'cocopom', x: 460, y: 325 },
  { id: 'plume', x: 620, y: 325 },
];
export const WINDOW_SIZE = 110;
export const BUST_SIZE = 92;

export const EGG_NEST = { x: 380, y: 98, scale: 0.35 } as const;
export const CAPYBARA = { x: 120, y: 616, scale: 0.6 } as const;

/** Rope draw spans (world px, ending at the object image top): rope A 60->144, rope B 60->176. */
export const ROPE_A = { x: SANDBAG.x, top: CEILING_Y, bottom: 144 } as const;
export const ROPE_B = { x: LANTERN.x, top: CEILING_Y, bottom: 176 } as const;
/** The scissors sit on the TOP of a string (y 110, under the ceiling), never over the sack. */
export const SCISSORS_Y = 110;
