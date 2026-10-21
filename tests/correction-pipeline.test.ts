import { describe, expect, it } from "vitest";
import { fastPathRecastAllowed, numberedTranscript, runCorrectionPipeline, spanConfidence, type PipelineInput } from "@/lib/tutor/correction-pipeline";
import { FakeLlm } from "@/lib/providers/fakes";
import type { SttWord } from "@/lib/providers/types";

const words = (pairs: [string, number | null][]): SttWord[] => pairs.map(([w, conf]) => ({ w, conf }));
// 昨日 公園 を 行きました — the particle を (index 2) is wrong; 行きました is index 3.
const SENT = words([["昨日", 0.97], ["公園", 0.96], ["を", 0.95], ["行きました", 0.97]]);

const particleEdit = { code: "ja.particle.destination", original: "を", corrected: "に", token_start: 2, token_end: 3, type: "grammar" as const };
const tenseEdit = { code: "ja.verb.tense", original: "行きます", corrected: "行きました", token_start: 3, token_end: 4, type: "grammar" as const };

const explain = (items: { edit_id: string; rule: string; example: string }[]) => ({ items });

/** Detection samples come first (k calls), then one explanation call. */
const scripted = (samples: unknown[], explanation: unknown = explain([{ edit_id: "e1", rule: "Use に after places you go to.", example: "学校に行きます。" }])) =>
  new FakeLlm((n) => (n < samples.length ? samples[n] : explanation));

const base = (over: Partial<PipelineInput> = {}): PipelineInput => ({
  words: SENT, lang: "ja", level: "A2", strictness: "balanced", riskSpans: [], ...over,
});
const same = (e: unknown, n = 3) => Array.from({ length: n }, () => ({ edits: [e] }));

describe("correction pipeline: detection, voting, gating", () => {
  it("Scenario B: a genuine error agreed by all samples becomes a card with an explanation", async () => {
    const llm = scripted(same(particleEdit));
    const r = await runCorrectionPipeline(llm, base());
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]).toMatchObject({ card: "fix", errorCode: "ja.particle.destination", original: "を", corrected: "に", tryAgainFirst: true, explanation: "Use に after places you go to." });
    expect(llm.calls).toHaveLength(4); // 3 detection + 1 explanation
    expect(r.usage).toHaveLength(4);
  });

  it("majority voting: 2 of 3 is enough, 1 of 3 is dropped", async () => {
    const two = await runCorrectionPipeline(scripted([{ edits: [particleEdit] }, { edits: [particleEdit] }, { edits: [] }]), base());
    expect(two.cards).toHaveLength(1);
    const one = await runCorrectionPipeline(scripted([{ edits: [particleEdit] }, { edits: [] }, { edits: [] }]), base());
    expect(one.cards).toHaveLength(0);
    expect(one.dropped.map((d) => d.reason)).toEqual(["votes"]);
  });

  it("Scenario F: never corrects a word the recogniser was unsure of, even when all samples agree", async () => {
    const llm = scripted(same(particleEdit));
    const r = await runCorrectionPipeline(llm, base({ words: words([["昨日", 0.97], ["公園", 0.96], ["を", 0.38], ["行きました", 0.97]]), riskSpans: [[2, 3]] }));
    expect(r.cards).toHaveLength(0);
    expect(r.dropped.map((d) => d.reason)).toEqual(["asr_risk"]);
    expect(llm.calls).toHaveLength(3); // no explanation call for nothing
  });

  it("also protects the neighbours of a risky word", async () => {
    const r = await runCorrectionPipeline(scripted(same(particleEdit)), base({ riskSpans: [[3, 4]] }));
    expect(r.cards).toHaveLength(0);
  });

  it("particles are ASR-fragile: need high, known confidence", async () => {
    const low = await runCorrectionPipeline(scripted(same(particleEdit)), base({ words: words([["昨日", 0.97], ["公園", 0.96], ["を", 0.8], ["行きました", 0.97]]) }));
    expect(low.dropped.map((d) => d.reason)).toEqual(["fragile_confidence"]);
    const unknown = await runCorrectionPipeline(scripted(same(particleEdit)), base({ words: words([["昨日", null], ["公園", null], ["を", null], ["行きました", null]]) }));
    expect(unknown.cards).toHaveLength(0);
  });

  it("a valid sentence yields nothing and costs only the detection calls", async () => {
    const llm = scripted(same({ edits: [] }).map(() => ({ edits: [] })).slice(0, 3));
    const r = await runCorrectionPipeline(llm, base());
    expect(r.cards).toEqual([]);
    expect(r.dropped).toEqual([]);
    expect(llm.calls).toHaveLength(3);
  });

  it("unknown error codes can't be gated, so they're dropped", async () => {
    const r = await runCorrectionPipeline(scripted(same({ ...particleEdit, code: "ja.made.up" })), base());
    expect(r.cards).toHaveLength(0);
    expect(r.dropped.map((d) => d.reason)).toEqual(["unknown_code"]);
  });

  it("without at least two valid samples it says nothing rather than guessing", async () => {
    const llm = new FakeLlm((n) => (n === 0 ? { edits: [particleEdit] } : new Error("timeout")));
    const r = await runCorrectionPipeline(llm, base());
    expect(r.cards).toHaveLength(0);
    expect(r.validSamples).toBe(1);
  });

  it("malformed samples are ignored, not counted against an edit", async () => {
    const r = await runCorrectionPipeline(scripted([{ edits: [particleEdit] }, { edits: [particleEdit] }, { garbage: true }]), base());
    expect(r.validSamples).toBe(2);
    expect(r.cards).toHaveLength(1);
  });

  it("categories with severity 0 at the learner's level are never corrected", async () => {
    const wa = { code: "ja.particle.wa_ga", original: "は", corrected: "が", token_start: 1, token_end: 2, type: "grammar" as const };
    const r = await runCorrectionPipeline(scripted(same(wa)), base({ level: "A1" }));
    expect(r.cards).toHaveLength(0);
    expect(r.dropped.map((d) => d.reason)).toEqual(["level"]);
  });

  it("strictness changes how many are shown, not the gates", async () => {
    const wordChoice = { code: "ja.vocab.word_choice", original: "強い", corrected: "濃い", token_start: 1, token_end: 2, type: "vocab" as const };
    const both = (n: number) => Array.from({ length: n }, () => ({ edits: [tenseEdit, wordChoice] }));
    const relaxed = await runCorrectionPipeline(scripted(both(3), explain([{ edit_id: "e1", rule: "r", example: "x" }])), base({ strictness: "relaxed", words: words([["昨日", 0.97], ["強い", 0.97], ["お茶", 0.97], ["行きます", 0.97]]) }));
    expect(relaxed.cards.map((c) => c.errorCode)).toEqual(["ja.verb.tense"]); // severity 3 only
    expect(relaxed.cards[0].tryAgainFirst).toBe(false); // Relaxed shows the answer immediately
    expect(relaxed.dropped.map((d) => d.reason)).toContain("strictness");
  });

  it("falls back to the taxonomy's own rule when the model's explanation is unusable", async () => {
    const tooLong = explain([{ edit_id: "e1", rule: "this explanation is far too long because it just keeps going on and on and on forever", example: "x" }]);
    const r = await runCorrectionPipeline(scripted(same(particleEdit), tooLong), base());
    expect(r.cards[0].explanation).toBe("Use に (or へ) after places you go to.");
    const failing = new FakeLlm((n) => (n < 3 ? { edits: [particleEdit] } : new Error("down")));
    const r2 = await runCorrectionPipeline(failing, base());
    expect(r2.cards[0].explanation).toBe("Use に (or へ) after places you go to.");
  });
});

