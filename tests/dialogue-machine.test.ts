import { describe, expect, it } from "vitest";
import { createInitialState, DEFAULT_MACHINE_CONFIG, step } from "@/lib/tutor/dialogue-machine";
import type { DialogueEvent, DialogueState, MachineConfig } from "@/lib/tutor/types";

function run(events: DialogueEvent[], cfg: MachineConfig = DEFAULT_MACHINE_CONFIG, from?: DialogueState) {
  let state = from ?? createInitialState();
  const results = events.map((e) => {
    const r = step(state, e, cfg);
    state = r.state;
    return r;
  });
  return { state, results, last: results[results.length - 1] };
}

const started: DialogueEvent[] = [{ type: "greeting_sent" }, { type: "topic_chip", label: "Food" }];
const turn = (category: Extract<DialogueEvent, { type: "learner_turn" }>["category"], extra = {}): DialogueEvent => ({
  type: "learner_turn",
  category,
  ...extra,
});

describe("session start", () => {
  it("moves INIT → TOPIC_SELECTION → CONVERSATION", () => {
    const a = run([{ type: "greeting_sent" }]);
    expect(a.state.phase).toBe("TOPIC_SELECTION");
    const b = run([...started]);
    expect(b.state.phase).toBe("CONVERSATION");
    expect(b.state.topic).toEqual({ label: "Food", source: "chip" });
  });

  it("an understood spoken topic starts the conversation without corrections", () => {
    const r = run([
      { type: "greeting_sent" },
      turn("UNDERSTOOD", { topic: { label: "Travel", source: "spoken" } }),
    ]);
    expect(r.state.phase).toBe("CONVERSATION");
    expect(r.last.action).toEqual({ kind: "RESPOND", allowCorrections: false });
  });
});

describe("unclear speech (Scenarios C, D)", () => {
  it("default: one CLARIFY, then SUGGEST_AND_MOVE_ON — never a dead end", () => {
    const r = run([...started, turn("UNCLEAR_AUDIO"), turn("UNCLEAR_AUDIO")]);
    expect(r.results[2].action).toEqual({ kind: "CLARIFY", variant: "rephrase" });
    expect(r.last.action).toEqual({ kind: "SUGGEST_AND_MOVE_ON", flagForReview: true });
    expect(r.state.unclearCount).toBe(0);
  });

  it("with 2 retries the second clarification is the simplified question", () => {
    const cfg = { ...DEFAULT_MACHINE_CONFIG, unclearMaxRetries: 2 };
    const r = run([...started, turn("NO_SPEECH"), turn("AMBIGUOUS"), turn("UNCLEAR_AUDIO")], cfg);
    expect(r.results[2].action).toEqual({ kind: "CLARIFY", variant: "rephrase" });
    expect(r.results[3].action).toEqual({ kind: "CLARIFY", variant: "simplify" });
    expect(r.last.action.kind).toBe("SUGGEST_AND_MOVE_ON");
  });

  it("learner is never stuck beyond the retry limit, for any limit", () => {
    for (const max of [0, 1, 2, 3]) {
      const cfg = { ...DEFAULT_MACHINE_CONFIG, unclearMaxRetries: max };
      const r = run([...started, ...Array(max + 1).fill(turn("UNCLEAR_AUDIO"))], cfg);
      expect(r.last.action.kind).toBe("SUGGEST_AND_MOVE_ON");
    }
  });

  it("an understood turn resets the unclear counter", () => {
    const r = run([...started, turn("UNCLEAR_AUDIO"), turn("UNDERSTOOD"), turn("UNCLEAR_AUDIO")]);
    expect(r.last.action).toEqual({ kind: "CLARIFY", variant: "rephrase" });
  });

  it("unclear while choosing a topic falls back to a surprise topic", () => {
    const r = run([{ type: "greeting_sent" }, turn("UNCLEAR_AUDIO"), turn("UNCLEAR_AUDIO")]);
    expect(r.last.action.kind).toBe("SURPRISE_TOPIC");
    expect(r.state.phase).toBe("CONVERSATION");
    expect(r.state.topic?.source).toBe("surprise");
  });
});

