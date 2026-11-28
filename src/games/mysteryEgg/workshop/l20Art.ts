// Workshop L20 placeholders: code-drawn stand-ins for every new art key until Gemini's files land
// (docs/specs/workshop-l20-assets.md). Each is centred on (0, 0) and fitted to the manifest's display size, like art.ts.
// Draws only through the Graphics calls below, with plain {x,y} points, so a recording fake can drive it in unit tests.
import type Phaser from 'phaser';
import {
  BRACKET,
  CHUTE_X,
  CUP,
  L20_WORLD,
  LANTERN,
  SAND_LIP,
  SAND_TRAY,
  SANDBAG,
  SEESAW,
  SLEEPERS,
  TABLE,
  type SleeperId,
} from './l20Level';

type G = Phaser.GameObjects.Graphics;

const DARK = 0x3b2a22;
const WOOD = 0xb8814f;
const WOOD_DARK = 0x9a6b45;

/** Bust colours of the six friends (placeholders: a coloured head with closed or open eyes). */
export const SLEEPER_COLORS: Record<SleeperId, number> = {
  moustache: 0xe6a15a,
  bruno: 0x9b6b4a,
  plume: 0xf2efe6,
  cocopom: 0xffd93d,
  pip: 0x5b6fd6,
  grandpere: 0xb98a5b,
};

const px = (x: number): number => x - L20_WORLD.width / 2;
const py = (y: number): number => y - L20_WORLD.height / 2;

function plank(g: G, x0: number, y0: number, x1: number, y1: number, color = WOOD): void {
  g.fillStyle(color, 1);
  g.fillRect(px(x0), py(y0), x1 - x0, y1 - y0);
  g.lineStyle(3, DARK, 1);
  g.strokeRect(px(x0), py(y0), x1 - x0, y1 - y0);
}

/** The town and the workshop frame (ceiling beam, side walls, floor strip), in dawn or morning colours. */
function background(g: G, morning: boolean): void {
  const sky = morning ? [0xbfe6ff, 0xd6f0ff, 0xffe9b0, 0xfff3c4] : [0x8f8fd0, 0xb7a4d8, 0xe9a9c4, 0xf6c9c0];
  const top = 60;
  const bottom = 700;
  const band = (bottom - top) / sky.length;
  sky.forEach((c, i) => {
    g.fillStyle(c, 1);
    g.fillRect(px(40), py(top + i * band), 1210, band + 1);
  });
  // Sun or fading moon.
  g.fillStyle(morning ? 0xffe27a : 0xfff0d0, morning ? 1 : 0.8);
  g.fillCircle(px(1060), py(morning ? 150 : 210), morning ? 60 : 40);
  // Facades behind the machines, with the roofs, and plain wall squares where the six windows go.
  const wall = morning ? 0xf4d9b5 : 0xcdb7c9;
  const roof = morning ? 0xc0504d : 0x8d6e9a;
  for (const [x0, x1, y0] of [[240, 520, 120], [680, 840, 150], [900, 1180, 300]] as const) {
    g.fillStyle(wall, 1);
    g.fillRect(px(x0), py(y0), x1 - x0, 700 - y0);
    g.fillStyle(roof, 1);
    g.fillTriangle(px(x0 - 20), py(y0), px(x1 + 20), py(y0), px((x0 + x1) / 2), py(y0 - 70));
    g.lineStyle(4, DARK, 0.5);
    g.strokeRect(px(x0), py(y0), x1 - x0, 700 - y0);
  }
  g.fillStyle(wall, 1);
  for (const s of SLEEPERS) g.fillRect(px(s.x - 62), py(s.y - 62), 124, 124);
  // Square paving.
  g.fillStyle(morning ? 0xe9d7b5 : 0xb9a9bd, 1);
  g.fillRect(px(40), py(640), 1210, 60);
  // Workshop frame: ceiling beam y 40-60, side walls x 20-40 / 1250-1270, floor top y 700 with the warm tray strip.
  g.fillStyle(WOOD_DARK, 1);
  g.fillRect(px(20), py(40), 1240, 20);
  g.fillRect(px(20), py(40), 20, 660);
  g.fillRect(px(1250), py(40), 20, 660);
  g.fillStyle(0xf1dcc2, 1);
  g.fillRect(px(0), py(700), 1280, 100);
  g.fillStyle(0x8c6a47, 1);
  g.fillRect(px(0), py(700), 1280, 14);
}

