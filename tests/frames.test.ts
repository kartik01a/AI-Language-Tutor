import { describe, expect, it } from "vitest";
import { encodeAudioFrame, encodeJsonFrame, FrameDecoder, FRAME_AUDIO, FRAME_JSON } from "@/lib/contracts/frames";

const stream = () => {
  const audio = new Uint8Array([1, 2, 3, 4, 5, 255]);
  const parts = [encodeJsonFrame({ t: "sentence", text: "こんにちは" }), encodeAudioFrame(audio), encodeJsonFrame({ t: "turn_end" })];
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  return { all, audio };
};

describe("frame codec", () => {
  it("round-trips JSON (incl. non-ASCII) and audio frames", () => {
    const { all, audio } = stream();
    const frames = new FrameDecoder().push(all);
    expect(frames).toHaveLength(3);
    expect(frames[0]).toEqual({ type: FRAME_JSON, json: { t: "sentence", text: "こんにちは" } });
    expect(frames[1].type).toBe(FRAME_AUDIO);
    expect([...(frames[1] as { bytes: Uint8Array }).bytes]).toEqual([...audio]);
  });

  it("reassembles frames from arbitrary chunk splits, byte by byte", () => {
    const { all } = stream();
    const d = new FrameDecoder();
    const got = [];
    for (const b of all) got.push(...d.push(new Uint8Array([b])));
    expect(got).toHaveLength(3);
    expect(d.pending).toBe(0);
  });

  it("reports truncation via pending bytes", () => {
    const { all } = stream();
    const d = new FrameDecoder();
    d.push(all.slice(0, all.length - 3));
    expect(d.pending).toBeGreaterThan(0);
  });

  it("rejects unknown types and oversized frames", () => {
    expect(() => new FrameDecoder().push(new Uint8Array([9, 0, 0, 0, 1, 0]))).toThrow(/Unknown frame type/);
    expect(() => new FrameDecoder().push(new Uint8Array([1, 0xff, 0xff, 0xff, 0xff]))).toThrow(/too large/);
  });
});
