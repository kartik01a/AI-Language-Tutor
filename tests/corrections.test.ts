import { describe, expect, it } from "vitest";
import { gateCorrections, type EditCandidate, type GateContext } from "@/lib/tutor/corrections";

const edit = (over: Partial<EditCandidate> = {}): EditCandidate => ({
  id: "e1",
  code: "ja.particle.destination",
  original: "公園を行きました",
  corrected: "公園に行きました",
  span: [3, 4],
  type: "grammar",
  severity: 3,
  votes: 3,
  samples: 3,
  asrFragile: false,
  validVariety: false,
  fastPathRecast: true,
  minLevel: "A1",
  spanConfidence: 0.97,
  ...over,
});

const ctx = (over: Partial<GateContext> = {}): GateContext => ({
  understood: true,
  asrRiskSpans: [],
  strictness: "balanced",
  level: "A2",
  ...over,
});

const reasons = (r: ReturnType<typeof gateCorrections>) => r.dropped.map((d) => d.reason);

describe("precision gates (identical at every strictness)", () => {
  it("keeps a clear genuine error (Scenario B)", () => {
    const r = gateCorrections([edit()], ctx());
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].card).toBe("fix");
    expect(r.recast?.id).toBe("e1");
  });

  it("drops everything unless the turn was understood", () => {
    const r = gateCorrections([edit()], ctx({ understood: false }));
    expect(r.cards).toHaveLength(0);
    expect(r.recast).toBeNull();
    expect(reasons(r)).toEqual(["category"]);
  });

  it("NEVER corrects inside an ASR-risk span, or next to one (Scenario F)", () => {
    for (const strictness of ["relaxed", "balanced", "strict"] as const) {
      const inside = gateCorrections([edit({ span: [3, 4] })], ctx({ strictness, asrRiskSpans: [[3, 4]] }));
      const adjacent = gateCorrections([edit({ span: [3, 4] })], ctx({ strictness, asrRiskSpans: [[4, 5]] }));
      for (const r of [inside, adjacent]) {
        expect(r.cards).toHaveLength(0);
        expect(r.recast).toBeNull();
        expect(reasons(r)).toEqual(["asr_risk"]);
      }
    }
  });

  it("does not drop edits far from a risk span", () => {
    const r = gateCorrections([edit({ span: [0, 1] })], ctx({ asrRiskSpans: [[6, 7]] }));
    expect(r.cards).toHaveLength(1);
  });

  it("requires majority agreement across samples", () => {
    const r = gateCorrections([edit({ votes: 1 })], ctx({ strictness: "strict" }));
    expect(r.cards).toHaveLength(0);
    expect(reasons(r)).toEqual(["votes"]);
  });

  it("never flags valid variety (e.g. Indian English) — even in Strict", () => {
    const r = gateCorrections(
      [edit({ code: "en.stative_progressive", validVariety: true })],
      ctx({ strictness: "strict", level: "B1" }),
    );
    expect(r.cards).toHaveLength(0);
    expect(reasons(r)).toEqual(["variety"]);
  });

  it("accepts register-legitimate forms", () => {
    const r = gateCorrections([edit({ registerLegitimate: true })], ctx());
    expect(reasons(r)).toEqual(["register"]);
  });

  it("does not correct structures above the learner's level", () => {
    const r = gateCorrections([edit({ minLevel: "B1" })], ctx({ level: "A2" }));
    expect(reasons(r)).toEqual(["level"]);
  });

  it("ASR-fragile categories need high, known confidence", () => {
    const low = gateCorrections([edit({ asrFragile: true, spanConfidence: 0.7 })], ctx());
    const unknown = gateCorrections([edit({ asrFragile: true, spanConfidence: null })], ctx());
    const high = gateCorrections([edit({ asrFragile: true, spanConfidence: 0.95 })], ctx());
    expect(reasons(low)).toEqual(["fragile_confidence"]);
    expect(reasons(unknown)).toEqual(["fragile_confidence"]);
    expect(high.cards).toHaveLength(1);
  });
});

describe("strictness only changes how many are shown", () => {
  const many = [
    edit({ id: "a", severity: 3, span: [0, 1] }),
    edit({ id: "b", severity: 2, span: [2, 3] }),
    edit({ id: "c", severity: 1, span: [4, 5] }),
  ];

  it("relaxed: severity 3 only, max 1 card", () => {
    const r = gateCorrections(many, ctx({ strictness: "relaxed" }));
    expect(r.cards.map((c) => c.id)).toEqual(["a"]);
  });

  it("balanced: severity ≥ 2, max 2 cards", () => {
    const r = gateCorrections(many, ctx({ strictness: "balanced" }));
    expect(r.cards.map((c) => c.id)).toEqual(["a", "b"]);
    expect(r.dropped.find((d) => d.edit.id === "c")?.reason).toBe("strictness");
  });

  it("strict: includes minor errors", () => {
    const r = gateCorrections(many, ctx({ strictness: "strict" }));
    expect(r.cards.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("caps cards and reports the overflow", () => {
    const four = [1, 2, 3, 4].map((n) => edit({ id: `x${n}`, severity: 3, span: [n * 2, n * 2 + 1] }));
    const r = gateCorrections(four, ctx({ strictness: "balanced" }));
    expect(r.cards).toHaveLength(2);
    expect(reasons(r).filter((x) => x === "cap")).toHaveLength(2);
  });

  it("style suggestions appear only in Strict, as optional 'alternative' cards", () => {
    const style = edit({ id: "s", type: "style", severity: 1 });
    expect(gateCorrections([style], ctx({ strictness: "balanced" })).cards).toHaveLength(0);
    const strict = gateCorrections([style], ctx({ strictness: "strict" }));
    expect(strict.cards[0].card).toBe("alternative");
    expect(strict.recast).toBeNull(); // never recast a style suggestion
  });
});

describe("spoken recast", () => {
  it("at most one, highest priority, fast-path only", () => {
    const r = gateCorrections(
      [
        edit({ id: "slow", severity: 3, fastPathRecast: false, span: [0, 1] }),
        edit({ id: "fast", severity: 2, span: [2, 3] }),
      ],
      ctx(),
    );
    expect(r.recast?.id).toBe("fast");
  });

  it("relaxed recasts only recurrent severity-3 errors, and only on allowed turns", () => {
    const recurrent = edit({ recurrent: true });
    expect(gateCorrections([recurrent], ctx({ strictness: "relaxed", relaxedRecastTurn: false })).recast).toBeNull();
    expect(gateCorrections([recurrent], ctx({ strictness: "relaxed", relaxedRecastTurn: true })).recast?.id).toBe("e1");
    expect(gateCorrections([edit()], ctx({ strictness: "relaxed", relaxedRecastTurn: true })).recast).toBeNull();
  });
});