/** Every static body painted in place, from the level data (the same numbers the physics uses). */
function fixtures(g: G): void {
  plank(g, CHUTE_X - 48, 40, CHUTE_X - 42, 150, WOOD_DARK);
  plank(g, CHUTE_X + 42, 40, CHUTE_X + 48, 150, WOOD_DARK);
  g.lineStyle(4, 0x6b4a2e, 1); // the trapdoor at the bottom of the chute
  g.lineBetween(px(CHUTE_X - 42), py(150), px(CHUTE_X + 42), py(150));
  plank(g, CUP.lip.x0, CUP.lip.y0, CUP.lip.x1, CUP.lip.y1);
  plank(g, CUP.floor.x0, CUP.floor.y0, CUP.floor.x1, CUP.floor.y1);
  plank(g, TABLE.x0, TABLE.y0, TABLE.x1, TABLE.y1);
  plank(g, TABLE.x0 + 30, TABLE.y1, TABLE.x0 + 52, 700, WOOD_DARK);
  plank(g, TABLE.x1 - 52, TABLE.y1, TABLE.x1 - 30, 700, WOOD_DARK);
  plank(g, SAND_TRAY.x0, SAND_TRAY.y0, SAND_TRAY.x1, SAND_TRAY.y1);
  plank(g, SAND_LIP.x0, SAND_LIP.y0, SAND_LIP.x1, SAND_LIP.y1);
  g.fillStyle(0xe5c98a, 1); // sand
  g.fillRect(px(SAND_TRAY.x0 + 12), py(SAND_TRAY.y0 - 6), SAND_TRAY.x1 - SAND_TRAY.x0 - 12, 8);
  plank(g, BRACKET.x0, BRACKET.y0, BRACKET.x1, BRACKET.y1, WOOD_DARK);
  plank(g, SEESAW.ledge.x0, SEESAW.ledge.top, SEESAW.ledge.x1, SEESAW.ledge.top + 20);
  g.fillStyle(0x6b6b6b, 1); // the two rope hooks
  for (const x of [LANTERN.x, SANDBAG.x]) g.fillCircle(px(x), py(60), 7);
}

function windowFrame(g: G, w: number, h: number): void {
  g.lineStyle(10, 0xe9e1d0, 1);
  g.strokeRect(-w * 0.36, -h * 0.4, w * 0.72, h * 0.8);
  g.lineStyle(4, DARK, 1);
  g.strokeRect(-w * 0.41, -h * 0.45, w * 0.82, h * 0.9);
  g.fillStyle(0x6fa87a, 1); // little open shutters
  g.fillRect(-w * 0.5, -h * 0.4, w * 0.1, h * 0.8);
  g.fillRect(w * 0.4, -h * 0.4, w * 0.1, h * 0.8);
}

function bust(g: G, id: SleeperId, awake: boolean, w: number, h: number): void {
  const fur = SLEEPER_COLORS[id];
  g.fillStyle(0x6b88c9, 1); // shoulders
  g.fillRoundedRect(-w * 0.4, h * 0.18, w * 0.8, h * 0.3, 14);
  g.fillStyle(fur, 1);
  g.fillCircle(0, -h * 0.04, h * 0.32);
  g.fillCircle(-h * 0.24, -h * 0.3, h * 0.1); // ears
  g.fillCircle(h * 0.24, -h * 0.3, h * 0.1);
  g.lineStyle(3, DARK, 1);
  g.strokeCircle(0, -h * 0.04, h * 0.32);
  if (awake) {
    g.fillStyle(DARK, 1);
    g.fillCircle(-h * 0.12, -h * 0.08, 4);
    g.fillCircle(h * 0.12, -h * 0.08, 4);
    g.beginPath();
    g.arc(0, h * 0.0, h * 0.12, 0.2, Math.PI - 0.2);
    g.strokePath();
    g.fillStyle(fur, 1); // a raised paw
    g.fillCircle(w * 0.38, -h * 0.12, h * 0.1);
    g.strokeCircle(w * 0.38, -h * 0.12, h * 0.1);
  } else {
    g.beginPath();
    g.arc(-h * 0.12, -h * 0.08, 6, 0.1, Math.PI - 0.1);
    g.strokePath();
    g.beginPath();
    g.arc(h * 0.12, -h * 0.08, 6, 0.1, Math.PI - 0.1);
    g.strokePath();
    g.fillStyle(0xffffff, 1); // nightcap
    g.fillTriangle(-h * 0.3, -h * 0.28, h * 0.1, -h * 0.28, -h * 0.1, -h * 0.5);
    g.lineStyle(4, 0x6b5b95, 1);
    g.lineBetween(w * 0.3, -h * 0.34, w * 0.4, -h * 0.34);
    g.lineBetween(w * 0.4, -h * 0.34, w * 0.3, -h * 0.22);
    g.lineBetween(w * 0.3, -h * 0.22, w * 0.4, -h * 0.22);
  }
}

