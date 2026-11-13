import type { AgeTrack, TrackPolicy } from './types';

/**
 * Age policy lives in code, not content, so no game JSON can enable speed scoring
 * or drag on the age-2 track. `drag` is used by templates that support it.
 */
export function trackPolicy(track: AgeTrack): TrackPolicy {
  if (track === 'age2') {
    return { interaction: 'tap', useResponseTime: false, levelChange: 'between-rounds' };
  }
  // useResponseTime stays false in v1 (response-time skip-ahead is deferred).
  return { interaction: 'drag', useResponseTime: false, levelChange: 'after-trial' };
}
