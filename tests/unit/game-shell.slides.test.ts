// Game shell slide player (docs/specs/game-shell.md AC-09, AC-12): the pure model and the slide data.
import { describe, expect, it } from 'vitest';
import { assetEntry } from '../../src/games/mysteryEgg/assets';
import { ENTRY_SLIDES, INTRO_SLIDES, SlidePlayer, entrySlides, type SlideDef } from '../../src/games/mysteryEgg/slides';

const three: SlideDef[] = [
  { id: 'a', image: 'slide-intro-1', lines: ['vo-fr-intro-1', 'vo-he-intro-1'] },
  { id: 'b', image: 'slide-intro-2', lines: ['vo-fr-intro-2', 'vo-he-intro-2'] },
  { id: 'c', image: 'slide-intro-3', lines: ['vo-fr-intro-3'] },
];

describe('game-shell slide player model', () => {
  it('[AC-09] starts on slide 1 of N, playing, with the first slide current', () => {
    const p = new SlidePlayer(three);
    expect(p.count).toBe(3);
    expect(p.index).toBe(0);
    expect(p.state).toBe('playing');
    expect(p.current?.id).toBe('a');
  });

  it('[AC-09] advance moves on one slide at a time and ends after the last one', () => {
    const p = new SlidePlayer(three);
    expect(p.advance()).toEqual({ outcome: 'next', finished: false });
    expect(p.current?.id).toBe('b');
    expect(p.advance()).toEqual({ outcome: 'next', finished: false });
    expect(p.current?.id).toBe('c');
    expect(p.advance()).toEqual({ outcome: 'ended', finished: true });
    expect(p.state).toBe('ended');
    expect(p.current).toBeNull();
  });

  it('[AC-09] skip ends the whole sequence at once, from any slide', () => {
    const p = new SlidePlayer(three);
    p.advance();
    expect(p.skip()).toEqual({ outcome: 'skipped', finished: true });
    expect(p.state).toBe('skipped');
    expect(p.current).toBeNull();
  });

  it('[AC-09] after the end, advance and skip do nothing and the index never moves past the count', () => {
    const p = new SlidePlayer(three.slice(0, 1));
    p.advance();
    expect(p.advance()).toEqual({ outcome: 'ignored', finished: true });
    expect(p.skip()).toEqual({ outcome: 'ignored', finished: true });
    expect(p.index).toBe(1);
    const skipped = new SlidePlayer(three);
    skipped.skip();
    expect(skipped.advance().outcome).toBe('ignored');
    expect(skipped.state).toBe('skipped');
  });

  it('[AC-09] an empty sequence is already finished; each slide lists its voice lines in order, French then Hebrew', () => {
    const empty = new SlidePlayer([]);
    expect(empty.state).toBe('ended');
    expect(empty.current).toBeNull();
    expect(empty.advance().finished).toBe(true);
    for (const s of [...INTRO_SLIDES, ...(ENTRY_SLIDES.workshop ?? [])]) {
      const langs = s.lines.map((id) => assetEntry(id).lang);
      expect(langs, s.id).toEqual(['fr', 'he']);
    }
  });
});

describe('game-shell slide data', () => {
  const text = (id: string): string | undefined => assetEntry(id).transcript;

  it('[AC-12] the intro is 4 slides: scenes 1, 2, 4, 5 of the film script, French hero line then Hebrew robot line, copied exactly', () => {
    expect(INTRO_SLIDES.map((s) => s.image)).toEqual(['slide-intro-1', 'slide-intro-2', 'slide-intro-3', 'slide-intro-4']);
    expect(INTRO_SLIDES.map((s) => s.lines)).toEqual([
      ['vo-fr-intro-1', 'vo-he-intro-1'],
      ['vo-fr-intro-2', 'vo-he-intro-2'],
      ['vo-fr-intro-3', 'vo-he-intro-3'],
      ['vo-fr-intro-4', 'vo-he-intro-4'],
    ]);
    // Scene 1.
    expect(text('vo-fr-intro-1')).toBe('Oh ! Un œuf ! Il est tout chaud…');
    expect(text('vo-he-intro-1')).toBe('ביצה? איזו הפתעה… יש מישהו בפנים.');
    // Scene 2.
    expect(text('vo-fr-intro-2')).toBe('Mon petit robot… tu ne sais pas encore sentir.');
    expect(text('vo-he-intro-2')).toBe('אני יודע לחשוב ולבנות. אבל הלב שלי עוד ריק. אני לא יודע להרגיש.');
    // Scene 4.
    expect(text('vo-fr-intro-3')).toBe('Regarde ! Il y a des mondes à explorer.');
    expect(text('vo-he-intro-3')).toBe('זאת המפה. בכל עולם יש משחק אחר. אפשר ללכת לשם עם החברים, על השביל.');
    // Scene 5.
    expect(text('vo-fr-intro-4')).toBe('Des cœurs pour mon robot… et des trésors pour le nid.');
    expect(text('vo-he-intro-4')).toBe('כשמסיימים משחק, אני מקבל גלגל לב ולומד להרגיש. ואחרי כמה משחקים בעולם, הביצה מקבלת חלק חשוב לקן. ככה היא תוכל לבקוע.');
  });

  it('[AC-12] the Workshop entry is 2 slides: scenes 1 and 4 of the entry script, copied exactly', () => {
    expect(entrySlides('workshop').map((s) => s.image)).toEqual(['slide-workshop-1', 'slide-workshop-2']);
    expect(entrySlides('workshop').map((s) => s.lines)).toEqual([
      ['vo-fr-workshop-entry-1', 'vo-he-workshop-entry-1'],
      ['vo-fr-workshop-entry-2', 'vo-he-workshop-entry-2'],
    ]);
    expect(text('vo-fr-workshop-entry-1')).toBe("Voici l'atelier ! Ici, on construit des machines.");
    expect(text('vo-he-workshop-entry-1')).toBe('זאת הסדנה! כאן בונים מכונות מצחיקות, אחת אחרי השנייה, כמו שרשרת.');
    expect(text('vo-fr-workshop-entry-2')).toBe('Clic, clac… boum ! On y va ?');
    expect(text('vo-he-workshop-entry-2')).toBe('כשמצליחים, אני מקבל קצת צחוק לגלגל הלב. ואחרי כמה משחקים, הביצה מקבלת חלק חשוב. יאללה, בואו נשחק!');
  });

  it('[AC-12] the locked worlds have no entry slides yet', () => {
    for (const id of ['bakery', 'owl-house', 'jungle', 'garden'] as const) expect(entrySlides(id)).toEqual([]);
  });

  it('[AC-12] the locked line is the proposal, in feminine singular Hebrew', () => {
    expect(assetEntry('vo-he-robot-locked')).toMatchObject({ lang: 'he', transcript: 'העולם הזה עוד ישן. בואי נלך לסדנה!' });
  });
});