describe("helpers", () => {
  it("numbers tokens with confidences for the prompt", () => {
    expect(numberedTranscript(words([["昨日", 0.97], ["を", null]]))).toBe("0:昨日(0.97) 1:を");
  });
  it("span confidence is the minimum, or unknown when any token is unknown", () => {
    expect(spanConfidence(SENT, [0, 3])).toBe(0.95);
    expect(spanConfidence(words([["a", 0.9], ["b", null]]), [0, 2])).toBeNull();
    expect(spanConfidence(SENT, [2, 2])).toBeNull();
  });
});

describe("fast-path spoken recast", () => {
  const heard = words([["昨日", 0.97], ["行きます", 0.96]]);
  const cand = { error_code: "ja.verb.tense", original: "行きます", corrected: "行きました" };
  const ctx = { words: heard, riskSpans: [] as [number, number][], level: "A2" as const, strictness: "balanced" as const };

  it("allows a confident, common, non-fragile category that matches what was heard", () => {
    expect(fastPathRecastAllowed(cand, ctx)).toBe(true);
  });
  it("rejects ASR-fragile categories (particles) — they need the full pipeline's evidence", () => {
    expect(fastPathRecastAllowed({ error_code: "ja.particle.destination", original: "を", corrected: "に" }, ctx)).toBe(false);
  });
  it("rejects unknown codes, a null candidate, and text that wasn't actually heard", () => {
    expect(fastPathRecastAllowed(null, ctx)).toBe(false);
    expect(fastPathRecastAllowed({ ...cand, error_code: "ja.nope" }, ctx)).toBe(false);
    expect(fastPathRecastAllowed({ ...cand, original: "食べます" }, ctx)).toBe(false);
  });
  it("rejects when the recast text overlaps a low-confidence word", () => {
    expect(fastPathRecastAllowed(cand, { ...ctx, riskSpans: [[1, 2]] })).toBe(false);
  });
  it("relaxed mode: only recurrent severity-3 errors on allowed turns", () => {
    const r = { ...ctx, strictness: "relaxed" as const };
    expect(fastPathRecastAllowed(cand, r)).toBe(false);
    expect(fastPathRecastAllowed(cand, { ...r, relaxedRecastTurn: true, recurrent: new Set(["ja.verb.tense"]) })).toBe(true);
  });
});
