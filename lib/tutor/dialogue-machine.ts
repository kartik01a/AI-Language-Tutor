import type {
  DialogueEvent,
  DialogueState,
  HintLevel,
  MachineConfig,
  PolicyAction,
  StepResult,
  WrapUpReason,
} from "./types";

// Pure dialogue machine (docs/07 §3). No I/O, no clocks, no randomness:
// the LLM proposes, this code decides retries, hints, limits and wrap-up.

export const DEFAULT_MACHINE_CONFIG: MachineConfig = {
  unclearMaxRetries: 1,
  sessionTargetSeconds: 300,
  graceSeconds: 120,
  maxLearnerTurns: 40,
  reconnectWindowSeconds: 120,
  providerErrorLimit: 2,
  unsafeLimit: 3,
};

export function createInitialState(): DialogueState {
  return {
    phase: "INIT",
    resumePhase: null,
    topic: null,
    unclearCount: 0,
    hintLevel: 0,
    consecutiveProviderErrors: 0,
    unsafeCount: 0,
    awaitingRepetition: null,
    wrapUp: false,
    wrapUpReason: null,
    wrapUpStartedAt: null,
    activeSeconds: 0,
    learnerTurnCount: 0,
    endReason: null,
    stateVersion: 0,
  };
}

const NONE: PolicyAction = { kind: "NONE" };

const ACTIVE_PHASES = new Set(["TOPIC_SELECTION", "CONVERSATION", "WRAP_UP"]);

function done(state: DialogueState, action: PolicyAction, close = false): StepResult {
  return {
    state: { ...state, stateVersion: state.stateVersion + 1 },
    action,
    close: close && state.phase !== "ENDED",
  };
}

function startWrapUp(s: DialogueState, reason: WrapUpReason): DialogueState {
  if (s.wrapUp) return s;
  return {
    ...s,
    wrapUp: true,
    wrapUpReason: reason,
    wrapUpStartedAt: s.activeSeconds,
    phase: s.phase === "TOPIC_SELECTION" || s.phase === "CONVERSATION" ? "WRAP_UP" : s.phase,
  };
}

function hintLadder(
  s: DialogueState,
  source: "button" | "silence" | "dont_know",
): { state: DialogueState; action: PolicyAction } {
  if (s.hintLevel < 3) {
    const level = (s.hintLevel + 1) as 1 | 2 | 3;
    return {
      state: { ...s, hintLevel: level as HintLevel },
      action: { kind: "HINT", level, source },
    };
  }
  // Ladder exhausted: show the model answer and move on (docs/07 Scenario A).
  return {
    state: { ...s, hintLevel: 0, awaitingRepetition: null },
    action: { kind: "MODEL_ANSWER_AND_MOVE_ON" },
  };
}

