// Thin stateful wrapper that binds the pure engine to one profile, one game and one age track.
import { localDayKey } from '../storage/dayKey';
import type { AdaptiveStore } from '../storage/adaptiveStore';
import { clampToTrack, endRound, initialSession, initialSkill, recordTrial } from './rules';
import { selectNextItem } from './selectItem';
import type { AgeTrack, GameLevelsMeta, LevelChange, SkillKey, SkillSessionState, SkillState, TrialResult } from './types';

export interface SkillSessionOptions {
  store: AdaptiveStore;
  profileId: string;
  track: AgeTrack;
  world: string;
  gameId: string;
  meta: GameLevelsMeta;
  today?: () => string;
  random?: () => number;
}

export function skillKey(world: string, gameId: string, lang: string): SkillKey {
  return `${world}.${gameId}.${lang}`;
}

export class SkillSession {
  private readonly sessions = new Map<string, SkillSessionState>();
  private readonly today: () => string;
  private readonly random: () => number;

  constructor(private readonly opts: SkillSessionOptions) {
    this.today = opts.today ?? (() => localDayKey(new Date()));
    this.random = opts.random ?? Math.random;
  }

  key(lang: string): SkillKey {
    return skillKey(this.opts.world, this.opts.gameId, lang);
  }

  private skill(lang: string): SkillState {
    const stored = this.opts.store.getSkill(this.opts.profileId, this.key(lang));
    const base = stored ?? initialSkill(this.opts.meta, this.opts.track, this.today());
    return clampToTrack(base, this.opts.meta, this.opts.track);
  }

  private session(lang: string): SkillSessionState {
    return this.sessions.get(lang) ?? initialSession();
  }

  /** Current 1-based level for this language (clamped to the track). */
  level(lang: string): number {
    return this.skill(lang).level;
  }

  /** True when the next trial opens a new round, so the caller may pick a new language. */
  atRoundBoundary(lang: string): boolean {
    return this.session(lang).trialsInRound === 0;
  }

  /**
   * Foods the child already knows, for secondary slots of a round (e.g. the second food of a
   * two-item request). Call it BEFORE `selectNextItem`: right after a level drop it returns the
   * mastered items (or, if none, every seen item); otherwise every seen item.
   */
  familiarItemIds(lang: string): string[] {
    const skill = this.skill(lang);
    const seen = Object.keys(skill.items);
    if (!skill.afterDrop) return seen;
    const known = seen.filter((id) => skill.items[id].box >= this.opts.meta.rules.masteredBox);
    return known.length > 0 ? known : seen;
  }

  selectNextItem(lang: string, candidates: readonly string[]): string {
    const skill = this.skill(lang);
    const sel = selectNextItem(skill, this.session(lang), candidates, this.opts.meta, this.today(), this.random);
    if (sel.skill !== skill) this.opts.store.setSkill(this.opts.profileId, this.key(lang), sel.skill);
    return sel.itemId;
  }

  /** Records one trial and persists immediately. */
  record(lang: string, result: TrialResult): LevelChange {
    const step = recordTrial(this.skill(lang), this.session(lang), result, this.opts.meta, this.opts.track, this.today());
    this.sessions.set(lang, step.session);
    this.opts.store.setSkill(this.opts.profileId, this.key(lang), step.skill);
    this.opts.store.persist(this.opts.profileId);
    return step.change;
  }

  /** Leaving the game is a round boundary. Applies a deferred change and persists. */
  endVisit(): void {
    for (const lang of [...this.sessions.keys()]) {
      const step = endRound(this.skill(lang), this.session(lang), this.opts.meta, this.opts.track);
      this.sessions.set(lang, step.session);
      this.opts.store.setSkill(this.opts.profileId, this.key(lang), step.skill);
    }
    this.opts.store.persist(this.opts.profileId);
  }
}
