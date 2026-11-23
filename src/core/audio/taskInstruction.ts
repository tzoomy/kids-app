// Wave 2 French-first task instructions: which language speaks the primary task ask (the ask / rule / intro that tells the
// child what to do). Age 5 hears the round's active learning language (`en` or `fr`); age 2 stays Hebrew.
// Miss / wrong / help lines are NOT routed through this helper: they stay Hebrew on both tracks (pending Maor decision,
// docs/PENDING-DECISIONS.md, 2026-11-24).
export type TaskTrack = 'age2' | 'age5';
export type TaskLang = 'he' | 'en' | 'fr';

/** Primary task-instruction language: age5 uses the round's learning language; age2 stays Hebrew. */
export function taskInstructionLang(track: TaskTrack, roundLang: 'en' | 'fr'): TaskLang {
  return track === 'age5' ? roundLang : 'he';
}
