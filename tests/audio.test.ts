import { describe, expect, it } from "vitest";
import { analyseClip } from "@/lib/audio/vad";
import { extensionFor, pickRecorderFormat } from "@/lib/audio/formats";
import { effectiveOutputLatency, lipSyncElapsedMs, planClip, scaleTrackForRate } from "@/lib/audio/schedule";

const SR = 16000;
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5) * 2;

/** Build a clip from segments: [ms, kind, amplitude]. */
function clip(segments: [number, "silence" | "noise" | "speech", number][], seed = 1): Float32Array {
  const r = rng(seed);
  const total = segments.reduce((n, [ms]) => n + Math.round((ms / 1000) * SR), 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const [ms, kind, amp] of segments) {
    const n = Math.round((ms / 1000) * SR);
    for (let i = 0; i < n; i++, o++) {
      if (kind === "silence") out[o] = 0;
      else if (kind === "noise") out[o] = r() * amp;
      else out[o] = amp * Math.sin((2 * Math.PI * 220 * o) / SR) * (0.7 + 0.3 * Math.sin((2 * Math.PI * 4 * o) / SR)) + r() * 0.004;
    }
  }
  return out;
}

describe("energy VAD", () => {
  it("digital silence → no speech, so no upload", () => {
    const r = analyseClip(clip([[2000, "silence", 0]]), { sampleRate: SR });
    expect(r.speechMs).toBe(0);
    expect(r.trim).toBeNull();
    expect(r.tooQuiet).toBe(true);
  });

  it("room noise only → no speech", () => {
    const r = analyseClip(clip([[2500, "noise", 0.01]]), { sampleRate: SR });
    expect(r.speechMs).toBe(0);
    expect(r.trim).toBeNull();
  });

  it("detects speech and trims leading/trailing silence with padding", () => {
    const r = analyseClip(clip([[800, "noise", 0.005], [1500, "speech", 0.3], [900, "noise", 0.005]]), { sampleRate: SR });
    expect(r.speechMs).toBeGreaterThan(1300);
    expect(r.speechMs).toBeLessThan(1700);
    expect(r.trim).not.toBeNull();
    const [a, b] = r.trim as [number, number];
    expect((a / SR) * 1000).toBeGreaterThan(500); // leading silence removed (800ms − pad)
    expect((a / SR) * 1000).toBeLessThan(800);
    expect((b / SR) * 1000).toBeGreaterThan(2300); // speech ends at 2300ms
    expect((b / SR) * 1000).toBeLessThan(2700);
    expect(r.tooQuiet).toBe(false);
    expect(r.rmsDb).toBeGreaterThan(-25);
  });

  it("speech starting immediately still works (calibration uses the quietest early frame)", () => {
    const r = analyseClip(clip([[100, "noise", 0.004], [1500, "speech", 0.25]]), { sampleRate: SR });
    expect(r.speechMs).toBeGreaterThan(1200);
  });

  it("a short blip is reported as short speech so the caller can reject it (< MIN_SPEECH_MS)", () => {
    const r = analyseClip(clip([[1000, "noise", 0.004], [140, "speech", 0.3], [1000, "noise", 0.004]]), { sampleRate: SR });
    expect(r.speechMs).toBeLessThan(400);
  });

  it("constant loud background noise (fan, traffic) is not mistaken for speech", () => {
    const r = analyseClip(clip([[3000, "noise", 0.08]]), { sampleRate: SR });
    expect(r.speechMs).toBe(0);
  });

  it("very quiet speech is flagged as too quiet", () => {
    const r = analyseClip(clip([[300, "noise", 0.0005], [1500, "speech", 0.02]]), { sampleRate: SR });
    expect(r.speechMs).toBeGreaterThan(0);
    expect(r.tooQuiet).toBe(true);
  });

  it("flags clipping", () => {
    const s = clip([[300, "silence", 0], [1000, "speech", 0.3]]);
    s[6000] = 1;
    expect(analyseClip(s, { sampleRate: SR }).clipped).toBe(true);
  });

  it("empty input is safe", () => {
    expect(analyseClip(new Float32Array(0), { sampleRate: SR }).trim).toBeNull();
  });
});

