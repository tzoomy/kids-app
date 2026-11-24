/** Kitchen Orchestra layout in game coordinates (1280×800 or 800×1280). */
export interface InstrumentSlot {
  x: number;
  y: number;
  size: number;
}

export interface ChefSlot {
  x: number;
  feetY: number;
  displayHeight: number;
  /** Behind the instruments in portrait (they sit on the counter in front). */
  depth: number;
}

export interface OrchestraLayout {
  portrait: boolean;
  backgroundKey: 'bg-landscape' | 'bg-portrait';
  chef: ChefSlot;
  instruments: InstrumentSlot[];
}

/**
 * Counter-top Y in the kitchen background SVGs, as a fraction of the art height.
 * Portrait: `bg-portrait.svg` counter starts at y=856 in a 1280-tall viewBox.
 * The chef's feet plant here so they stand behind the counter, not in the wall.
 */
export const PORTRAIT_COUNTER_TOP = 856 / 1280;

/** Instruments sit a little below the counter lip, on the wooden surface. */
const PORTRAIT_INSTRUMENT_Y = 0.68;
const LANDSCAPE_INSTRUMENT_Y = 0.72;

/**
 * Smallest instrument side (game px) a refitted row may use: 144 game px is 64.8 CSS px at the 0.45 scale of a
 * 360 px phone, so the owner's 64 CSS px minimum tap target holds (AGENTS.md).
 */
export const MIN_INSTRUMENT_SIZE = 144;
/** Edge margin (game px) a refitted row keeps from the screen edges. */
const ROW_MARGIN = 12;
/** Landscape: a refitted row starts right of the chef (who stands at 0.2 of the width). */
const LANDSCAPE_REFIT_LEFT = 0.32;

/**
 * Fits `count` instruments between `left` and `right`: the usual quarter-size gaps when they fit at or above
 * MIN_INSTRUMENT_SIZE, otherwise narrower gaps (never under 8 %) so the instruments keep the minimum size.
 */
function fitRow(left: number, right: number, count: number, cap: number): { size: number; step: number; startX: number } {
  const avail = right - left;
  let gap = 0.25;
  let size = Math.min(cap, Math.floor(avail / (count + gap * (count - 1))));
  if (size < MIN_INSTRUMENT_SIZE && count > 1) {
    gap = Math.max(0.08, (avail / MIN_INSTRUMENT_SIZE - count) / (count - 1));
    size = Math.min(cap, Math.floor(avail / (count + gap * (count - 1))));
  }
  const rowWidth = size * count + size * gap * (count - 1);
  return { size, step: size * (1 + gap), startX: left + (avail - rowWidth) / 2 + size / 2 };
}

export function computeOrchestraLayout(width: number, height: number, choiceCount: number): OrchestraLayout {
  const portrait = height > width;
  let size = portrait ? Math.min(168, Math.floor(width / (choiceCount + 0.6))) : Math.min(176, Math.floor((width * 0.62) / choiceCount));
  const rowY = portrait ? height * PORTRAIT_INSTRUMENT_Y : height * LANDSCAPE_INSTRUMENT_Y;
  const rowWidth = size * choiceCount + size * 0.25 * (choiceCount - 1);
  let startX = portrait ? (width - rowWidth) / 2 + size / 2 : width * 0.42 + size / 2;
  let step = size * 1.25;
  // Four or five instruments overflowed the screen edge with the original row (the fifth instrument sat off
  // screen in landscape). Rows that do not fit are refitted inside the screen; rows that fit are unchanged.
  const rowLeft = startX - size / 2;
  const rowRight = rowLeft + rowWidth;
  if (rowLeft < ROW_MARGIN || rowRight > width - ROW_MARGIN) {
    const fitted = portrait
      ? fitRow(ROW_MARGIN, width - ROW_MARGIN, choiceCount, 168)
      : fitRow(width * LANDSCAPE_REFIT_LEFT, width - ROW_MARGIN * 2, choiceCount, 176);
    ({ size, step, startX } = fitted);
  }
  const instruments: InstrumentSlot[] = [];
  for (let i = 0; i < choiceCount; i++) {
    instruments.push({ x: startX + i * step, y: rowY, size });
  }
  const chef: ChefSlot = portrait
    ? {
        x: width * 0.5,
        feetY: height * PORTRAIT_COUNTER_TOP,
        displayHeight: Math.min(280, height * 0.28),
        // In front of the background (0), behind the instruments (3).
        depth: 2,
      }
    : { x: width * 0.2, feetY: height * 0.78, displayHeight: Math.min(340, height * 0.48), depth: 4 };
  return {
    portrait,
    backgroundKey: portrait ? 'bg-portrait' : 'bg-landscape',
    chef,
    instruments,
  };
}

/**
 * The reverse-echo badge (age 5, reverse levels): a "backwards" arrow and one dot per note, centred under the
 * instrument row. Dots light left to right while the chef plays and go dark right to left as the child echoes,
 * so the "last note first" rule is visible as well as spoken. Decoration only: it takes no taps.
 */
export interface ReverseBadgeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Dot centres relative to the badge centre, in playing order (left to right). */
  dots: Array<{ x: number; y: number }>;
  dotRadius: number;
  /** The arrow's tip and tail x, relative to the badge centre (the tip points left). */
  arrow: { tipX: number; tailX: number; y: number };
}

export function computeReverseBadge(layout: OrchestraLayout, width: number, height: number, noteCount: number): ReverseBadgeLayout {
  const row = layout.instruments;
  const size = row[0]?.size ?? 120;
  const rowY = row[0]?.y ?? height * 0.7;
  const cx = row.length > 0 ? (row[0].x + row[row.length - 1].x) / 2 : width / 2;
  const dotRadius = 13;
  const dotGap = 40;
  const arrowW = 70;
  const n = Math.max(1, noteCount);
  const dotsW = (n - 1) * dotGap;
  const badgeW = arrowW + 30 + dotsW + dotRadius * 2 + 40;
  const badgeH = 64;
  const y = Math.min(height - badgeH / 2 - 8, rowY + size * 0.62 + 40);
  const left = -badgeW / 2 + 20;
  const dotsStart = left + arrowW + 30 + dotRadius;
  return {
    x: Math.min(width - badgeW / 2 - 8, Math.max(badgeW / 2 + 8, cx)),
    y,
    width: badgeW,
    height: badgeH,
    dots: Array.from({ length: n }, (_, i) => ({ x: dotsStart + i * dotGap, y: 0 })),
    dotRadius,
    arrow: { tipX: left, tailX: left + arrowW, y: 0 },
  };
}
