import type { ProfileState } from '../storage/schema';

export interface LeisureTickResult {
  /** True exactly once, the tick that consumed the grace period and ended the session. */
  endedNow: boolean;
  /** True while balance is 0 and the short grace period is still running. */
  inGrace: boolean;
}

/**
 * Tracks one leisure (spending) session for one profile: redeems balance seconds
 * while visible, and gives a short grace period before signalling a calm end,
 * instead of snatching the screen the instant balance hits zero.
 */
export class LeisureSession {
  private hidden = false;
  private inGrace = false;
  private graceRemainingSec: number;

  constructor(
    private readonly state: ProfileState,
    private readonly graceSeconds = 5,
  ) {
    this.graceRemainingSec = graceSeconds;
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
  }

  get balanceSec(): number {
    return this.state.balanceSec;
  }

  get isInGrace(): boolean {
    return this.inGrace;
  }

  /** Call once per elapsed second (or pass a custom dtSec) while the leisure screen is open and visible. */
  tick(dtSec = 1): LeisureTickResult {
    if (this.hidden) return { endedNow: false, inGrace: this.inGrace };

    if (this.state.balanceSec > 0) {
      const spend = Math.min(this.state.balanceSec, dtSec);
      this.state.balanceSec -= spend;
      if (this.state.balanceSec <= 0) {
        this.inGrace = true;
        this.graceRemainingSec = this.graceSeconds;
      }
      return { endedNow: false, inGrace: this.inGrace };
    }

    if (this.inGrace) {
      this.graceRemainingSec -= dtSec;
      if (this.graceRemainingSec <= 0) {
        this.inGrace = false;
        return { endedNow: true, inGrace: false };
      }
    }
    return { endedNow: false, inGrace: this.inGrace };
  }
}
