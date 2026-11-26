// Game shell slide player (docs/specs/game-shell.md AC-09, AC-12): the pure model and the slide data.
import { describe, expect, it } from 'vitest';
import { assetEntry } from '../../src/games/mysteryEgg/assets';
import { ENTRY_SLIDES, INTRO_SLIDES, SLIDE_LINE_GAP_MS, SlidePlayer, SlideVoice, entrySlides, type SlideDef } from '../../src/games/mysteryEgg/slides';

const three: SlideDef[] = [
  { id: 'a', image: 'shell-intro-1', lines: ['vo-shell-intro-1-hero', 'vo-shell-intro-1-narr'] },
  { id: 'b', image: 'shell-intro-2', lines: ['vo-shell-intro-2-hero', 'vo-shell-intro-2-robot'] },
  { id: 'c', image: 'shell-intro-3', lines: ['vo-shell-intro-3-hero'] },
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

  it('[AC-09] an empty sequence is already finished; a two-clip slide lists its French hero clip first and the Hebrew clip second, with a short gap constant', () => {
    const empty = new SlidePlayer([]);
    expect(empty.state).toBe('ended');
    expect(empty.current).toBeNull();
    expect(empty.advance().finished).toBe(true);
    for (const s of [...INTRO_SLIDES, ...(ENTRY_SLIDES.workshop ?? [])]) {
      const langs = s.lines.map((id) => assetEntry(id).lang);
      expect(langs, s.id).toEqual(s.lines.length === 2 ? ['fr', 'he'] : ['he']);
    }
    expect(SLIDE_LINE_GAP_MS).toBe(400);
  });
});

describe('game-shell slide data', () => {
  const text = (id: string): string | undefined => assetEntry(id).transcript;

  it('[AC-12] the intro is 4 slides (egg found, empty hearts, promise and nest, map and goal) with Gemini\'s clips per slide, hero line before the Hebrew one', () => {
    expect(INTRO_SLIDES.map((s) => s.image)).toEqual(['shell-intro-1', 'shell-intro-2', 'shell-intro-3', 'shell-intro-4']);
    expect(INTRO_SLIDES.map((s) => s.lines)).toEqual([
      ['vo-shell-intro-1-hero', 'vo-shell-intro-1-narr'],
      ['vo-shell-intro-2-hero', 'vo-shell-intro-2-robot'],
      ['vo-shell-intro-3-hero', 'vo-shell-intro-3-robot'],
      ['vo-shell-intro-4-hero', 'vo-shell-intro-4-narr'],
    ]);
    expect(text('vo-shell-intro-1-hero')).toBe('Oh ! Un œuf !');
    expect(text('vo-shell-intro-1-narr')).toBe('ביצה חמה התגלגלה לכיכר!');
    expect(text('vo-shell-intro-2-hero')).toBe('Mon petit robot… tu ne sais pas encore sentir.');
    expect(text('vo-shell-intro-2-robot')).toBe('הלב שלי עוד ריק. אני לא יודע להרגיש.');
    expect(text('vo-shell-intro-3-hero')).toBe("On va t'aider, petit œuf. Promis !");
    expect(text('vo-shell-intro-3-robot')).toBe('נבנה לך קן חם, un nid. וגם אני אלמד להרגיש.');
    expect(text('vo-shell-intro-4-hero')).toBe('Regarde ! Des cœurs… et des trésors pour le nid.');
    expect(text('vo-shell-intro-4-narr')).toBe('מצליחים — הרובוט מקבל לב, un cœur. כמה משחקים — מתנה לקן. ככה הביצה תבקע!');
  });

  it('[AC-12] the Workshop entry is 2 slides: two clips on the first, only the robot clip on the second', () => {
    expect(entrySlides('workshop').map((s) => s.image)).toEqual(['shell-ws-1', 'shell-ws-2']);
    expect(entrySlides('workshop').map((s) => s.lines)).toEqual([
      ['vo-shell-ws-1-hero', 'vo-shell-ws-1-narr'],
      ['vo-shell-ws-2-robot'],
    ]);
    expect(text('vo-shell-ws-1-hero')).toBe("Voici l'atelier ! Monsieur Moustache dort !");
    expect(text('vo-shell-ws-1-narr')).toBe('החתול האופה ישן. בואי נעיר אותו!');
    expect(text('vo-shell-ws-2-robot')).toBe('שמים חלקים, לוחצים על נגן, והכדור, la balle, מתגלגל!');
  });

  it('[AC-12] the locked worlds have no entry slides yet, and there is no locked voice line', () => {
    for (const id of ['bakery', 'detective', 'jungle', 'garden'] as const) expect(entrySlides(id)).toEqual([]);
    expect(() => assetEntry('vo-he-robot-locked')).toThrow();
  });
});

describe('game-shell slide voice sequencing', () => {
  /** A fake clock and fake clips: each `play` resolves when the test says so. */
  function rig() {
    const played: string[] = [];
    const resolvers: Array<() => void> = [];
    const timers: Array<{ ms: number; fn: () => void; live: boolean }> = [];
    const voice = new SlideVoice({
      play: (id) => {
        played.push(id);
        return new Promise<void>((resolve) => resolvers.push(resolve));
      },
      schedule: (fn, ms) => {
        const t = { ms, fn, live: true };
        timers.push(t);
        return () => {
          t.live = false;
        };
      },
    });
    const flush = () => new Promise((r) => setTimeout(r, 0));
    return { voice, played, resolvers, timers, flush };
  }

  it('[AC-09] a two-clip slide plays the first clip, then the second after the ~400 ms gap', async () => {
    const r = rig();
    r.voice.start(['a', 'b']);
    expect(r.played).toEqual(['a']);
    r.resolvers[0]();
    await r.flush();
    expect(r.played).toEqual(['a']);
    expect(r.timers.map((t) => t.ms)).toEqual([SLIDE_LINE_GAP_MS]);
    r.timers[0].fn();
    expect(r.played).toEqual(['a', 'b']);
  });

  it('[AC-09] stop cancels the pending second clip, even when the first already ended (the gap timer is cleared)', async () => {
    const r = rig();
    r.voice.start(['a', 'b']);
    r.resolvers[0]();
    await r.flush();
    r.voice.stop();
    expect(r.timers[0].live).toBe(false);
    r.timers[0].fn(); // a late timer must not play anything
    expect(r.played).toEqual(['a']);
  });

  it('[AC-09] stop while the first clip still plays, and starting a new slide, never lets the old slide\'s second clip through', async () => {
    const r = rig();
    r.voice.start(['a', 'b']);
    r.voice.stop();
    r.resolvers[0](); // the stopped clip settles late
    await r.flush();
    expect(r.timers.filter((t) => t.live)).toEqual([]);
    r.voice.start(['c']);
    expect(r.played).toEqual(['a', 'c']);
    r.voice.start(['d', 'e']);
    r.resolvers[1](); // the superseded slide's first clip settles
    await r.flush();
    expect(r.timers.filter((t) => t.live)).toEqual([]);
    expect(r.played).toEqual(['a', 'c', 'd']);
  });

  it('[AC-09] a one-clip slide plays once and schedules nothing', async () => {
    const r = rig();
    r.voice.start(['solo']);
    r.resolvers[0]();
    await r.flush();
    expect(r.played).toEqual(['solo']);
    expect(r.timers).toEqual([]);
  });
});
