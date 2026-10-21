// Gapless playback planning and lip-sync clock maths (docs/05 §4). Pure functions; the
// Web Audio wiring in player.ts just executes these plans.

export interface ScheduledClip {
  index: number;
  /** AudioContext time at which the clip starts. */
  startAt: number;
  endAt: number;
}

/**
 * Plans back-to-back clips. Sentences may arrive later than the previous one finishes (TTS is
 * still working); a clip never starts in the past, so late arrivals begin immediately.
 */
export function planClip(opts: {
  now: number;
  prevEndAt: number | null;
  durationSec: number;
  index: number;
  /** Small lead so scheduling is never "in the past" by the time the call is made. */
  leadSec?: number;
  gapSec?: number;
}): ScheduledClip {
  const lead = opts.leadSec ?? 0.03;
  const earliest = opts.now + lead;
  const wanted = opts.prevEndAt === null ? earliest : opts.prevEndAt + (opts.gapSec ?? 0);
  const startAt = Math.max(earliest, wanted);
  return { index: opts.index, startAt, endAt: startAt + opts.durationSec };
}

/**
 * Elapsed ms of audible audio for lip-sync, compensating output latency (Bluetooth can add
 * 100–300 ms) and a user-adjustable offset. Positive userOffsetMs makes the mouth lead the audio.
 */
export function lipSyncElapsedMs(opts: {
  ctxTime: number;
  clipStartAt: number;
  outputLatencySec: number;
  userOffsetMs?: number;
  playbackRate?: number;
}): number {
  const audible = opts.ctxTime - opts.clipStartAt - opts.outputLatencySec;
  return (audible * 1000) / (opts.playbackRate ?? 1) + (opts.userOffsetMs ?? 0);
}

/** Viseme timeline scaled for slowed playback (0.75× → times ×1/0.75). */
export function scaleTrackForRate<T extends { t: number }>(track: T[], rate: number): T[] {
  return track.map((e) => ({ ...e, t: e.t / rate }));
}

/** Pick the best available output latency figure (outputLatency is missing on older browsers). */
export function effectiveOutputLatency(ctx: { outputLatency?: number; baseLatency?: number }): number {
  return ctx.outputLatency ?? ctx.baseLatency ?? 0;
}