describe("recorder formats", () => {
  it("prefers WebM/Opus, then MP4 (older iOS), then lets the browser choose", () => {
    expect(pickRecorderFormat(() => true)).toEqual({ mime: "audio/webm;codecs=opus", ext: "webm" });
    expect(pickRecorderFormat((m) => m === "audio/mp4")).toEqual({ mime: "audio/mp4", ext: "m4a" });
    expect(pickRecorderFormat(() => false)).toEqual({ mime: undefined, ext: "webm" });
  });
  it("maps blob MIME types to upload extensions", () => {
    expect(extensionFor("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionFor("audio/mp4;codecs=mp4a.40.2")).toBe("m4a");
    expect(extensionFor("audio/ogg")).toBe("ogg");
  });
});

describe("gapless scheduling", () => {
  it("first clip starts just after now", () => {
    const c = planClip({ now: 10, prevEndAt: null, durationSec: 1.5, index: 0 });
    expect(c.startAt).toBeCloseTo(10.03);
    expect(c.endAt).toBeCloseTo(11.53);
  });
  it("next clip starts exactly when the previous ends", () => {
    const a = planClip({ now: 10, prevEndAt: null, durationSec: 1.5, index: 0 });
    const b = planClip({ now: 10.5, prevEndAt: a.endAt, durationSec: 2, index: 1 });
    expect(b.startAt).toBe(a.endAt);
  });
  it("a late sentence never schedules in the past", () => {
    const a = planClip({ now: 10, prevEndAt: null, durationSec: 1, index: 0 });
    const late = planClip({ now: 15, prevEndAt: a.endAt, durationSec: 1, index: 1 });
    expect(late.startAt).toBeGreaterThanOrEqual(15);
  });
});

describe("lip-sync clock", () => {
  it("subtracts output latency so the mouth matches what is audible", () => {
    expect(lipSyncElapsedMs({ ctxTime: 11, clipStartAt: 10, outputLatencySec: 0.2 })).toBeCloseTo(800);
  });
  it("applies the user offset and slowed playback", () => {
    expect(lipSyncElapsedMs({ ctxTime: 11, clipStartAt: 10, outputLatencySec: 0, userOffsetMs: 50, playbackRate: 0.75 })).toBeCloseTo(1000 / 0.75 + 50);
  });
  it("scales viseme tracks for slow playback", () => {
    expect(scaleTrackForRate([{ t: 0 }, { t: 300 }], 0.75)).toEqual([{ t: 0 }, { t: 400 }]);
  });
  it("falls back from outputLatency to baseLatency to 0", () => {
    expect(effectiveOutputLatency({ outputLatency: 0.1, baseLatency: 0.01 })).toBe(0.1);
    expect(effectiveOutputLatency({ baseLatency: 0.01 })).toBe(0.01);
    expect(effectiveOutputLatency({})).toBe(0);
  });
});

import { makeToneWav } from "@/lib/audio/tone";
import { classifyMicError } from "@/lib/audio/recorder";

describe("tone WAV", () => {
  it("produces a valid 16-bit mono PCM WAV of the requested length", () => {
    const wav = makeToneWav(440, 500, 22050);
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
    expect(v.getUint32(24, true)).toBe(22050);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true) / 2).toBe(Math.round(0.5 * 22050));
    expect(wav.length).toBe(44 + v.getUint32(40, true));
  });
  it("fades in and out (no clicks)", () => {
    const wav = makeToneWav(440, 300);
    const v = new DataView(wav.buffer);
    expect(Math.abs(v.getInt16(44, true))).toBeLessThan(200);
    expect(Math.abs(v.getInt16(wav.length - 2, true))).toBeLessThan(200);
  });
});

describe("mic error classification", () => {
  it.each([
    ["NotAllowedError", "denied"], ["SecurityError", "denied"], ["NotFoundError", "no_device"],
    ["NotReadableError", "in_use"], ["TypeError", "unsupported"], ["Weird", "unknown"],
  ])("%s → %s", (name, expected) => expect(classifyMicError({ name })).toBe(expected));
});
