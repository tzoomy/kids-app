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
  // Age-5 French-first / English-first rule and switch asks (Hebrew above stays for age 2; feedback and help stay Hebrew).
  'sorting.rule.color.en': "Let's sort the flowers by color!",
  'sorting.rule.color.fr': 'Rangeons les fleurs par couleur !',
  'sorting.rule.shape.en': "Let's sort the flowers by shape!",
  'sorting.rule.shape.fr': 'Rangeons les fleurs par forme !',
  'sorting.rule.size.en': "Let's sort the flowers by size — big and small!",
  'sorting.rule.size.fr': 'Rangeons les fleurs par taille — les grandes et les petites !',
  'sorting.rule.two-attr.en': 'Pay attention to both color and size!',
  'sorting.rule.two-attr.fr': 'Fais attention à la couleur et à la taille !',
  'sorting.switch.size.en': 'Surprise! Now pay attention to size!',
  'sorting.switch.size.fr': 'Surprise ! Maintenant, fais attention à la taille !',
  'sorting.switch.color.en': 'Surprise! Now pay attention to color!',
  'sorting.switch.color.fr': 'Surprise ! Maintenant, fais attention à la couleur !',
  'sorting.switch.shape.en': 'Surprise! Now pay attention to shape!',
  'sorting.switch.shape.fr': 'Surprise ! Maintenant, fais attention à la forme !',
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
