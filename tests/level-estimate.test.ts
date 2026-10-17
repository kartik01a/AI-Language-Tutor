import { describe, expect, it } from "vitest";
import {
  bandOf, initialEstimate, isQualifyingSession, likelyRange, stepSize, updateEstimate, MAX_STEP,
} from "@/lib/learning/level-estimate";

const good = { learnerSpeechSeconds: 90, nonUnderstandingRate: 0.1 };

describe("level estimate", () => {
  it("starts mid-band at the self-selected level", () => {
    const e = initialEstimate("A2");
    expect(e.theta).toBe(2.5);
    expect(e.displayed).toBe("A2");
    expect(bandOf(1.99)).toBe("A1");
    expect(bandOf(2.0)).toBe("A2");
    expect(bandOf(3.99)).toBe("B1");
  });

  it("step size shrinks with sessions but never below 0.15", () => {
    expect(stepSize(0)).toBeCloseTo(0.667, 2);
    expect(stepSize(1)).toBeCloseTo(0.4, 2);
    expect(stepSize(100)).toBe(0.15);
  });

  it("caps per-session change at ±0.5", () => {
    const e = updateEstimate(initialEstimate("A2"), 6, good);
    expect(e.theta - 2.5).toBeLessThanOrEqual(MAX_STEP + 1e-9);
    const down = updateEstimate(initialEstimate("A2"), 0, good);
    expect(2.5 - down.theta).toBeLessThanOrEqual(MAX_STEP + 1e-9);
  });

  it("ignores non-qualifying sessions (too short or bad audio)", () => {
    const e = initialEstimate("A2");
    expect(updateEstimate(e, 5, { learnerSpeechSeconds: 30, nonUnderstandingRate: 0 })).toBe(e);
    expect(updateEstimate(e, 5, { learnerSpeechSeconds: 120, nonUnderstandingRate: 0.5 })).toBe(e);
    expect(isQualifyingSession(good)).toBe(true);
  });

  it("one great session does not change the displayed level (hysteresis)", () => {
    const e = updateEstimate(initialEstimate("A2"), 6, good);
    expect(e.displayed).toBe("A2");
  });

  it("two consecutive strong sessions beyond the boundary promote the level", () => {
    let e = initialEstimate("A2");
    for (let i = 0; i < 4; i++) e = updateEstimate(e, 5, good);
    expect(e.displayed).toBe("B1");
  });

  it("a single bad day cannot demote; a lapse resets the pending counter", () => {
    let e = initialEstimate("B1");
    e = updateEstimate(e, 1, good);
    expect(e.displayed).toBe("B1");
    e = updateEstimate(e, 4.5, good); // back in band
    expect(e.pendingCount).toBe(0);
  });

  it("reports a likely range from recent spread", () => {
    let e = initialEstimate("A2");
    e = updateEstimate(e, 3.2, good);
    e = updateEstimate(e, 4.6, good);
    const [lo, hi] = likelyRange(e);
    expect(["A1", "A2", "B1"]).toContain(lo);
    expect(["A2", "B1", "B2"]).toContain(hi);
  });
});
