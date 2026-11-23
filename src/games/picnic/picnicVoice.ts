// Device-TTS text for the Picnic Train voice table (docs/specs/picnic-train.md, "Voice table"). Pass 1 only: Pass 2 adds
// Leda clips with text hashes in voice-lines-he.json and audio-manifest.json, which this file does not touch.
import picnicJson from '../../content/games/picnic-train.json';
import type { LevelDescriptor } from '../../content/schema';
import { equationAskId, equationCandidates, levelLevers, parseEquationId } from './picnicLogic';

/**
 * Masculine Hebrew number words 1..20 (the counted noun is `פריטים`, masculine). Index = number. 2 is the standalone
 * form (`שניים`); the stretch lines only put 5 and up before the noun, so the construct form `שני` is never needed.
 */
const HEBREW_NUMBERS: readonly string[] = [
  '', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה',
  'אחד עשר', 'שנים עשר', 'שלושה עשר', 'ארבעה עשר', 'חמישה עשר', 'שישה עשר', 'שבעה עשר', 'שמונה עשר', 'תשעה עשר', 'עשרים',
];

export function hebrewNumber(n: number): string {
  return HEBREW_NUMBERS[n] ?? String(n);
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

/** Hebrew request of a stretch train (feminine singular address; masculine numbers for `פריטים`). */
export function equationAskText(op: 'add' | 'sub', a: number, b: number): string {
  return op === 'add'
    ? `ארזי ${hebrewNumber(a)} פריטים ועוד ${hebrewNumber(b)}, ואז לחצי על הדגל!`
    : `ארזי ${hebrewNumber(a)} פריטים, הוציאי ${hebrewNumber(b)}, ואז לחצי על הדגל!`;
}

/**
 * Age-5 task asks in English and French (Wave 2 French-first). Numbers are spoken words; 1 is `one` / `un`, and the noun
 * agrees (`item` / `objet`) when a count is exactly 1. French `objet` is masculine, hence `un`.
 */
function equationAskTextLang(op: 'add' | 'sub', a: number, b: number, lang: 'en' | 'fr'): string {
  const word = (n: number) => (lang === 'en' ? NUMBER_EN[n] : NUMBER_FR[n]);
  const noun = lang === 'en' ? (a === 1 ? 'item' : 'items') : a === 1 ? 'objet' : 'objets';
  if (lang === 'en') {
    return op === 'add'
      ? `Pack ${word(a)} ${noun} and ${word(b)} more, then tap the flag!`
      : `Pack ${word(a)} ${noun}, take out ${word(b)}, then tap the flag!`;
  }
  return op === 'add'
    ? `Emporte ${word(a)} ${noun} et encore ${word(b)}, puis appuie sur le drapeau !`
    : `Emporte ${word(a)} ${noun}, enlève ${word(b)}, puis appuie sur le drapeau !`;
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
    text[`picnic.ask.load.${n}.he`] = `ארזי ${hebrewNumber(n)} פריטים לפיקניק, ואז לחצי על הדגל!`;
  }
  // Age-5 French-first / English-first task asks (Hebrew above stays for age 2).
  text['picnic.ask.one-each.en'] = "Let's feed the friends on the train! Give each friend one picnic item.";
  text['picnic.ask.one-each.fr'] = 'Allons nourrir les copains dans le train ! Donne un objet de pique-nique à chaque copain.';
  text['picnic.ask.missing.en'] = 'Some friends already have an item. How many items are still missing?';
  text['picnic.ask.missing.fr'] = "Certains copains ont déjà un objet. Combien d'objets manquent encore ?";
  for (let n = 2; n <= 10; n++) {
    text[`picnic.ask.load.${n}.en`] = `Pack ${NUMBER_EN[n]} picnic items, then tap the flag!`;
    text[`picnic.ask.load.${n}.fr`] = `Emporte ${NUMBER_FR[n]} objets pour le pique-nique, puis appuie sur le drapeau !`;
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
      for (const lang of ['en', 'fr'] as const) text[equationAskId(eq, lang)] = equationAskTextLang(eq.op, eq.a, eq.b, lang);
    }
  }
  return text;
}

/** lineId -> device-TTS text. */
export const PICNIC_LINE_TEXT: Record<string, string> = buildLineText();
