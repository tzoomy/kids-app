// Device-TTS text for the Sorting Beds voice table (docs/specs/sorting-beds.md, "Voice table", strings as corrected
// in the team-lead voice-string review). Pass 1 only: Pass 2 adds Leda clips with text hashes in voice-lines-he.json
// and audio-manifest.json, which this file does not touch.
export const SORTING_LINE_TEXT: Record<string, string> = {
  'sorting.rule.color.he': 'בואי נמיין את הפרחים לפי צבע!',
  'sorting.rule.shape.he': 'בואי נמיין את הפרחים לפי צורה!',
  'sorting.rule.size.he': 'בואי נמיין את הפרחים לפי גודל — גדולים וקטנים!',
  'sorting.rule.two-attr.he': 'שימי לב גם לצבע וגם לגודל!',
  'sorting.switch.size.he': 'הפתעה! עכשיו שימי לב לגודל!',
  'sorting.switch.color.he': 'הפתעה! עכשיו שימי לב לצבע!',
  'sorting.switch.shape.he': 'הפתעה! עכשיו שימי לב לצורה!',
  'sorting.correct.he': 'יופי! הפרח בערוגה הנכונה!',
  'sorting.wrong.hint.he': 'כמעט! נסי את הערוגה המסומנת.',
  'sorting.bed-full.he': 'הערוגה מלאה ופורחת! כל הכבוד!',
  'sorting.help.he': 'שימי כל פרח בערוגה שמתאימה לו.',
  'sorting.word.red.en': 'red',
  'sorting.word.yellow.en': 'yellow',
  'sorting.word.blue.en': 'blue',
  'sorting.word.big.en': 'big',
  'sorting.word.small.en': 'small',
  'sorting.word.red.fr': 'rouge',
  'sorting.word.yellow.fr': 'jaune',
  'sorting.word.blue.fr': 'bleue',
  'sorting.word.big.fr': 'grande',
  'sorting.word.small.fr': 'petite',
};

/** Wraps Hebrew in a right-to-left isolate so it renders correctly inside the LTR-isolated prompt bubble. */
export function rtlIsolate(text: string): string {
  return `\u2067${text}\u2069`;
}
