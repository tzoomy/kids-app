// Kitchen Orchestra age-5 stretch (docs/specs/kitchen-orchestra.md, L9-L10, AC-20 to AC-23).
import { describe, expect, it } from 'vitest';
import { loadKitchenOrchestra } from '@/content/loadContent';
import { KitchenOrchestraContentSchema } from '@/content/schema';
import { buildTrial, checkEchoTap, isPalindrome, orchestraLevers } from '@/games/orchestra/orchestraGame';
import { computeOrchestraLayout, computeReverseBadge } from '@/games/orchestra/orchestraLayout';
import { enumerateGameVoiceLines } from '../helpers/gameVoiceLines';

const content = loadKitchenOrchestra();
const levels = content.adaptive.levels;

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// The eight levels shipped before the stretch, verbatim (origin/main 3b9b160). Age 2 never sees anything else.
const L1_TO_L8 = [
  { sequenceLength: 1, choiceCount: 3, speed: 0.8, support: 'lit', request: 'sequence' },
  { sequenceLength: 2, choiceCount: 3, speed: 0.8, support: 'lit', request: 'sequence' },
  { sequenceLength: 2, choiceCount: 4, speed: 1, support: 'lit', request: 'sequence' },
  { sequenceLength: 3, choiceCount: 4, speed: 1, support: 'lit', request: 'sequence' },
  { sequenceLength: 3, choiceCount: 4, speed: 1, support: 'flash', request: 'sequence' },
  { sequenceLength: 4, choiceCount: 4, speed: 1.2, support: 'flash', request: 'sequence' },
  { sequenceLength: 4, choiceCount: 5, speed: 1.2, support: 'audio-only', request: 'sequence' },
  { sequenceLength: 5, choiceCount: 5, speed: 1.2, support: 'audio-only', request: 'sequence' },
];

describe('[AC-20] the age-5 stretch keeps the age-2 ladder untouched', () => {
  it('[AC-20] L1-L8 are unchanged, L9 (6-note echo) and L10 (reverse echo) are appended, age2 stays { 1, 1, 8 }, age5 reaches L10', () => {
    expect(levels.slice(0, 8)).toEqual(L1_TO_L8);
    expect(levels).toHaveLength(10);
    expect(content.adaptive.tracks.age2).toEqual({ start: 1, min: 1, max: 8 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 4, min: 1, max: 10 });
    expect(levels[8]).toEqual({ sequenceLength: 6, choiceCount: 5, speed: 1.3, support: 'flash', request: 'sequence' });
    expect(levels[9]).toEqual({ sequenceLength: 4, choiceCount: 5, speed: 1, support: 'flash', request: 'sequence', extra: { order: 'reverse' } });
    expect(levels.slice(0, 9).every((l) => !orchestraLevers(l).reverse)).toBe(true);
    expect(orchestraLevers(levels[9]).reverse).toBe(true);
  });

  it('[AC-20] the schema rejects a reverse level without the reverse lines, an audio-only reverse level and an unknown order', () => {
    const clone = () => JSON.parse(JSON.stringify(content)) as Record<string, any>;
    expect(KitchenOrchestraContentSchema.safeParse(clone()).success).toBe(true);
    const noLines = clone();
    delete noLines.reverse;
    expect(KitchenOrchestraContentSchema.safeParse(noLines).success).toBe(false);
    const audioOnly = clone();
    audioOnly.adaptive.levels[9].support = 'audio-only';
    expect(KitchenOrchestraContentSchema.safeParse(audioOnly).success).toBe(false);
    const badOrder = clone();
    badOrder.adaptive.levels[9].extra.order = 'sideways';
    expect(KitchenOrchestraContentSchema.safeParse(badOrder).success).toBe(false);
  });
});

describe('[AC-21] L9 six-note echo and L10 reverse echo', () => {
  it('[AC-21] L9 builds 6 notes over 5 instruments with no immediate repeat, echoed forwards', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const t = buildTrial(orchestraLevers(levels[8]), seeded(seed));
      expect(t.sequence).toHaveLength(6);
      expect(t.instruments).toHaveLength(5);
      expect(t.reverse).toBe(false);
      expect(t.answer).toEqual(t.sequence);
      for (let i = 1; i < t.sequence.length; i++) expect(t.sequence[i]).not.toBe(t.sequence[i - 1]);
    }
  });

  it('[AC-21] L10 asks for the pattern backwards: the answer is the reversed sequence and never equals it', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const t = buildTrial(orchestraLevers(levels[9]), seeded(seed));
      expect(t.reverse).toBe(true);
      expect(t.sequence).toHaveLength(4);
      expect(t.answer).toEqual([...t.sequence].reverse());
      expect(isPalindrome(t.sequence)).toBe(false);
      // Echoing forwards misses somewhere; echoing backwards completes.
      let fwd = 0;
      let missed = false;
      for (const id of t.sequence) {
        const step = checkEchoTap(t.answer, fwd, id);
        if (step.kind === 'miss') {
          missed = true;
          break;
        }
        if (step.kind === 'continue') fwd = step.nextIndex;
      }
      expect(missed).toBe(true);
      let index = 0;
      for (const [i, id] of t.answer.entries()) {
        const step = checkEchoTap(t.answer, index, id);
        expect(step.kind).toBe(i === t.answer.length - 1 ? 'complete' : 'continue');
        if (step.kind === 'continue') index = step.nextIndex;
      }
    }
  });

  it('[AC-21] a palindrome pattern is repaired so backwards differs (short reverse pattern A-B-A)', () => {
    // random() = 0 then 0.25 then 0 picks pot, pan, pot.
    const values = [0, 0.25, 0];
    let i = 0;
    const t = buildTrial({ sequenceLength: 3, choiceCount: 5, speed: 1, support: 'flash', reverse: true }, () => values[i++ % values.length]);
    expect(isPalindrome(t.sequence)).toBe(false);
    for (let k = 1; k < t.sequence.length; k++) expect(t.sequence[k]).not.toBe(t.sequence[k - 1]);
  });
});

