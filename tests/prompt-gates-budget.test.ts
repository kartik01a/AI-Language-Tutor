import { describe, expect, it } from "vitest";
import { buildStaticPrefix, buildTurnPrompt } from "@/lib/tutor/prompt";
import { annotateTranscript, applyGates, hasNonTargetTokens } from "@/lib/tutor/gates";
import { azureBillableChars, budgetStatus, llmCost, MemorySpendStore, monthKey, sttCost, ttsCost } from "@/lib/limits/budget";
import { yuki } from "@/lib/tutor/tutors";
import { stt } from "@/lib/providers/fakes";

const ctx = (over = {}) => {
  const asr = stt("公園 を 行きました", [0.97, 0.41, 0.95]);
  const gate = applyGates({ speechMs: 2000, clipMs: 3000 }, asr, { minSpeechMs: 400, allowedLangs: ["ja", "en"] });
  return {
    tutor: yuki, level: "A2" as const, strictness: "balanced" as const,
    learner: { firstName: "Priya", recurringMistakes: ["ja.particle.destination"] },
    session: { topic: "Weekend", goals: ["past tense"], simplifyMode: false, wrapUp: false, history: [{ role: "tutor" as const, text: "週末は何をしましたか？" }], currentQuestion: null },
    asr, gate, allowedActions: ["RESPOND"], ...over,
  };
};

describe("prompt", () => {
  it("static prefix is identical across turns (cacheable) and differs by level", () => {
    const a = buildTurnPrompt(ctx()).system;
    const b = buildTurnPrompt(ctx({ learner: { firstName: "Arjun", recurringMistakes: [] } })).system;
    expect(a).toBe(b);
    expect(a).toBe(buildStaticPrefix(yuki, "A2"));
    expect(buildStaticPrefix(yuki, "A1")).not.toBe(a);
  });

  it("the dynamic part carries confidences and risk positions, and no PII beyond the first name", () => {
    const { user, system } = buildTurnPrompt(ctx());
    expect(user).toContain("を(0.41)");
    expect(user).toContain("low-confidence word positions: 1");
    expect(user).toContain("Priya");
    expect(system).not.toContain("Priya");
    expect(user).not.toMatch(/@|email/i);
  });

  it("tells the model to wrap up without opening a new topic", () => {
    const c = ctx();
    c.session.wrapUp = true;
    expect(buildTurnPrompt(c).user).toContain("Do NOT ask a new question");
  });

  it("limits history to the last 8 turns and marks interrupted tutor text", () => {
    const c = ctx();
    c.session.history = Array.from({ length: 12 }, (_, i) => ({ role: "tutor" as const, text: `t${i}`, notHeard: i === 11 }));
    const { user } = buildTurnPrompt(c);
    expect(user).not.toContain("t3\n");
    expect(user).toContain("t11 [learner did not hear the rest");
  });
});

describe("gates", () => {
  const gate = (asr: ReturnType<typeof stt>, clip = { speechMs: 2000, clipMs: 3000 }) =>
    applyGates(clip, asr, { minSpeechMs: 400, allowedLangs: ["ja", "en", "hi"] });

  it("accepts confident speech", () => expect(gate(stt("私 は 学生 です", 0.95)).rejected).toBeNull());
  it("rejects too-short clips", () => expect(gate(stt("あ"), { speechMs: 200, clipMs: 3000 }).rejected).toBe("NO_SPEECH"));
  it("rejects unexpected languages and low language confidence", () => {
    expect(gate(stt("hola amigo", 0.95, "es")).reason).toBe("unexpected_language");
    expect(gate({ ...stt("私 は"), langConf: 0.2 }).reason).toBe("low_language_confidence");
  });
  it("groups adjacent low-confidence words into one risk span", () => {
    const g = gate(stt("a b c d e f", [0.95, 0.4, 0.3, 0.95, 0.95, 0.95]));
    expect(g.riskSpans).toEqual([[1, 3]]);
  });
  it("unknown confidence (provider has none) is not a rejection but is reported as unknown", () => {
    const g = gate(stt("私 は 学生 です", null));
    expect(g.rejected).toBeNull();
    expect(g.confidenceKnown).toBe(false);
  });
  it("annotates transcripts and detects non-target tokens", () => {
    expect(annotateTranscript(stt("あ い", [0.9, 0.5]))).toBe("あ(0.90) い(0.50)");
    expect(hasNonTargetTokens(stt("how do you say"), "ja")).toBe(true);
    expect(hasNonTargetTokens(stt("私 は 学生"), "ja")).toBe(false);
  });
});

