// Device-TTS text for the Picnic Train voice table (docs/specs/picnic-train.md, "Voice table"). Pass 1 only: Pass 2 adds
// Leda clips with text hashes in voice-lines-he.json and audio-manifest.json, which this file does not touch.

/** Masculine Hebrew number words 1..10 (the counted noun is `פריטים`, masculine). Index = number. */
const HEBREW_NUMBERS: readonly string[] = ['', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה'];

export function hebrewNumber(n: number): string {
  return HEBREW_NUMBERS[n] ?? String(n);
}

const NUMBER_EN: readonly string[] = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const NUMBER_FR: readonly string[] = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];

function buildLineText(): Record<string, string> {
  const text: Record<string, string> = {
    'picnic.ask.one-each.he': 'בואי נאכיל את החברים ברכבת! תני לכל חבר פריט אחד לפיקניק.',
    'picnic.ask.missing.he': 'לחלק מהחברים כבר יש פריט. כמה פריטים עוד חסרים?',
    'picnic.missing.give.he': 'נכון! עכשיו תני פריט לכל חבר שחסר לו.',
    'picnic.wrong.given.he': 'לחבר הזה כבר יש פריט. נסי חבר שעוד אין לו!',
    'picnic.wrong.count.he': 'בואי נספור שוב ביחד.',
    'picnic.ready.he': "הרכבת מוכנה לדרך! צ'ו צ'ו!",
    'picnic.help.he': 'תני לכל חבר ברכבת את מה שחסר לו, וסופרים ביחד.',
  };
  for (let n = 2; n <= 10; n++) {
    text[`picnic.ask.load.${n}.he`] = `ארזי ${hebrewNumber(n)} פריטים לפיקניק, ואז לחצי על הדגל!`;
  }
  for (let n = 1; n <= 10; n++) {
    text[`picnic.number.${n}.en`] = NUMBER_EN[n];
    text[`picnic.number.${n}.fr`] = NUMBER_FR[n];
  }
  return text;
}

/** lineId -> device-TTS text. */
export const PICNIC_LINE_TEXT: Record<string, string> = buildLineText();