function capybara(g: G, w: number, h: number, pose: 'ring' | 'cheer' | 'facepalm'): void {
  g.fillStyle(0xb98a5b, 1);
  g.fillRoundedRect(-w * 0.42, -h * 0.05, w * 0.84, h * 0.5, 40);
  g.fillRoundedRect(w * 0.1, -h * 0.4, w * 0.36, h * 0.46, 30);
  g.fillStyle(DARK, 1);
  g.fillRect(-w * 0.3, h * 0.4, 16, h * 0.1);
  g.fillRect(w * 0.1, h * 0.4, 16, h * 0.1);
  g.lineStyle(10, 0xb98a5b, 1); // a raised paw
  if (pose === 'cheer') {
    g.lineBetween(w * 0.2, -h * 0.05, w * 0.3, -h * 0.5);
    g.lineBetween(w * 0.4, -h * 0.05, w * 0.5, -h * 0.5);
    g.fillStyle(DARK, 1);
    g.fillCircle(w * 0.36, -h * 0.22, 5);
  } else if (pose === 'facepalm') {
    g.lineBetween(w * 0.2, 0, w * 0.38, -h * 0.2);
    g.fillStyle(DARK, 0.4);
    g.fillCircle(w * 0.4, -h * 0.2, 10);
  } else {
    g.lineBetween(w * 0.25, -h * 0.05, w * 0.42, -h * 0.5);
    g.lineStyle(4, DARK, 1); // eyes closed + "ding" arcs
    g.lineBetween(w * 0.3, -h * 0.22, w * 0.4, -h * 0.22);
    g.beginPath();
    g.arc(w * 0.46, -h * 0.55, 18, -2.5, -0.6);
    g.strokePath();
  }
}

function star(g: G, r: number): void {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
  }
  g.fillStyle(0xfff6b8, 0.55);
  g.fillCircle(0, 0, r * 1.15);
  g.fillStyle(0xf2b632, 1);
  g.fillPoints(pts as never, true);
  g.lineStyle(4, DARK, 1);
  g.strokePoints(pts as never, true);
}

function scissors(g: G, w: number, h: number, closed: boolean): void {
  const open = closed ? 0.1 : 0.32;
  g.lineStyle(7, 0x9aa3ad, 1);
  g.lineBetween(-w * 0.1, 0, w * 0.45, -h * open * 1.5);
  g.lineBetween(-w * 0.1, 0, w * 0.45, h * open * 1.5);
  g.lineStyle(7, 0x3b2a22, 1);
  g.strokeCircle(-w * 0.3, -h * 0.2, h * 0.17);
  g.strokeCircle(-w * 0.3, h * 0.2, h * 0.17);
  g.fillStyle(0x6b6b6b, 1);
  g.fillCircle(-w * 0.1, 0, 4);
}

