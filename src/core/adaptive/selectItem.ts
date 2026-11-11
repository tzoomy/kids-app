// Item selection (minimal Leitner scheduler). Pure; randomness and time are injected.
import { BOX_INTERVAL_DAYS } from './rules';
import type { GameLevelsMeta, ItemState, SkillSessionState, SkillState } from './types';

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** A seen item is due when it was last seen on an earlier day and its box interval has elapsed. */
function isDue(item: ItemState, today: string): boolean {
  const elapsed = dayNumber(today) - dayNumber(item.lastSeenDay);
  return elapsed > 0 && elapsed >= BOX_INTERVAL_DAYS[item.box - 1];
}

function pickRandom<T>(list: readonly T[], random: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

export interface Selection {
  itemId: string;
  /** Same skill, with `afterDrop` cleared when it was consumed. */
  skill: SkillState;
}

/**
 * Priority (the last served item is skipped whenever another candidate exists):
 * 1. after a level drop: a known item (box >= masteredBox), else the highest box seen, else any;
 * 2. a missed item whose retry is due;
 * 3. a seen item due by its day interval, lowest box first;
 * 4. a new item when 3 known items were served since the last new one, or nothing was seen yet;
 * 5. a random seen item.
 * Stored items missing from `candidates` are ignored.
 */
export function selectNextItem(
  skill: SkillState,
  session: SkillSessionState,
  candidates: readonly string[],
  meta: GameLevelsMeta,
  today: string,
  random: () => number,
): Selection {
  if (candidates.length === 0) throw new Error('selectNextItem: no candidates');
  const others = candidates.filter((id) => id !== session.lastItemId);
  const pool = others.length > 0 ? others : [...candidates];
  const seen = pool.filter((id) => id in skill.items);
  const unseen = pool.filter((id) => !(id in skill.items));
  const done = (itemId: string, cleared = false): Selection => ({
    itemId,
    skill: cleared ? { ...skill, afterDrop: false } : skill,
  });

  if (skill.afterDrop) {
    const known = seen.filter((id) => skill.items[id].box >= meta.rules.masteredBox);
    if (known.length > 0) return done(pickRandom(known, random), true);
    if (seen.length > 0) {
      const top = Math.max(...seen.map((id) => skill.items[id].box));
      return done(pickRandom(seen.filter((id) => skill.items[id].box === top), random), true);
    }
    return done(pickRandom(pool, random), true);
  }

  const retry = session.retryQueue
    .filter((r) => r.dueAtTrial <= session.trialIndex && pool.includes(r.itemId))
    .sort((a, b) => a.dueAtTrial - b.dueAtTrial)[0];
  if (retry) return done(retry.itemId);

  const due = seen
    .filter((id) => isDue(skill.items[id], today))
    .sort((a, b) => skill.items[a].box - skill.items[b].box);
  if (due.length > 0) {
    const lowest = skill.items[due[0]].box;
    return done(pickRandom(due.filter((id) => skill.items[id].box === lowest), random));
  }

  if (unseen.length > 0 && (session.knownSinceNew >= 3 || seen.length === 0)) {
    return done(pickRandom(unseen, random));
  }
  if (seen.length > 0) return done(pickRandom(seen, random));
  return done(pickRandom(pool, random));
}