export function step(
  state: DialogueState,
  event: DialogueEvent,
  cfg: MachineConfig = DEFAULT_MACHINE_CONFIG,
): StepResult {
  if (state.phase === "ENDED") return { state, action: NONE, close: false };

  switch (event.type) {
    case "greeting_sent": {
      if (state.phase !== "INIT") return done(state, NONE);
      return done({ ...state, phase: "TOPIC_SELECTION" }, NONE);
    }

    case "topic_chip": {
      if (state.phase !== "TOPIC_SELECTION") return done(state, NONE);
      return done(
        {
          ...state,
          phase: "CONVERSATION",
          topic: { label: event.label, source: "chip" },
          unclearCount: 0,
          hintLevel: 0,
        },
        { kind: "RESPOND", allowCorrections: false },
      );
    }

    case "active_time": {
      if (!ACTIVE_PHASES.has(state.phase)) return done(state, NONE);
      let s: DialogueState = {
        ...state,
        activeSeconds: state.activeSeconds + Math.max(0, event.seconds),
      };
      if (!s.wrapUp && s.activeSeconds >= cfg.sessionTargetSeconds) {
        s = startWrapUp(s, "time");
      }
      // Hidden grace safeguard: wrap-up never hangs the session (D-20).
      if (
        s.wrapUp &&
        s.wrapUpStartedAt !== null &&
        s.activeSeconds - s.wrapUpStartedAt >= cfg.graceSeconds
      ) {
        return done({ ...s, phase: "ENDED", endReason: "grace" }, { kind: "CLOSE_ONLY" }, true);
      }
      return done(s, NONE);
    }

    case "limit_reached": {
      if (!ACTIVE_PHASES.has(state.phase)) return done(state, NONE);
      return done(startWrapUp(state, event.reason), NONE);
    }

    case "end_requested": {
      return done(
        { ...state, phase: "ENDED", wrapUp: true, wrapUpReason: state.wrapUpReason ?? "user", endReason: "user" },
        NONE,
      );
    }

    case "closing_delivered": {
      if (!state.wrapUp) return done(state, NONE);
      return done({ ...state, phase: "ENDED", endReason: state.wrapUpReason ?? "time" }, NONE);
    }

    case "disconnect": {
      if (!ACTIVE_PHASES.has(state.phase)) return done(state, NONE);
      return done(
        {
          ...state,
          phase: "SUSPENDED",
          resumePhase: state.phase as DialogueState["resumePhase"],
        },
        NONE,
      );
    }

    case "reconnect": {
      if (state.phase !== "SUSPENDED") return done(state, NONE);
      if (event.awaySeconds <= cfg.reconnectWindowSeconds && state.resumePhase) {
        return done({ ...state, phase: state.resumePhase, resumePhase: null }, NONE);
      }
      return done({ ...state, phase: "ENDED", endReason: "disconnect" }, NONE);
    }

    case "hint_request":
    case "silence_timeout": {
      if (!ACTIVE_PHASES.has(state.phase)) return done(state, NONE);
      const isSilence = event.type === "silence_timeout";
      // While wrapping up, silence just closes the session politely.
      if (isSilence && state.wrapUp) return done(state, { kind: "CLOSE_ONLY" }, true);
      const r = hintLadder(state, isSilence ? "silence" : "button");
      return done(r.state, r.action, state.wrapUp);
    }

    case "learner_turn":
      return learnerTurn(state, event, cfg);
  }
}