describe('[AC-22] reverse cue: voice lines and the "backwards" badge', () => {
  it('[AC-22] EN / FR / HE reverse lines are registered with no conflicts; Hebrew addresses one girl', () => {
    const { lines, conflicts } = enumerateGameVoiceLines();
    expect(conflicts).toEqual({});
    const byId = new Map(lines.map((l) => [l.id, l]));
    expect(byId.get('orchestra.reverse.listen.en')?.text).toBe('Listen, then play it backwards!');
    expect(byId.get('orchestra.reverse.yourturn.en')?.text).toBe('Now play it backwards!');
    expect(byId.get('orchestra.reverse.listen.fr')?.text).toBe("Écoute bien, puis joue à l'envers !");
    expect(byId.get('orchestra.reverse.yourturn.fr')?.text).toBe("À toi ! Joue à l'envers !");
    const he = byId.get('orchestra.reverse.he')!;
    expect(he.lang).toBe('he');
    expect(he.text).toContain('הקשיבי');
    expect(he.text).toContain('נגני');
    expect(he.text).not.toMatch(/ב\.\.\.$/);
  });

  it('[AC-22] the badge sits on screen under the instruments with one dot per note, in both orientations', () => {
    for (const [w, h] of [
      [1280, 800],
      [800, 1280],
    ]) {
      const layout = computeOrchestraLayout(w, h, 5);
      const b = computeReverseBadge(layout, w, h, 4);
      expect(b.dots).toHaveLength(4);
      expect(b.x - b.width / 2).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width / 2).toBeLessThanOrEqual(w);
      expect(b.y + b.height / 2).toBeLessThanOrEqual(h);
      const row = layout.instruments;
      // Below the instruments (never covering their tap area).
      expect(b.y - b.height / 2).toBeGreaterThan(row[0].y + row[0].size / 2);
      // Dots run left to right in playing order, right of the left-pointing arrow.
      for (let i = 1; i < b.dots.length; i++) expect(b.dots[i].x).toBeGreaterThan(b.dots[i - 1].x);
      expect(b.arrow.tipX).toBeLessThan(b.arrow.tailX);
      expect(b.arrow.tailX).toBeLessThan(b.dots[0].x);
    }
  });

  it('[AC-22] four and five instruments stay on screen and >= 64 CSS px on a 360 px phone; three-instrument rows are unchanged', () => {
    for (const [w, h] of [
      [1280, 800],
      [800, 1280],
    ]) {
      // The 0.45 scale of a 360x800 (portrait) or 800x360 (landscape) phone is the smallest supported.
      const phoneScale = w > h ? Math.min(800 / 1280, 360 / 800) : Math.min(360 / 800, 800 / 1280);
      for (const n of [3, 4, 5]) {
        const row = computeOrchestraLayout(w, h, n).instruments;
        for (const slot of row) {
          expect(slot.x - slot.size / 2).toBeGreaterThanOrEqual(0);
          expect(slot.x + slot.size / 2).toBeLessThanOrEqual(w);
          expect(slot.size * phoneScale).toBeGreaterThanOrEqual(64);
        }
        for (let i = 1; i < row.length; i++) expect(row[i].x - row[i].size / 2).toBeGreaterThan(row[i - 1].x + row[i - 1].size / 2);
      }
    }
    // The age-2 three-instrument row keeps its original place (176 px, from 42 % of the width).
    const three = computeOrchestraLayout(1280, 800, 3).instruments;
    expect(three.map((s) => s.x)).toEqual([1280 * 0.42 + 88, 1280 * 0.42 + 88 + 220, 1280 * 0.42 + 88 + 440]);
    // Landscape rows stay right of the chef.
    const five = computeOrchestraLayout(1280, 800, 5);
    expect(five.instruments[0].x - five.instruments[0].size / 2).toBeGreaterThan(five.chef.x + 100);
  });
});
