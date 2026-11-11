// Character state machine (pure, no Phaser). The Phaser `Character` drives visuals
// from these transitions; this module only decides which transitions are legal.

export type CharacterState = 'hidden' | 'enter' | 'idle' | 'talking' | 'happy' | 'munch' | 'hmm' | 'exit' | 'gone';

/**
 * Allowed transitions. `happy` and `munch` are "busy" states: a voice line that starts
 * during them does not interrupt (the Character keeps chewing/celebrating and simply
 * awaits the audio). `exit` is reachable from every visible state.
 */
export const TRANSITIONS: Readonly<Record<CharacterState, readonly CharacterState[]>> = {
  hidden: ['enter', 'idle', 'gone'],
  enter: ['idle', 'exit', 'gone'],
  idle: ['talking', 'happy', 'munch', 'hmm', 'exit', 'gone'],
  talking: ['idle', 'talking', 'happy', 'munch', 'hmm', 'exit', 'gone'],
  happy: ['idle', 'munch', 'happy', 'exit', 'gone'],
  munch: ['idle', 'happy', 'exit', 'gone'],
  hmm: ['idle', 'talking', 'hmm', 'happy', 'munch', 'exit', 'gone'],
  exit: ['gone'],
  gone: [],
};

/** States that settle back to `idle` on their own when their action finishes. */
export const RETURNS_TO_IDLE: ReadonlySet<CharacterState> = new Set(['enter', 'talking', 'happy', 'munch', 'hmm']);

export function canTransition(from: CharacterState, to: CharacterState): boolean {
  return TRANSITIONS[from].includes(to);
}

export type StateListener = (to: CharacterState, from: CharacterState) => void;

export class CharacterStateMachine {
  private current: CharacterState = 'hidden';
  private readonly listeners: StateListener[] = [];
  /** Increments on every accepted transition; lets async actions detect they were superseded. */
  private generation = 0;

  get state(): CharacterState {
    return this.current;
  }

  get token(): number {
    return this.generation;
  }

  canEnter(to: CharacterState): boolean {
    return canTransition(this.current, to);
  }

  /** Attempts a transition. Returns the new token on success, or -1 when it is not allowed. */
  request(to: CharacterState): number {
    if (!canTransition(this.current, to)) return -1;
    const from = this.current;
    this.current = to;
    this.generation++;
    for (const l of this.listeners) l(to, from);
    return this.generation;
  }

  /** Called when an action finishes: returns to idle only if nothing else happened since. */
  settle(token: number): boolean {
    if (token !== this.generation) return false;
    if (!RETURNS_TO_IDLE.has(this.current)) return false;
    return this.request('idle') !== -1;
  }

  isCurrent(token: number): boolean {
    return token === this.generation;
  }

  isBusy(): boolean {
    return this.current === 'happy' || this.current === 'munch' || this.current === 'enter' || this.current === 'exit';
  }

  onChange(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }
}
