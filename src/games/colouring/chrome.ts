// Frozen Hebrew chrome strings and test ids for Colouring Time (spec voice / aria table).
// The stub scene does not render these yet; unit tests pin the contract (AC-23).

export const COLOURING_DIR = 'rtl' as const;

export const COLOURING_ARIA_LABELS = {
  undo: 'ביטול',
  clear: 'ניקוי',
  prev: 'הדף הקודם',
  next: 'הדף הבא',
  home: 'בית',
} as const;

export const COLOURING_END_COPY = {
  title: 'זמן הצביעה נגמר',
  message: 'הציור שלך שמור. נתראה בפעם הבאה!',
} as const;

/** Selected swatch uses a ring (and scale), not colour-only, so it stays visible for colour-blind kids. */
export const SELECTED_SWATCH_INDICATOR = 'ring' as const;

export const COLOURING_TEST_IDS = {
  countdown: 'colouring-countdown',
  page: 'colouring-page',
  undo: 'colouring-undo',
  clear: 'colouring-clear',
  prev: 'colouring-prev',
  next: 'colouring-next',
  palette: 'colouring-palette',
  end: 'colouring-end',
  endHome: 'colouring-end-home',
  pickerColouring: 'game-picker-leisure-colouring',
  pickerBubbles: 'game-picker-bubbles',
  pickerClose: 'game-picker-close',
} as const;

export function swatchTestId(colorId: string): string {
  return `colouring-swatch-${colorId}`;
}
