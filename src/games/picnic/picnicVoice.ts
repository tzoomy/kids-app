// Device-TTS text for the Picnic Train voice table (docs/specs/picnic-train.md, "Voice table"). Pass 1 only: Pass 2 adds
// Leda clips with text hashes in voice-lines-he.json and audio-manifest.json, which this file does not touch.
import picnicJson from '../../content/games/picnic-train.json';
import type { LevelDescriptor } from '../../content/schema';
import { equationAskId, equationCandidates, levelLevers, parseEquationId } from './picnicLogic';

/**
 * Masculine Hebrew number words 1..20 (the counted noun is `פריטים`, masculine). Index = number. 2 is the standalone
 * form (`שניים`); use `hebrewNumberBeforeNoun` where the number stands directly before `פריטים`.
 */
const HEBREW_NUMBERS: readonly string[] = [
  '', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה',
  'אחד עשר', 'שנים עשר', 'שלושה עשר', 'ארבעה עשר', 'חמישה עשר', 'שישה עשר', 'שבעה עשר', 'שמונה עשר', 'תשעה עשר', 'עשרים',
];

export function hebrewNumber(n: number): string {
  return HEBREW_NUMBERS[n] ?? String(n);
}

/** Number word standing directly before `פריטים` (construct state): 2 is `שני`; every other count is unchanged. */
export function hebrewNumberBeforeNoun(n: number): string {
  return n === 2 ? 'שני' : hebrewNumber(n);
}

const NUMBER_EN: readonly string[] = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];
const NUMBER_FR: readonly string[] = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt',
];

/** Largest count spoken aloud: the stretch shelf holds up to 20. */
const MAX_SPOKEN = 20;

/**
 * Hebrew request of a stretch train (feminine singular address; masculine numbers for `פריטים`). Stretch counts start at 5,
 * so the standalone/construct difference of 2 never arises here (after `ועוד` / `הוציאי` no noun follows).
 */
export function equationAskText(op: 'add' | 'sub', a: number, b: number): string {
  return op === 'add'
    ? `ארזי ${hebrewNumber(a)} פריטים ועוד ${hebrewNumber(b)}, ואז לחצי על הדגל!`
    : `ארזי ${hebrewNumber(a)} פריטים, הוציאי ${hebrewNumber(b)}, ואז לחצי על הדגל!`;
}

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
    text[`picnic.ask.load.${n}.he`] = `ארזי ${hebrewNumberBeforeNoun(n)} פריטים לפיקניק, ואז לחצי על הדגל!`;
  }
  for (let n = 1; n <= MAX_SPOKEN; n++) {
    text[`picnic.number.${n}.en`] = NUMBER_EN[n];
    text[`picnic.number.${n}.fr`] = NUMBER_FR[n];
  }
  // Age-5 stretch (L9-L10): one line per request the content can make, so each gets its own recorded clip.
  for (const level of picnicJson.adaptive.levels as LevelDescriptor[]) {
    const range = levelLevers(level).equation;
    if (!range) continue;
    for (const id of equationCandidates(range)) {
      const eq = parseEquationId(id)!;
      text[equationAskId(eq)] = equationAskText(eq.op, eq.a, eq.b);
    }
  }
  return text;
}

/** lineId -> device-TTS text. */
export const PICNIC_LINE_TEXT: Record<string, string> = buildLineText();