describe("hint ladder (Scenario A)", () => {
  it("escalates 1 → 2 → 3, then models the answer and moves on", () => {
    const r = run([
      ...started,
      { type: "silence_timeout" },
      turn("DONT_KNOW"),
      { type: "hint_request" },
      turn("DONT_KNOW"),
    ]);
    expect(r.results.slice(2).map((x) => x.action)).toEqual([
      { kind: "HINT", level: 1, source: "silence" },
      { kind: "HINT", level: 2, source: "dont_know" },
      { kind: "HINT", level: 3, source: "button" },
      { kind: "MODEL_ANSWER_AND_MOVE_ON" },
    ]);
    expect(r.state.hintLevel).toBe(0);
  });

  it("resets after the learner answers", () => {
    const r = run([...started, { type: "hint_request" }, turn("UNDERSTOOD"), { type: "hint_request" }]);
    expect(r.last.action).toEqual({ kind: "HINT", level: 1, source: "button" });
  });
});

describe("other categories", () => {
  it("understood turn allows corrections", () => {
    expect(run([...started, turn("UNDERSTOOD")]).last.action).toEqual({ kind: "RESPOND", allowCorrections: true });
  });

  it("English help request teaches the phrase, then acknowledges the repetition (Scenario I)", () => {
    const r = run([...started, turn("L1_HELP_REQUEST", { phrase: "ソフトウェアエンジニア" }), turn("UNDERSTOOD")]);
    expect(r.results[2].action).toEqual({ kind: "TEACH_PHRASE", phrase: "ソフトウェアエンジニア" });
    expect(r.last.action.kind).toBe("ACKNOWLEDGE_REPETITION");
    expect(r.state.awaitingRepetition).toBeNull();
  });

  it("misunderstood question is rephrased without touching counters or corrections (Scenario J)", () => {
    const r = run([...started, turn("UNCLEAR_AUDIO"), turn("UNDERSTOOD_OFF_TOPIC", { offTopicReason: "misunderstood_question" })]);
    expect(r.last.action).toEqual({ kind: "REPHRASE_QUESTION" });
    expect(r.state.unclearCount).toBe(1);
  });

  it("learner steering the topic is followed", () => {
    const r = run([...started, turn("UNDERSTOOD_OFF_TOPIC", { offTopicReason: "learner_steering" })]);
    expect(r.last.action).toEqual({ kind: "RESPOND", allowCorrections: false });
  });

  it("repeat/slower/meaning requests are handled without LLM-driven counters (Scenario H)", () => {
    const r = run([
      ...started,
      turn("META_REQUEST", { metaKind: "repeat" }),
      turn("META_REQUEST", { metaKind: "slower" }),
      turn("META_REQUEST", { metaKind: "meaning" }),
    ]);
    expect(r.results.slice(2).map((x) => x.action)).toEqual([
      { kind: "REPLAY", slow: false },
      { kind: "REPLAY", slow: true },
      { kind: "EXPLAIN_WORD" },
    ]);
    expect(r.state.learnerTurnCount).toBe(0);
  });

  it("unsafe content is declined; repeated attempts end the session politely (Scenario M)", () => {
    const r = run([...started, turn("UNSAFE"), turn("UNSAFE"), turn("UNSAFE")]);
    expect(r.results[2].close).toBe(false);
    expect(r.last.action.kind).toBe("DECLINE_AND_REDIRECT");
    expect(r.last.close).toBe(true);
    expect(r.state.wrapUpReason).toBe("unsafe");
  });
});

describe("provider failures (Scenario G)", () => {
  it("do not count as unclear speech; two in a row are fatal", () => {
    const r = run([...started, turn("PROVIDER_ERROR"), turn("PROVIDER_ERROR")]);
    expect(r.results[2].action.kind).toBe("PROVIDER_ERROR_LINE");
    expect(r.last.action.kind).toBe("PROVIDER_FATAL");
    expect(r.state.unclearCount).toBe(0);
  });

  it("a successful turn resets the consecutive-error counter", () => {
    const r = run([...started, turn("PROVIDER_ERROR"), turn("UNDERSTOOD"), turn("PROVIDER_ERROR")]);
    expect(r.last.action.kind).toBe("PROVIDER_ERROR_LINE");
  });
});

