import { describe, expect, it } from "vitest";
import { createInitialState, DEFAULT_MACHINE_CONFIG, step } from "@/lib/tutor/dialogue-machine";
import { processLearnerTurn, type TurnDeps, type TurnInput } from "@/lib/tutor/turn-pipeline";
import { FakeLlm, FakeStt, stt } from "@/lib/providers/fakes";
import { yuki } from "@/lib/tutor/tutors";
import type { TurnOutput } from "@/lib/tutor/schemas";

const inConversation = () => {
  let s = createInitialState();
  s = step(s, { type: "greeting_sent" }).state;
  s = step(s, { type: "topic_chip", label: "Food" }).state;
  return s;
};

const llmOut = (over: Partial<TurnOutput["analysis"]> = {}, sentences = ["いいですね！", "何が好きですか？"]): TurnOutput => ({
  analysis: { category: "understood", meaning_summary: "likes ramen", recovered_fragment: null, off_topic_reason: null, meta: { kind: null, word: null }, goal_progress: [], recast_candidate: null, ...over },
  reply: { recast: null, sentences, translation: [], teach_phrase: null },
  hints: { hint: "h", starter: "s", example: "e", example_translation: "t" },
  words_introduced: [],
});

const base = (state = inConversation()): TurnInput => ({
  state,
  audio: new Uint8Array(10),
  mime: "audio/webm",
  clip: { speechMs: 3000, clipMs: 4000 },
  target: "ja",
  prompt: {
    tutor: yuki, level: "A2", strictness: "balanced",
    learner: { firstName: "Priya", recurringMistakes: [] },
    session: { topic: "Food", goals: [], simplifyMode: false, wrapUp: false, history: [], currentQuestion: { text: "何が好きですか？", expects: "open" } },
  },
});

const deps = (s: FakeStt, l: FakeLlm): TurnDeps => ({ stt: s, llm: l, machine: DEFAULT_MACHINE_CONFIG, minSpeechMs: 400 });