function learnerTurn(
  state: DialogueState,
  event: Extract<DialogueEvent, { type: "learner_turn" }>,
  cfg: MachineConfig,
): StepResult {
  if (!ACTIVE_PHASES.has(state.phase)) return done(state, NONE);

  const category = event.category;
  // A confirmation prompt is not a turn: the learner's "Yes" is the turn that counts.
  const countsAsTurn = category !== "PROVIDER_ERROR" && category !== "META_REQUEST" && category !== "CONFIRM_HEARD";

  let s: DialogueState = {
    ...state,
    learnerTurnCount: state.learnerTurnCount + (countsAsTurn ? 1 : 0),
    consecutiveProviderErrors: category === "PROVIDER_ERROR" ? state.consecutiveProviderErrors : 0,
  };
  if (!s.wrapUp && s.learnerTurnCount >= cfg.maxLearnerTurns) {
    s = startWrapUp(s, "turn_cap");
  }

  const inTopicSelection = s.phase === "TOPIC_SELECTION";
  const resetCounters = (x: DialogueState): DialogueState => ({ ...x, unclearCount: 0, hintLevel: 0 });
  const enterConversation = (x: DialogueState, topic: DialogueState["topic"]): DialogueState =>
    x.phase === "TOPIC_SELECTION" ? { ...x, phase: "CONVERSATION", topic } : x;

  switch (category) {
    case "NO_SPEECH":
    case "UNCLEAR_AUDIO":
    case "AMBIGUOUS":
    case "CONFIRM_HEARD": {
      // Never clarify while wrapping up: just close politely.
      if (s.wrapUp) return done(s, { kind: "CLOSE_ONLY" }, true);
      if (s.unclearCount < cfg.unclearMaxRetries) {
        // Every confirmation prompt uses up an attempt, so it can never loop forever.
        return done(
          { ...s, unclearCount: s.unclearCount + 1 },
          category === "CONFIRM_HEARD"
            ? { kind: "CONFIRM_HEARD" }
            : { kind: "CLARIFY", variant: s.unclearCount === 0 ? "rephrase" : "simplify" },
        );
      }
      // Retry limit reached: model an answer and move on, never a dead end (D-17).
      if (inTopicSelection) {
        return done(
          resetCounters(enterConversation(s, { label: "Surprise me", source: "surprise" })),
          { kind: "SURPRISE_TOPIC", flagForReview: true },
        );
      }
      return done(resetCounters(s), { kind: "SUGGEST_AND_MOVE_ON", flagForReview: true });
    }

    case "UNDERSTOOD": {
      let next = resetCounters(s);
      if (inTopicSelection) {
        next = enterConversation(next, event.topic ?? { label: "Free conversation", source: "spoken" });
        return done(next, { kind: "RESPOND", allowCorrections: false }, next.wrapUp);
      }
      if (next.awaitingRepetition !== null) {
        return done(
          { ...next, awaitingRepetition: null },
          { kind: "ACKNOWLEDGE_REPETITION", allowCorrections: true },
          next.wrapUp,
        );
      }
      return done(next, { kind: "RESPOND", allowCorrections: true }, next.wrapUp);
    }

    case "UNDERSTOOD_OFF_TOPIC": {
      const reason = event.offTopicReason ?? "misunderstood_question";
      if (reason === "learner_steering") {
        let next = resetCounters(s);
        next = enterConversation(next, event.topic ?? { label: "Free conversation", source: "spoken" });
        return done(next, { kind: "RESPOND", allowCorrections: false }, next.wrapUp);
      }
      // Likely misunderstood the question: simplify it; counters unchanged, no corrections.
      if (s.wrapUp) return done(s, { kind: "CLOSE_ONLY" }, true);
      return done(s, { kind: "REPHRASE_QUESTION" });
    }

    case "L1_HELP_REQUEST":
    case "L1_ANSWER": {
      const next = resetCounters(s);
      const awaiting = s.wrapUp ? null : (event.phrase ?? "");
      const action: PolicyAction =
        category === "L1_HELP_REQUEST"
          ? { kind: "TEACH_PHRASE", phrase: event.phrase }
          : { kind: "MODEL_IN_TARGET", phrase: event.phrase };
      return done({ ...next, awaitingRepetition: awaiting }, action, s.wrapUp);
    }

    case "DONT_KNOW": {
      if (s.wrapUp) return done(s, { kind: "CLOSE_ONLY" }, true);
      const r = hintLadder(s, "dont_know");
      return done(r.state, r.action);
    }

    case "META_REQUEST": {
      const kind = event.metaKind ?? "repeat";
      const action: PolicyAction =
        kind === "meaning" ? { kind: "EXPLAIN_WORD" } : { kind: "REPLAY", slow: kind === "slower" };
      return done(s, action, s.wrapUp);
    }

    case "UNSAFE": {
      s = { ...s, unsafeCount: s.unsafeCount + 1 };
      if (s.unsafeCount >= cfg.unsafeLimit) s = startWrapUp(s, "unsafe");
      return done(s, { kind: "DECLINE_AND_REDIRECT" }, s.wrapUp);
    }

    case "PROVIDER_ERROR": {
      // The learner did nothing wrong: unclearCount is deliberately untouched.
      s = { ...s, consecutiveProviderErrors: s.consecutiveProviderErrors + 1 };
      const fatal = s.consecutiveProviderErrors >= cfg.providerErrorLimit;
      return done(s, { kind: fatal ? "PROVIDER_FATAL" : "PROVIDER_ERROR_LINE" });
    }
  }
}
