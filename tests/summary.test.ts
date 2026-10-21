import { describe, expect, it } from "vitest";
import { initialSkills, overallLevel, summariseSession, type SummaryInput } from "@/lib/learning/summary";
import { evidenceFor } from "@/lib/learning/evidence";
import { FakeLlm } from "@/lib/providers/fakes";
import type { CorrectionCard } from "@/lib/tutor/correction-pipeline";
import type { SessionMetrics } from "@/lib/session/store";

const card = (id: string, code = "ja.verb.tense"): CorrectionCard => ({
  id, card: "fix", errorCode: code, original: "行きます", corrected: "行きました", explanation: "r", example: "e", tryAgainFirst: true,
});
const metrics = (over: Partial<SessionMetrics> = {}): SessionMetrics => ({
  learnerSpeechMs: 120_000, learnerTurns: 8, unclearTurns: 0, providerErrors: 0, maxHintLevel: 0, hintsUsed: 0, wordsIntroduced: [], ...over,
});
const base = (llm: FakeLlm, over: Partial<SummaryInput> = {}): SummaryInput => ({
  llm, endReason: "time", learnerLines: ["昨日ラーメンを食べました", "友達と行きます"], cards: [card("c1"), card("c2")],
  reportedCardIds: new Set(), metrics: metrics(), skills: initialSkills("A2"), nonUnderstandingRate: 0, ...over,
});
const route = (verdicts: unknown, summary: unknown = { did_well: [], next_focus: "" }) =>
  new FakeLlm((_, req) => (req.system.startsWith("VERIFY") ? verdicts : summary));

describe("verification pass", () => {
  it("keeps agreed corrections as fixes and moves disagreed ones to 'worth a second look'", async () => {
    const { summary } = await summariseSession(base(route({ verdicts: [{ card_id: "c1", agree: true }, { card_id: "c2", agree: false }] })));
    expect(summary.fixes.map((c) => c.id)).toEqual(["c1"]);
    expect(summary.worthASecondLook.map((c) => c.id)).toEqual(["c2"]);
  });

  it("can only remove: a verdict for an unknown card adds nothing", async () => {
    const { summary } = await summariseSession(base(route({ verdicts: [{ card_id: "c1", agree: true }, { card_id: "ghost", agree: true }] })));
    expect(summary.fixes.map((c) => c.id)).toEqual(["c1"]);
    expect(summary.fixes.concat(summary.worthASecondLook).some((c) => c.id === "ghost")).toBe(false);
  });

  it("a missing verdict is not a confirmation", async () => {
    const { summary } = await summariseSession(base(route({ verdicts: [{ card_id: "c1", agree: true }] })));
    expect(summary.fixes.map((c) => c.id)).toEqual(["c1"]);
  });

  it("if the verifier fails or returns junk, nothing is presented as a confirmed fix", async () => {
    const down = new FakeLlm((_, req) => (req.system.startsWith("VERIFY") ? new Error("down") : { did_well: [], next_focus: "" }));
    expect((await summariseSession(base(down))).summary.fixes).toEqual([]);
    const junk = await summariseSession(base(route({ nope: 1 })));
    expect(junk.summary.fixes).toEqual([]);
    expect(junk.summary.worthASecondLook).toHaveLength(2);
  });

  it("corrections the learner reported as wrong disappear entirely", async () => {
    const { summary } = await summariseSession({
      ...base(route({ verdicts: [{ card_id: "c2", agree: true }] })),
      reportedCardIds: new Set(["c1"]),
    });
    expect(summary.fixes.map((c) => c.id)).toEqual(["c2"]);
    expect(summary.worthASecondLook).toEqual([]); // not even as a soft suggestion
  });

  it("reported cards are never even sent to the verifier", async () => {
    const llm = route({ verdicts: [] });
    await summariseSession({ ...base(llm), reportedCardIds: new Set(["c1", "c2"]) });
    expect(llm.calls.some((c) => c.system.startsWith("VERIFY"))).toBe(false);
  });

  it("makes no verification call when there are no corrections", async () => {
    const llm = route({ verdicts: [] });
    await summariseSession(base(llm, { cards: [] }));
    expect(llm.calls.some((c) => c.system.startsWith("VERIFY"))).toBe(false);
  });
});

