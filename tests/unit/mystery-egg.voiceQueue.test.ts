// Mystery Egg single voice (docs/specs/mystery-egg.md AC-21): two voice clips never play at the same time. The AudioManager
// either interrupts the current clip (a new line takes the floor) or queues the new clip behind it (the cat-wake lines).
import { describe, expect, it } from 'vitest';
import { AudioManager } from '../../src/core/audio';
import type { AudioProvider, SpeechRequest } from '../../src/core/audio/types';
import { voicePlayMode } from '../../src/games/mysteryEgg/speech';

const req = (lineId: string): SpeechRequest => ({ lineId, lang: 'fr', text: lineId });

/** A provider whose clips last until `finish()` (natural end) or `stop()` (a cut); counts clips playing at once. */
function controlled() {
  const log: string[] = [];
  let active = 0;
  let maxActive = 0;
  let current: { id: string; settle: (played: boolean) => void } | null = null;
  const provider: AudioProvider = {
    id: 'fake',
    isAvailable: () => true,
    warmup: () => undefined,
    play(request) {
      active++;
      maxActive = Math.max(maxActive, active);
      log.push(`start ${request.lineId}`);
      return new Promise<boolean>((resolve) => {
        current = {
          id: request.lineId,
          settle: (played) => {
            active--;
            resolve(played);
          },
        };
      });
    },
    stop() {
      const c = current;
      current = null;
      if (c) {
        log.push(`cut ${c.id}`);
        c.settle(true);
      }
    },
  };
  return {
    manager: new AudioManager([provider]),
    log,
    get maxActive() {
      return maxActive;
    },
    /** The playing clip ends by itself. */
    finish() {
      const c = current;
      current = null;
      if (c) {
        log.push(`end ${c.id}`);
        c.settle(true);
      }
    },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

describe('mystery-egg single voice (AudioManager queue)', () => {
  it('[AC-21] two plain plays are never concurrent: the second cuts the first', async () => {
    const t = controlled();
    void t.manager.play(req('a'));
    await flush();
    void t.manager.play(req('b'));
    await flush();
    expect(t.log).toEqual(['start a', 'cut a', 'start b']);
    expect(t.maxActive).toBe(1);
  });

  it('[AC-21] a queued clip waits for the current clip to END (it is not cut) and then plays', async () => {
    const t = controlled();
    void t.manager.play(req('croissants'));
    await flush();
    const queued = t.manager.playQueued(req('success'));
    await flush();
    expect(t.log).toEqual(['start croissants']);
    t.finish();
    await flush();
    expect(t.log).toEqual(['start croissants', 'end croissants', 'start success']);
    t.finish();
    expect(await queued).toBe(true);
    expect(t.maxActive).toBe(1);
  });

  it('[AC-21] queued clips play in order, one at a time', async () => {
    const t = controlled();
    void t.manager.play(req('a'));
    void t.manager.playQueued(req('b'));
    void t.manager.playQueued(req('c'));
    await flush();
    for (let i = 0; i < 3; i++) {
      t.finish();
      await flush();
    }
    expect(t.log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
    expect(t.maxActive).toBe(1);
  });

  it('[AC-21] a queued clip reports its start only when it really starts, and never if it is dropped', async () => {
    const t = controlled();
    const started: string[] = [];
    void t.manager.play(req('a'));
    void t.manager.playQueued(req('b'), () => started.push('b'));
    void t.manager.playQueued(req('c'), () => started.push('c'));
    await flush();
    expect(started).toEqual([]);
    t.finish();
    await flush();
    expect(started).toEqual(['b']);
    t.manager.stopAll();
    await flush();
    expect(started).toEqual(['b']);
  });

  it('[AC-21] a queued clip with nothing playing starts at once, and queues behind a plain play too', async () => {
    const t = controlled();
    void t.manager.playQueued(req('a'));
    await flush();
    expect(t.log).toEqual(['start a']);
    t.finish();
    await flush();
    void t.manager.play(req('b'));
    void t.manager.playQueued(req('c'));
    await flush();
    expect(t.log.slice(-1)).toEqual(['start b']);
    t.finish();
    await flush();
    expect(t.log.slice(-2)).toEqual(['end b', 'start c']);
    expect(t.maxActive).toBe(1);
  });

  it('[AC-21] an interrupting play drops the queued clips (they never start and resolve false)', async () => {
    const t = controlled();
    void t.manager.play(req('a'));
    const queued = t.manager.playQueued(req('b'));
    await flush();
    void t.manager.play(req('c'));
    await flush();
    t.finish();
    await flush();
    expect(await queued).toBe(false);
    expect(t.log).toEqual(['start a', 'cut a', 'start c', 'end c']);
    expect(t.maxActive).toBe(1);
  });

  it('[AC-21] stopAll silences the voice and drops the queue', async () => {
    const t = controlled();
    void t.manager.play(req('a'));
    const queued = t.manager.playQueued(req('b'));
    await flush();
    t.manager.stopAll();
    await flush();
    expect(await queued).toBe(false);
    expect(t.log).toEqual(['start a', 'cut a']);
  });

  it('[AC-21] the cat wakes: the success line queues behind the cat line, every other line interrupts', () => {
    expect(voicePlayMode('vo-fr-success')).toBe('queue');
    for (const id of ['vo-fr-cat-croissants', 'vo-fr-instruction', 'vo-fr-story', 'vo-fr-presque', 'vo-he-robot-help-1', 'vo-he-robot-help-2']) {
      expect(voicePlayMode(id)).toBe('interrupt');
    }
  });
});
