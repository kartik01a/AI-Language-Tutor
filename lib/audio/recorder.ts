import { extensionFor, pickRecorderFormat } from "./formats";
import { analyseClip, type VadResult } from "./vad";

// Browser mic recorder (docs/05 §2). One MediaStream is reused for the whole session; the
// recorded blob is decoded afterwards for the speech check, so no AudioWorklet is needed.

export interface RecordedClip {
  blob: Blob;
  mime: string;
  ext: string;
  durationMs: number;
  vad: VadResult;
}

export type MicError = "denied" | "no_device" | "unsupported" | "in_use" | "unknown";

export function classifyMicError(e: unknown): MicError {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no_device";
  if (name === "NotReadableError" || name === "AbortError") return "in_use";
  if (name === "TypeError") return "unsupported";
  return "unknown";
}

export class Recorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private startedAt = 0;

  /** Call from a user gesture. Reuses the stream on later turns (avoids repeated prompts). */
  async open(): Promise<void> {
    if (this.stream?.active) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new TypeError("unsupported");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
  }

  get isOpen() {
    return !!this.stream?.active;
  }

  start(onLevel?: (rms: number) => void): void {
    if (!this.stream) throw new Error("Recorder not open");
    const fmt = pickRecorderFormat((m) => MediaRecorder.isTypeSupported(m));
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream, { ...(fmt.mime ? { mimeType: fmt.mime } : {}), audioBitsPerSecond: 32000 });
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.startedAt = performance.now();

    if (onLevel) {
      this.ctx = new AudioContext();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
      const buf = new Float32Array(this.analyser.fftSize);
      const tick = () => {
        this.analyser?.getFloatTimeDomainData(buf);
        let s = 0;
        for (const v of buf) s += v * v;
        onLevel(Math.sqrt(s / buf.length));
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    }
  }

  async stop(): Promise<RecordedClip> {
    const rec = this.rec;
    if (!rec) throw new Error("Not recording");
    const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
    rec.stop();
    await done;
    cancelAnimationFrame(this.raf);
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;

    const mime = rec.mimeType || this.chunks[0]?.type || "audio/webm";
    const blob = new Blob(this.chunks, { type: mime });
    const durationMs = performance.now() - this.startedAt;

    // Decode to PCM for the local speech check. If decoding fails, don't block the turn:
    // report "speech present" and let the server-side gates decide.
    let vad: VadResult;
    try {
      const decodeCtx = new AudioContext();
      const audio = await decodeCtx.decodeAudioData(await blob.arrayBuffer());
      vad = analyseClip(audio.getChannelData(0), { sampleRate: audio.sampleRate });
      await decodeCtx.close();
    } catch {
      vad = { clipMs: durationMs, speechMs: durationMs, rmsDb: NaN, tooQuiet: false, clipped: false, trim: [0, 0] };
    }
    return { blob, mime, ext: extensionFor(mime), durationMs, vad };
  }

  /** Release the mic (clears the browser's recording indicator). */
  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