describe("praise must quote the learner", () => {
  const praise = (items: { text: string; evidence: string }[]) => route({ verdicts: [] }, { did_well: items, next_focus: "Add a reason" });

  it("keeps items whose evidence appears in the learner's lines and drops invented ones", async () => {
    const { summary } = await summariseSession(base(praise([
      { text: "Great past tense", evidence: "ラーメンを食べました" },
      { text: "Wonderful use of keigo", evidence: "お召し上がりになりました" },
    ])));
    expect(summary.didWell.map((d) => d.evidence)).toEqual(["ラーメンを食べました"]);
    expect(summary.nextFocus).toBe("Add a reason");
  });

  it("caps praise at three items", async () => {
    const items = ["昨日", "ラーメン", "友達", "行きます"].map((e) => ({ text: `ok ${e}`, evidence: e }));
    expect((await summariseSession(base(praise(items)))).summary.didWell).toHaveLength(3);
  });

  it("with no learner speech there is nothing to praise (and no call)", async () => {
    const llm = praise([{ text: "x", evidence: "y" }]);
    const { summary } = await summariseSession(base(llm, { learnerLines: [], cards: [] }));
    expect(summary.didWell).toEqual([]);
    expect(llm.calls).toHaveLength(0);
  });
});

describe("level update", () => {
  it("a short conversation does not move the estimate and says why", async () => {
    const input = base(route({ verdicts: [] }), { metrics: metrics({ learnerSpeechMs: 20_000 }), cards: [] });
    const { summary } = await summariseSession(input);
    expect(summary.level).toMatchObject({ updated: false, changed: false });
    expect(summary.level.reason).toMatch(/too short/);
    expect(summary.skills.grammar.n).toBe(0);
  });

  it("a noisy session does not move the estimate either", async () => {
    const { summary } = await summariseSession(base(route({ verdicts: [] }), { cards: [], nonUnderstandingRate: 0.5 }));
    expect(summary.level.updated).toBe(false);
    expect(summary.level.reason).toMatch(/unclear/);
  });

  it("a qualifying session updates the skills but one session never changes the shown level", async () => {
    const { summary } = await summariseSession(base(route({ verdicts: [] }), { cards: [] }));
    expect(summary.level.updated).toBe(true);
    expect(summary.skills.grammar.n).toBe(1);
    expect(summary.level).toMatchObject({ before: "A2", after: "A2", changed: false });
  });

  it("the shown level is the weaker of grammar and comprehension", () => {
    const s = initialSkills("B1");
    s.comprehension = { ...s.comprehension, displayed: "A2" };
    expect(overallLevel(s)).toBe("A2");
  });

  it("disconnects produce a partial summary", async () => {
    expect((await summariseSession(base(route({ verdicts: [] }), { endReason: "disconnect", cards: [] }))).summary.status).toBe("partial");
  });
});

describe("evidence mapping is conservative", () => {
  const m = (o: Partial<SessionMetrics> = {}) => metrics(o);
  it("every adjustment is clamped so one session can't swing a skill", () => {
    for (const skill of ["grammar", "comprehension", "fluency"] as const) {
      const worst = evidenceFor(skill, 2.5, { metrics: m({ learnerTurns: 1, unclearTurns: 1, hintsUsed: 9, learnerSpeechMs: 100 }), verifiedCards: 20 });
      const best = evidenceFor(skill, 2.5, { metrics: m({ learnerTurns: 20, learnerSpeechMs: 900_000 }), verifiedCards: 0 });
      expect(worst).toBeGreaterThanOrEqual(2.5 - 0.5);
      expect(best).toBeLessThanOrEqual(2.5 + 0.4);
    }
  });
  it("vocabulary has no single-session signal, so x = θ", () => {
    expect(evidenceFor("vocabulary", 2.7, { metrics: m(), verifiedCards: 3 })).toBe(2.7);
  });
  it("fewer errors, fewer hints and longer answers all push upward", () => {
    expect(evidenceFor("grammar", 2.5, { metrics: m(), verifiedCards: 0 })).toBeGreaterThan(2.5);
    expect(evidenceFor("comprehension", 2.5, { metrics: m(), verifiedCards: 0 })).toBeGreaterThan(2.5);
    expect(evidenceFor("fluency", 2.5, { metrics: m({ learnerSpeechMs: 160_000 }), verifiedCards: 0 })).toBeGreaterThan(2.5);
  });
});

describe("verifier sees the whole sentence (found by the first real-provider run)", () => {
  it("gives the verifier the full sentence for every card, and the learner's level", async () => {
    const llm = route({ verdicts: [{ card_id: "c1", agree: true }, { card_id: "c2", agree: true }] });
    await summariseSession({
      ...base(llm),
      sentences: { c1: "昨日友達と公園を行きました", c2: "昨日ラーメンを食べます" },
      level: "A2",
    });
    const verify = llm.calls.find((c) => c.system.startsWith("VERIFY"));
    expect(verify?.user).toContain("Sentence: 昨日友達と公園を行きました");
    expect(verify?.user).toContain("Sentence: 昨日ラーメンを食べます");
    expect(verify?.user).toContain("Learner level: A2");
    expect(verify?.system).toMatch(/IN THE CONTEXT of that whole sentence/);
  });
});
