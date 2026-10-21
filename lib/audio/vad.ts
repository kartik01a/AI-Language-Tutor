// Energy-based voice-activity check (docs/05 §2). Runs on the client before upload so silence
// never reaches (or costs) STT. Pure: feed PCM chunks, read the result. Silero is deferred.

export interface VadOptions {
  sampleRate: number;
  frameMs?: number;
  /** Speech must exceed noiseFloor × this ratio (and the absolute minimum). */
  ratio?: number;
  /** Absolute RMS floor so digital silence / very quiet rooms don't trigger. */
  minRms?: number;
  /** Duration at the start used to estimate the noise floor. */
  calibrationMs?: number;
  /** Keep this much silence around speech when trimming. */
  padMs?: number;
}

export interface VadResult {
  clipMs: number;
  speechMs: number;
  /** Average level of voiced frames in dBFS (≈ -25 good, quieter than TOO_QUIET_DB is flagged). */
  rmsDb: number;
  tooQuiet: boolean;
  clipped: boolean;
  /** Sample range worth uploading (leading/trailing silence removed), or null if no speech. */
  trim: [number, number] | null;
}

/** Speech detected but weaker than this (dBFS RMS) → ask the learner to hold the phone closer. */
export const TOO_QUIET_DB = -36;

const rmsOf = (s: Float32Array, a: number, b: number) => {
  let sum = 0;
  for (let i = a; i < b; i++) sum += s[i] * s[i];
  return Math.sqrt(sum / Math.max(1, b - a));
};

export function analyseClip(samples: Float32Array, opts: VadOptions): VadResult {
  const frameMs = opts.frameMs ?? 20;
  const ratio = opts.ratio ?? 3;
  const minRms = opts.minRms ?? 0.006;
  const calibMs = opts.calibrationMs ?? 200;
  const padMs = opts.padMs ?? 150;
  const frame = Math.max(1, Math.round((opts.sampleRate * frameMs) / 1000));
  const nFrames = Math.floor(samples.length / frame);
  const clipMs = (samples.length / opts.sampleRate) * 1000;

  if (nFrames === 0) return { clipMs, speechMs: 0, rmsDb: -Infinity, tooQuiet: true, clipped: false, trim: null };

  const rms: number[] = [];
  for (let i = 0; i < nFrames; i++) rms.push(rmsOf(samples, i * frame, (i + 1) * frame));

  // Noise floor: the quietest calibration frame (the learner may already be talking at t=0).
  const calibFrames = Math.max(1, Math.min(nFrames, Math.round(calibMs / frameMs)));
  const noise = Math.min(...rms.slice(0, calibFrames));
  const threshold = Math.max(minRms, noise * ratio);

  const voiced = rms.map((r) => r > threshold);
  const voicedCount = voiced.filter(Boolean).length;
  const speechMs = voicedCount * frameMs;

  let clipped = false;
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]) >= 0.999) { clipped = true; break; }

  if (voicedCount === 0) {
    return { clipMs, speechMs: 0, rmsDb: -Infinity, tooQuiet: Math.max(...rms) < minRms, clipped, trim: null };
  }

  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  const pad = Math.round(padMs / frameMs);
  const start = Math.max(0, first - pad) * frame;
  const end = Math.min(nFrames, last + 1 + pad) * frame;

  const meanVoiced = rms.filter((_, i) => voiced[i]).reduce((a, b) => a + b, 0) / voicedCount;
  const rmsDb = 20 * Math.log10(meanVoiced);

  return { clipMs, speechMs, rmsDb, tooQuiet: rmsDb < TOO_QUIET_DB, clipped, trim: [start, end] };
}