/** Draws the placeholder of a Workshop L20 art key; false when `id` is not one (the caller falls through). */
export function drawWorkshopPlaceholder(g: G, id: string): boolean {
  const sleeper = /^ws-sleeper-([a-z]+)-(asleep|awake)$/.exec(id);
  if (sleeper && sleeper[1] in SLEEPER_COLORS) {
    bust(g, sleeper[1] as SleeperId, sleeper[2] === 'awake', 92, 92);
    return true;
  }
  switch (id) {
    case 'ws-l20-bg-dawn':
      background(g, false);
      return true;
    case 'ws-l20-bg-morning':
      background(g, true);
      return true;
    case 'ws-l20-fixtures':
      fixtures(g);
      return true;
    case 'ws-domino':
      g.fillStyle(0xf4eee0, 1);
      g.fillRoundedRect(-14, -57, 28, 114, 6);
      g.lineStyle(3, DARK, 1);
      g.strokeRoundedRect(-14, -57, 28, 114, 6);
      g.lineBetween(-14, 0, 14, 0);
      g.fillStyle(DARK, 1);
      for (const dy of [-30, 30]) for (const dx of [-5, 5]) g.fillCircle(dx, dy, 3);
      return true;
    case 'ws-l20-cord': // the static cord P0 -> P1 -> P2 -> scissors handle (the tip -> P0 leg is drawn live)
      g.lineStyle(5, WOOD, 1);
      g.lineBetween(px(1238), py(688), px(1244), py(72));
      g.lineBetween(px(1244), py(72), px(896), py(72));
      g.lineBetween(px(896), py(72), px(880), py(98));
      g.fillStyle(0x6b6b6b, 1); // the three pulleys
      for (const [x, y] of [[1238, 688], [1244, 72], [896, 72]] as const) g.fillCircle(px(x), py(y), 9);
      return true;
    case 'ws-lever': // 160 x 10 plank, pin at the centre, counterweight on the right tip (image centre = the pin)
      g.fillStyle(WOOD, 1);
      g.fillRect(-80, -5, 160, 10);
      g.lineStyle(3, DARK, 1);
      g.strokeRect(-80, -5, 160, 10);
      g.fillStyle(0x6b6b6b, 1);
      g.fillCircle(80, 0, 6.5);
      g.fillCircle(0, 0, 4);
      return true;
    case 'ws-lever-base': // post under the pin + the right stop block (image 120 x 40, pin at (20, 6))
      g.fillStyle(0x6b6b6b, 1);
      g.fillRect(-46, -14, 12, 12);
      g.fillRect(27.5, 5.3, 22, 10);
      return true;
    case 'ws-seesaw':
      g.fillStyle(WOOD, 1);
      g.fillRoundedRect(-168, -7, 336, 14, 4);
      g.fillStyle(WOOD_DARK, 1);
      g.fillRoundedRect(110, -13, 58, 26, 6); // the hammer head
      g.lineStyle(3, DARK, 1);
      g.strokeRoundedRect(-168, -7, 336, 14, 4);
      g.strokeRoundedRect(110, -13, 58, 26, 6);
      g.fillStyle(0x6b6b6b, 1);
      g.fillCircle(0, 0, 8);
      return true;
    case 'ws-sandbag':
      // The body circle (r 36) centre sits at image (42, 56): 8 px below the image centre.
      g.fillStyle(0xd2b077, 1);
      g.fillCircle(0, 8, SANDBAG.radius);
      g.fillRoundedRect(-10, -48, 20, 22, 6); // the tied neck
      g.lineStyle(4, DARK, 1);
      g.strokeCircle(0, 8, SANDBAG.radius);
      g.lineBetween(-12, -28, 12, -28);
      g.fillStyle(0xb8935a, 1);
      for (const [dx, dy] of [[-12, 0], [10, 14], [4, -8], [-6, 22]]) g.fillCircle(dx, 8 + dy, 3);
      return true;
    case 'ws-lantern':
      // Body circle (r 24) centre at image (28, 44): 6 px below the image centre.
      g.fillStyle(0xfff0b0, 0.5);
      g.fillCircle(0, 6, LANTERN.radius + 6);
      g.fillStyle(0xffd86b, 1);
      g.fillRoundedRect(-16, -16, 32, 44, 6);
      g.lineStyle(4, DARK, 1);
      g.strokeRoundedRect(-16, -16, 32, 44, 6);
      g.fillStyle(DARK, 1);
      g.fillRect(-20, -22, 40, 8);
      g.strokeCircle(0, -32, 6);
      return true;
    case 'ws-rope':
      g.lineStyle(4, 0x7a5532, 1);
      g.lineBetween(0, -32, 0, 32);
      return true;
    case 'ws-scissors':
      scissors(g, 96, 64, false);
      return true;
    case 'ws-scissors-snip':
      scissors(g, 96, 64, true);
      return true;
    case 'ws-bell-morning':
      // The bell body centre (sensor r 44) is the image centre; the hook ring is in the top 28 px.
      g.fillStyle(0xb8733a, 1);
      g.fillRoundedRect(-52, -50, 104, 90, 44);
      g.fillRect(-64, 26, 128, 18);
      g.fillCircle(0, 52, 11);
      g.lineStyle(5, DARK, 1);
      g.strokeRoundedRect(-52, -50, 104, 90, 44);
      g.strokeCircle(0, -72, 10);
      g.fillStyle(0xe0a060, 1);
      g.fillRoundedRect(-30, -34, 16, 52, 8);
      return true;
    case 'ws-window-frame':
      windowFrame(g, 110, 110);
      return true;
    case 'ws-egg-piece':
      star(g, 48);
      return true;
    case 'ws-capybara-ring':
      capybara(g, 220, 280, 'ring');
      return true;
    case 'ws-capybara-cheer':
      capybara(g, 220, 280, 'cheer');
      return true;
    case 'ws-capybara-facepalm':
      capybara(g, 220, 280, 'facepalm');
      return true;
    default:
      return false;
  }
}
