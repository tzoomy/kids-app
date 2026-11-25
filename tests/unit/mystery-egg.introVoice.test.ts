import { describe, expect, it } from 'vitest';
import { IntroVoice, type VoiceAction } from '../../src/games/mysteryEgg/introVoice';

const speak = (lineId: string): VoiceAction => ({ type: 'speak', lineId } as VoiceAction);
const STOP: VoiceAction = { type: 'stop' };
const lines = (actions: VoiceAction[]) => actions.filter((a) => a.type === 'speak').map((a) => (a as { lineId: string }).lineId);

describe('mystery-egg intro voice sequencer', () => {
  it('[AC-20] normal flow: the story starts, and when it ends the instruction plays once; Go afterwards adds no second instruction', () => {
    const v = new IntroVoice();
    expect(v.start()).toEqual([speak('vo-fr-story')]);
    expect(v.storyEnded()).toEqual([speak('vo-fr-instruction')]);
    expect(v.goTapped()).toEqual([]);
    expect(v.storyEnded()).toEqual([]);
    expect(v.instructionCount).toBe(1);
  });

  it('[AC-18] early Go (the story is still playing): the story is cut and the instruction plays once as the build starts', () => {
    const v = new IntroVoice();
    v.start();
    const onGo = v.goTapped();
    expect(onGo).toEqual([STOP, speak('vo-fr-instruction')]);
    expect(v.instructionCount).toBe(1);
    // Cutting the story settles its promise: that late callback must not chain a second instruction.
    expect(v.storyEnded()).toEqual([]);
    expect(v.instructionCount).toBe(1);
  });

  it('[AC-18] Go after the story ended but with the instruction cut short elsewhere still ends with exactly one instruction', () => {
    const v = new IntroVoice();
    v.start();
    v.otherVoice(); // the ear button took the voice (Hebrew help); the story's late callback must stay silent
    expect(v.storyEnded()).toEqual([]);
    expect(v.instructionCount).toBe(0);
    expect(lines(v.goTapped())).toEqual(['vo-fr-instruction']);
    expect(v.instructionCount).toBe(1);
  });

  it('[AC-18] the instruction never plays twice by itself, whatever the order of Go and the story callback', () => {
    for (const order of [['go', 'story'], ['story', 'go']] as const) {
      const v = new IntroVoice();
      v.start();
      let spoken = 0;
      for (const step of order) spoken += lines(step === 'go' ? v.goTapped() : v.storyEnded()).length;
      expect(spoken, order.join('>')).toBe(1);
    }
  });

  it('[AC-19] the bunny replays the instruction at any time, cutting whatever is playing first, in the intro and in the build view', () => {
    const v = new IntroVoice();
    v.start();
    expect(v.bunnyTapped()).toEqual([STOP, speak('vo-fr-instruction')]);
    expect(v.storyEnded()).toEqual([]); // the story it cut must not chain another instruction
    expect(v.goTapped()).toEqual([]); // already played in this mission
    expect(v.bunnyTapped()).toEqual([STOP, speak('vo-fr-instruction')]);
    expect(v.bunnyTapped()).toEqual([STOP, speak('vo-fr-instruction')]);
    expect(v.instructionCount).toBe(3);
  });

  it('[AC-19] nothing but the bunny replays the French instruction: the ear and the story callback never do', () => {
    const v = new IntroVoice();
    v.start();
    v.goTapped();
    v.otherVoice();
    v.otherVoice();
    expect(v.storyEnded()).toEqual([]);
    expect(v.instructionCount).toBe(1);
  });
});
