// Per-skill level estimate (docs/08 §5.2). A continuous score θ (A1 = 1 … B2 = 4, band [n, n+1))
// with shrinking step size, a per-session cap and hysteresis on the displayed level.

export type CefrBand = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
const BANDS: CefrBand[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const MIN_SPEECH_SECONDS = 60;
export const MAX_NON_UNDERSTANDING_RATE = 0.3;
export const MAX_STEP = 0.5;
export const HYSTERESIS_MARGIN = 0.2;
export const HYSTERESIS_SESSIONS = 2;

export interface SkillEstimate {
  theta: number;
  /** Qualifying sessions so far. */
  n: number;
  displayed: CefrBand;
  /** Consecutive sessions θ has sat beyond the boundary of an adjacent band. */
  pendingDirection: -1 | 0 | 1;
  pendingCount: number;
  recent: number[];
}

export function bandOf(theta: number): CefrBand {
  const i = Math.min(BANDS.length - 1, Math.max(0, Math.floor(theta) - 1));
  return BANDS[i];
}

export function initialEstimate(startBand: CefrBand): SkillEstimate {
  return {
    theta: BANDS.indexOf(startBand) + 1.5, // middle of the self-selected band
    n: 0,
    displayed: startBand,
    pendingDirection: 0,
    pendingCount: 0,
    recent: [],
  };
}

export interface SessionQuality {
  learnerSpeechSeconds: number;
  nonUnderstandingRate: number;
}

export function isQualifyingSession(q: SessionQuality): boolean {
  return q.learnerSpeechSeconds >= MIN_SPEECH_SECONDS && q.nonUnderstandingRate <= MAX_NON_UNDERSTANDING_RATE;
}

export function stepSize(n: number): number {
  return Math.max(0.15, 1 / (n + 1.5));
}

/** Apply one session's evidence x (same 0–6 scale). Non-qualifying sessions leave the estimate untouched. */
export function updateEstimate(est: SkillEstimate, x: number, q: SessionQuality): SkillEstimate {
  if (!isQualifyingSession(q)) return est;

  const delta = Math.max(-MAX_STEP, Math.min(MAX_STEP, stepSize(est.n) * (x - est.theta)));
  const theta = Math.max(0.5, est.theta + delta);
  const recent = [...est.recent, x].slice(-5);

  // Hysteresis: only change the displayed band after θ is ≥ margin beyond the boundary
  // for HYSTERESIS_SESSIONS consecutive qualifying sessions.
  const cur = BANDS.indexOf(est.displayed) + 1; // band occupies [cur, cur+1)
  let dir: -1 | 0 | 1 = 0;
  if (theta >= cur + 1 + HYSTERESIS_MARGIN) dir = 1;
  else if (theta < cur - HYSTERESIS_MARGIN) dir = -1;

  let pendingCount = dir !== 0 && dir === est.pendingDirection ? est.pendingCount + 1 : dir !== 0 ? 1 : 0;
  let displayed = est.displayed;
  let pendingDirection = dir;
  if (dir !== 0 && pendingCount >= HYSTERESIS_SESSIONS) {
    const idx = Math.min(BANDS.length - 1, Math.max(0, BANDS.indexOf(est.displayed) + dir));
    displayed = BANDS[idx];
    pendingCount = 0;
    pendingDirection = 0;
  }

  return { theta, n: est.n + 1, displayed, pendingDirection, pendingCount, recent };
}

/** Spread of the last evidence values, shown to learners as a "likely A2–B1" range. */
export function uncertainty(est: SkillEstimate): number {
  if (est.recent.length < 2) return 0.75;
  const mean = est.recent.reduce((a, b) => a + b, 0) / est.recent.length;
  const variance = est.recent.reduce((a, b) => a + (b - mean) ** 2, 0) / est.recent.length;
  return Math.max(0.15, Math.sqrt(variance));
}

export function likelyRange(est: SkillEstimate): [CefrBand, CefrBand] {
  const u = uncertainty(est);
  return [bandOf(est.theta - u), bandOf(est.theta + u)];
}
