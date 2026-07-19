// A simple instantaneous RMS reading can't tell "loud background noise"
// apart from "the user is speaking normally" — both raise the volume the
// same way. Background noise stays present even during the brief pauses
// between words, while the user's own voice doesn't, so the *rolling
// minimum* RMS over the last few seconds is a much better proxy for the
// actual ambient noise floor than the current instantaneous reading.

export type NoiseLevel = "quiet" | "moderate" | "noisy";

const NOISE_QUIET_THRESHOLD = 0.02;
const NOISE_MODERATE_THRESHOLD = 0.06;
const WINDOW_SIZE = 6; // ~3s at the existing 500ms sampling interval

export class NoiseFloorTracker {
  private samples: number[] = [];

  addSample(rms: number): NoiseLevel {
    this.samples.push(rms);
    if (this.samples.length > WINDOW_SIZE) this.samples.shift();

    const floor = Math.min(...this.samples);
    if (floor < NOISE_QUIET_THRESHOLD) return "quiet";
    if (floor < NOISE_MODERATE_THRESHOLD) return "moderate";
    return "noisy";
  }
}
