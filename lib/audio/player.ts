import { effectiveOutputLatency, lipSyncElapsedMs, planClip, type ScheduledClip } from "./schedule";

// Gapless per-sentence playback on one shared AudioContext (docs/05 §4.2).

export interface QueuedClip extends ScheduledClip {
  buffer: AudioBuffer;
  source: AudioBufferSourceNode;
}

export class Player {
  readonly ctx: AudioContext;
  private clips: QueuedClip[] = [];
  private decoded: AudioBuffer[] = []; // cached for Replay (no network, no TTS cost)
  private prevEndAt: number | null = null;
  userOffsetMs = 0;
  onAllEnded?: () => void;

  constructor(ctx?: AudioContext) {
    this.ctx = ctx ?? new AudioContext();
  }

  /** Must run inside a user gesture (the tap-to-talk press). iOS keeps the context suspended until then. */
  async unlock(): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.ctx.destination);
    s.start();
  }

  /** Decode one sentence of audio and schedule it right after the previous one. */
  async enqueue(bytes: ArrayBuffer): Promise<QueuedClip> {
    const buffer = await this.ctx.decodeAudioData(bytes.slice(0));
    this.decoded.push(buffer);
    return this.schedule(buffer);
  }

  private schedule(buffer: AudioBuffer): QueuedClip {
    const plan = planClip({ now: this.ctx.currentTime, prevEndAt: this.prevEndAt, durationSec: buffer.duration, index: this.clips.length });
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    source.start(plan.startAt);
    this.prevEndAt = plan.endAt;
    const clip: QueuedClip = { ...plan, buffer, source };
    source.onended = () => {
      if (this.clips.every((c) => c.endAt <= this.ctx.currentTime + 0.05)) this.onAllEnded?.();
    };
    this.clips.push(clip);
    return clip;
  }

  /** Stop everything immediately (interrupt, D-25). Returns ms of the current clip that were heard. */
  stopAll(): { playedMs: number } {
    const now = this.ctx.currentTime;
    const current = this.clips.find((c) => c.startAt <= now && now < c.endAt);
    const playedMs = current ? Math.max(0, (now - current.startAt - effectiveOutputLatency(this.ctx)) * 1000) : 0;
    for (const c of this.clips) {
      try {
        c.source.onended = null;
        c.source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.clips = [];
    this.prevEndAt = null;
    return { playedMs };
  }

  /** Re-play the whole last message from cache. */
  replay(): void {
    this.stopAll();
    for (const b of this.decoded) this.schedule(b);
  }

  /** Start a fresh message: forget cached sentences from the previous one. */
  beginMessage(): void {
    this.stopAll();
    this.decoded = [];
  }

  /** Elapsed audible ms of the clip currently playing (drives the avatar's viseme track). */
  lipSyncClock(clipIndex: number): number {
    const c = this.clips[clipIndex];
    if (!c) return 0;
    return lipSyncElapsedMs({
      ctxTime: this.ctx.currentTime,
      clipStartAt: c.startAt,
      outputLatencySec: effectiveOutputLatency(this.ctx),
      userOffsetMs: this.userOffsetMs,
    });
  }

  get queued(): readonly QueuedClip[] {
    return this.clips;
  }
}

/** "Slow" replay: <audio> element with pitch preserved (Web Audio playbackRate shifts pitch). */
export async function playSlow(mp3Parts: Uint8Array[], rate = 0.75): Promise<HTMLAudioElement> {
  const blob = new Blob(mp3Parts as BlobPart[], { type: "audio/mpeg" });
  const el = new Audio(URL.createObjectURL(blob));
  el.playbackRate = rate;
  el.preservesPitch = true;
  (el as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
  el.onended = () => URL.revokeObjectURL(el.src);
  await el.play();
  return el;
}