describe("budget", () => {
  it("computes costs from the documented price table", () => {
    expect(sttCost("deepgram-nova-3", 90)).toBeCloseTo(0.0078, 4);
    expect(llmCost("gpt-6-luna", { inputTokens: 3000, cachedInputTokens: 2000, outputTokens: 250 })).toBeCloseTo((1000 * 0.1 + 2000 * 0.01 + 250 * 0.5) / 1e6, 8);
    expect(ttsCost("azure-standard", 2000)).toBeCloseTo(0.03, 4);
  });
  it("Azure bills kanji twice", () => expect(azureBillableChars("今日は")).toBe(5));
  it("kill switch statuses at 80% and 100%", async () => {
    const store = new MemorySpendStore();
    const now = new Date("2026-10-17T00:00:00Z");
    expect((await budgetStatus(store, 50, now)).status).toBe("ok");
    await store.add(monthKey(now), 40);
    expect((await budgetStatus(store, 50, now)).status).toBe("warn");
    await store.add(monthKey(now), 10);
    expect((await budgetStatus(store, 50, now)).status).toBe("exhausted");
  });
  it("spend resets each calendar month", async () => {
    const store = new MemorySpendStore();
    await store.add("2026-10", 60);
    expect((await budgetStatus(store, 50, new Date("2026-11-01T00:00:00Z"))).status).toBe("ok");
  });
});

describe("prompt: names and clarification rules", () => {
  it("tells the model to accept names and to ask one confirmation question only when genuinely unsure", () => {
    const sys = buildStaticPrefix(yuki, "A2");
    expect(sys).toMatch(/name, place or loanword/);
    expect(sys).toMatch(/NOT a reason to say partially_understood/);
    expect(sys).toMatch(/ONE short confirmation question that quotes what you heard/);
  });
});

describe("gates: the confirm tier (accented speech must not be rejected outright)", () => {
  const gate = (conf: number | number[]) =>
    applyGates({ speechMs: 2000, clipMs: 3000 }, stt("こんにちは カールテク です", conf), { minSpeechMs: 400, allowedLangs: ["ja", "en", "hi"] });

  it("confident → proceed", () => expect(gate(0.9).rejected).toBeNull());
  it("plausible but not trustworthy (the user's real 0.62 case) → ask 'Did you say …?'", () => {
    const g = gate(0.62);
    expect(g.rejected).toBe("CONFIRM_HEARD");
    expect(g.reason).toBe("confirm_heard");
  });
  it("hopelessly unsure → still just unclear", () => {
    expect(gate(0.3).rejected).toBe("UNCLEAR_AUDIO");
    expect(gate(0.3).reason).toBe("low_confidence");
  });
  it("the boundaries sit at 0.4 and 0.7", () => {
    expect(gate(0.41).rejected).toBe("CONFIRM_HEARD");
    expect(gate(0.39).rejected).toBe("UNCLEAR_AUDIO");
    expect(gate(0.71).rejected).toBeNull();
    expect(gate(0.69).rejected).toBe("CONFIRM_HEARD");
  });
  it("nothing to show (no letters) is never offered for confirmation", () => {
    const g = applyGates({ speechMs: 2000, clipMs: 3000 }, { text: "…", words: [{ w: "…", conf: 0.5 }], lang: "ja", langConf: null }, { minSpeechMs: 400, allowedLangs: ["ja"] });
    expect(g.rejected).toBe("UNCLEAR_AUDIO");
  });
});