describe("soft time limit and wrap-up (D-20, Scenario L)", () => {
  it("lets the current exchange finish, then closes", () => {
    const r = run([...started, { type: "active_time", seconds: 300 }, turn("UNDERSTOOD")]);
    expect(r.results[2].action).toEqual({ kind: "NONE" }); // no cut-off mid-wait
    expect(r.state.wrapUp).toBe(true);
    expect(r.last.action.kind).toBe("RESPOND");
    expect(r.last.close).toBe(true);
    const closed = step(r.state, { type: "closing_delivered" });
    expect(closed.state.phase).toBe("ENDED");
    expect(closed.state.endReason).toBe("time");
  });

  it("does not clarify while wrapping up", () => {
    const r = run([...started, { type: "active_time", seconds: 300 }, turn("UNCLEAR_AUDIO")]);
    expect(r.last.action).toEqual({ kind: "CLOSE_ONLY" });
  });

  it("never hangs: grace safeguard ends a stuck wrap-up", () => {
    const r = run([...started, { type: "active_time", seconds: 300 }, { type: "active_time", seconds: 120 }]);
    expect(r.state.phase).toBe("ENDED");
    expect(r.state.endReason).toBe("grace");
  });

  it("trial exhaustion and budget kill switch wrap up the same way", () => {
    for (const reason of ["trial", "budget"] as const) {
      const r = run([...started, { type: "limit_reached", reason }, turn("UNDERSTOOD")]);
      expect(r.last.close).toBe(true);
      expect(r.state.wrapUpReason).toBe(reason);
    }
  });

  it("turn cap wraps up", () => {
    const cfg = { ...DEFAULT_MACHINE_CONFIG, maxLearnerTurns: 2 };
    const r = run([...started, turn("UNDERSTOOD"), turn("UNDERSTOOD")], cfg);
    expect(r.state.wrapUpReason).toBe("turn_cap");
    expect(r.last.close).toBe(true);
  });

  it("silence while wrapping up closes instead of nudging", () => {
    const r = run([...started, { type: "active_time", seconds: 300 }, { type: "silence_timeout" }]);
    expect(r.last.action).toEqual({ kind: "CLOSE_ONLY" });
    expect(r.last.close).toBe(true);
  });

  it("manual end goes straight to ENDED", () => {
    const r = run([...started, { type: "end_requested" }]);
    expect(r.state.phase).toBe("ENDED");
    expect(r.state.endReason).toBe("user");
  });
});

describe("reconnect (Scenario G)", () => {
  it("resumes within the window", () => {
    const r = run([...started, { type: "disconnect" }, { type: "reconnect", awaySeconds: 60 }]);
    expect(r.state.phase).toBe("CONVERSATION");
  });
  it("ends with a partial summary after the window", () => {
    const r = run([...started, { type: "disconnect" }, { type: "reconnect", awaySeconds: 121 }]);
    expect(r.state.phase).toBe("ENDED");
    expect(r.state.endReason).toBe("disconnect");
  });
  it("ignores learner turns while suspended", () => {
    const r = run([...started, { type: "disconnect" }, turn("UNDERSTOOD")]);
    expect(r.last.action.kind).toBe("NONE");
  });
});

describe("invariants", () => {
  it("stateVersion increases on every step and ENDED is terminal", () => {
    const r = run([...started, { type: "end_requested" }, turn("UNDERSTOOD")]);
    const versions = r.results.map((x) => x.state.stateVersion);
    expect(versions[0]).toBeLessThan(versions[1]);
    expect(r.last.action.kind).toBe("NONE");
    expect(r.state.phase).toBe("ENDED");
  });

  it("step is pure: inputs are never mutated", () => {
    const s = createInitialState();
    const frozen = JSON.stringify(s);
    step(s, { type: "greeting_sent" });
    expect(JSON.stringify(s)).toBe(frozen);
  });
});
