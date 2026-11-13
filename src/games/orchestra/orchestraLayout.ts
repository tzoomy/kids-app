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

export function computeOrchestraLayout(width: number, height: number, choiceCount: number): OrchestraLayout {
  const portrait = height > width;
  const size = portrait ? Math.min(168, Math.floor(width / (choiceCount + 0.6))) : Math.min(176, Math.floor((width * 0.62) / choiceCount));
  const rowY = portrait ? height * PORTRAIT_INSTRUMENT_Y : height * LANDSCAPE_INSTRUMENT_Y;
  const rowWidth = size * choiceCount + size * 0.25 * (choiceCount - 1);
  const startX = portrait ? (width - rowWidth) / 2 + size / 2 : width * 0.42 + size / 2;
  const instruments: InstrumentSlot[] = [];
  for (let i = 0; i < choiceCount; i++) {
    instruments.push({ x: startX + i * (size * 1.25), y: rowY, size });
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