describe("turn pipeline", () => {
  it("happy path: understood turn gets a validated LLM reply", async () => {
    const s = new FakeStt([stt("ラーメン が 好き です")]);
    const l = new FakeLlm([llmOut()]);
    const r = await processLearnerTurn(deps(s, l), base());
    expect(r.category).toBe("UNDERSTOOD");
    expect(r.action).toEqual({ kind: "RESPOND", allowCorrections: true });
    expect(r.replySentences).toEqual(["いいですね！", "何が好きですか？"]);
    expect(r.replyIssues).toEqual([]);
    expect(r.usage).toHaveLength(1);
  });

  it("silence never reaches STT or the LLM (no cost)", async () => {
    const s = new FakeStt([stt("x")]);
    const l = new FakeLlm([llmOut()]);
    const r = await processLearnerTurn(deps(s, l), { ...base(), clip: { speechMs: 100, clipMs: 3000 } });
    expect(r.category).toBe("NO_SPEECH");
    expect(r.action).toEqual({ kind: "CLARIFY", variant: "rephrase" });
    expect(s.calls).toBe(0);
    expect(l.calls).toHaveLength(0);
  });

  it("phantom transcript is treated as no speech (never acted on)", async () => {
    const r = await processLearnerTurn(deps(new FakeStt([stt("ご視聴ありがとうございました")]), new FakeLlm([llmOut()])), base());
    expect(r.category).toBe("NO_SPEECH");
    expect(r.gateReason).toBe("phantom_or_empty");
  });

  it("Scenario C: low recognition confidence → clarify, LLM is never asked to interpret", async () => {
    const l = new FakeLlm([llmOut()]);
    const r = await processLearnerTurn(deps(new FakeStt([stt("すきな しく", [0.4, 0.3])]), l), base());
    expect(r.category).toBe("UNCLEAR_AUDIO");
    expect(r.action.kind).toBe("CLARIFY");
    expect(l.calls).toHaveLength(0);
    expect(r.analysis).toBeNull();
  });

  it("Scenario D: second unclear turn moves on with a suggestion", async () => {
    const s = new FakeStt([stt("すきな しく", [0.4, 0.3])]);
    const d = deps(s, new FakeLlm([llmOut()]));
    const first = await processLearnerTurn(d, base());
    const second = await processLearnerTurn(d, { ...base(first.state) });
    expect(second.action.kind).toBe("SUGGEST_AND_MOVE_ON");
  });

  it("Scenario F: low-confidence words are flagged to the LLM as possible mishearing", async () => {
    const s = new FakeStt([stt("プネ で 住んで います", [0.97, 0.38, 0.96, 0.95])]);
    const l = new FakeLlm([llmOut()]);
    const r = await processLearnerTurn(deps(s, l), base());
    expect(r.gate?.riskSpans).toEqual([[1, 2]]);
    expect(l.calls[0].user).toContain("で(0.38)");
    expect(l.calls[0].user).toContain("low-confidence word positions: 1");
  });

  it("Scenario G: STT failure is a provider error, not an unclear turn", async () => {
    const r = await processLearnerTurn(deps(new FakeStt([new Error("503")]), new FakeLlm([llmOut()])), base());
    expect(r.category).toBe("PROVIDER_ERROR");
    expect(r.action.kind).toBe("PROVIDER_ERROR_LINE");
    expect(r.state.unclearCount).toBe(0);
  });

  it("LLM failure is a provider error too", async () => {
    const r = await processLearnerTurn(deps(new FakeStt([stt("私 は 学生 です")]), new FakeLlm([new Error("timeout")])), base());
    expect(r.category).toBe("PROVIDER_ERROR");
  });

  it("repairs invalid JSON once, then succeeds", async () => {
    const l = new FakeLlm([{ nonsense: true }, llmOut()]);
    const r = await processLearnerTurn(deps(new FakeStt([stt("私 は 学生 です")]), l), base());
    expect(r.category).toBe("UNDERSTOOD");
    expect(r.usage).toHaveLength(2);
  });

  it("gives up after two invalid outputs", async () => {
    const r = await processLearnerTurn(deps(new FakeStt([stt("私 は 学生 です")]), new FakeLlm([{ bad: 1 }])), base());
    expect(r.category).toBe("PROVIDER_ERROR");
  });

  it("borderline confidence downgrades the model's 'understood' claim", async () => {
    const r = await processLearnerTurn(deps(new FakeStt([stt("私 は 学生 です", 0.72)]), new FakeLlm([llmOut()])), base());
    expect(r.gate?.borderline).toBe(true);
    expect(r.category).toBe("AMBIGUOUS");
    expect(r.action.kind).toBe("CLARIFY");
  });

  it("English help request is routed as help, not an error", async () => {
    const out = llmOut({ category: "native_language_help" });
    out.reply.teach_phrase = { text: "ソフトウェアエンジニア", translation: "software engineer" };
    const r = await processLearnerTurn(deps(new FakeStt([stt("私 は how do you say engineer", 0.95, "ja")]), new FakeLlm([out])), base());
    expect(r.category).toBe("L1_HELP_REQUEST");
    expect(r.action).toEqual({ kind: "TEACH_PHRASE", phrase: "ソフトウェアエンジニア" });
  });

  it("'native language help' claimed with no English present is downgraded", async () => {
    const r = await processLearnerTurn(deps(new FakeStt([stt("私 は 学生 です")]), new FakeLlm([llmOut({ category: "native_language_help" })])), base());
    expect(r.category).toBe("UNCLEAR_AUDIO");
  });

  it("flags reply issues (too many questions) so the caller can regenerate", async () => {
    const l = new FakeLlm([llmOut({}, ["何が好きですか？", "なぜですか？"])]);
    const r = await processLearnerTurn(deps(new FakeStt([stt("私 は 学生 です")]), l), base());
    expect(r.replyIssues).toContain("question_count");
  });

  it("template actions never carry LLM reply text", async () => {
    const r = await processLearnerTurn(deps(new FakeStt([stt("すきな しく", [0.4, 0.3])]), new FakeLlm([llmOut()])), base());
    expect(r.replySentences).toBeNull();
  });
});
