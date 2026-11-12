/** Kitchen Orchestra layout in game coordinates (1280×800 or 800×1280). */
export interface InstrumentSlot {
  x: number;
  y: number;
  size: number;
}

export interface OrchestraLayout {
  portrait: boolean;
  backgroundKey: 'bg-landscape' | 'bg-portrait';
  chef: { x: number; feetY: number; displayHeight: number };
  instruments: InstrumentSlot[];
}

export function computeOrchestraLayout(width: number, height: number, choiceCount: number): OrchestraLayout {
  const portrait = height > width;
  const size = portrait ? Math.min(168, Math.floor(width / (choiceCount + 0.6))) : Math.min(176, Math.floor((width * 0.62) / choiceCount));
  const rowY = portrait ? height * 0.68 : height * 0.72;
  const rowWidth = size * choiceCount + size * 0.25 * (choiceCount - 1);
  const startX = portrait ? (width - rowWidth) / 2 + size / 2 : width * 0.42 + size / 2;
  const instruments: InstrumentSlot[] = [];
  for (let i = 0; i < choiceCount; i++) {
    instruments.push({ x: startX + i * (size * 1.25), y: rowY, size });
  }
  const chef = portrait
    ? { x: width * 0.5, feetY: height * 0.60, displayHeight: Math.min(260, height * 0.26) }
    : { x: width * 0.2, feetY: height * 0.78, displayHeight: Math.min(340, height * 0.48) };
  return {
    portrait,
    backgroundKey: portrait ? 'bg-portrait' : 'bg-landscape',
    chef,
    instruments,
  };
}
