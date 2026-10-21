// Shared types for the dialogue machine (docs/07).

export type TurnCategory =
  | "NO_SPEECH"
  | "UNCLEAR_AUDIO"
  | "AMBIGUOUS"
  | "CONFIRM_HEARD"
  | "UNDERSTOOD"
  | "UNDERSTOOD_OFF_TOPIC"
  | "L1_HELP_REQUEST"
  | "L1_ANSWER"
  | "DONT_KNOW"
  | "META_REQUEST"
  | "UNSAFE"
  | "PROVIDER_ERROR";

export type Phase =
  | "INIT"
  | "TOPIC_SELECTION"
  | "CONVERSATION"
  | "WRAP_UP"
  | "SUSPENDED"
  | "ENDED";

export type WrapUpReason = "time" | "trial" | "budget" | "user" | "turn_cap" | "unsafe";

export type EndReason = WrapUpReason | "grace" | "disconnect" | "error";

export type HintLevel = 0 | 1 | 2 | 3;

export interface DialogueState {
  phase: Phase;
  /** Phase to return to after a reconnect. */
  resumePhase: Exclude<Phase, "SUSPENDED" | "ENDED" | "INIT"> | null;
  topic: { label: string; source: "chip" | "spoken" | "surprise" } | null;
  unclearCount: number;
  hintLevel: HintLevel;
  consecutiveProviderErrors: number;
  unsafeCount: number;
  /** Set after the tutor teaches a phrase and invites the learner to say it. */
  awaitingRepetition: string | null;
  wrapUp: boolean;
  wrapUpReason: WrapUpReason | null;
  /** activeSeconds at the moment wrap-up began (grace timer). */
  wrapUpStartedAt: number | null;
  activeSeconds: number;
  learnerTurnCount: number;
  endReason: EndReason | null;
  stateVersion: number;
}

export type MetaKind = "repeat" | "slower" | "meaning";
export type OffTopicReason = "learner_steering" | "misunderstood_question";

export type DialogueEvent =
  | { type: "greeting_sent" }
  | {
      type: "learner_turn";
      category: TurnCategory;
      offTopicReason?: OffTopicReason;
      metaKind?: MetaKind;
      /** Topic extracted from an understood turn while choosing a topic. */
      topic?: { label: string; source: "chip" | "spoken" };
      /** Target phrase the tutor should teach (L1 help / L1 answer). */
      phrase?: string;
    }
  | { type: "topic_chip"; label: string }
  | { type: "hint_request" }
  | { type: "silence_timeout" }
  | { type: "active_time"; seconds: number }
  | { type: "limit_reached"; reason: "trial" | "budget" }
  | { type: "end_requested" }
  | { type: "closing_delivered" }
  | { type: "disconnect" }
  | { type: "reconnect"; awaySeconds: number };

export type PolicyAction =
  | { kind: "NONE" }
  | { kind: "GREET_AND_ASK_TOPIC" }
  | { kind: "CLARIFY"; variant: "rephrase" | "simplify" }
  /** Recognition was plausible but not trustworthy: show what we heard and ask "Did you say …?" */
  | { kind: "CONFIRM_HEARD" }
  | { kind: "SUGGEST_AND_MOVE_ON"; flagForReview: true }
  | { kind: "SURPRISE_TOPIC"; flagForReview: true }
  | { kind: "RESPOND"; allowCorrections: boolean }
  | { kind: "ACKNOWLEDGE_REPETITION"; allowCorrections: boolean }
  | { kind: "REPHRASE_QUESTION" }
  | { kind: "TEACH_PHRASE"; phrase?: string }
  | { kind: "MODEL_IN_TARGET"; phrase?: string }
  | { kind: "HINT"; level: 1 | 2 | 3; source: "button" | "silence" | "dont_know" }
  | { kind: "MODEL_ANSWER_AND_MOVE_ON" }
  | { kind: "REPLAY"; slow: boolean }
  | { kind: "EXPLAIN_WORD" }
  | { kind: "DECLINE_AND_REDIRECT" }
  | { kind: "PROVIDER_ERROR_LINE" }
  | { kind: "PROVIDER_FATAL" }
  | { kind: "CLOSE_ONLY" };

export interface StepResult {
  state: DialogueState;
  action: PolicyAction;
  /** True when the tutor must finish with a closing line after the action. */
  close: boolean;
}

export interface MachineConfig {
  unclearMaxRetries: number;
  sessionTargetSeconds: number;
  graceSeconds: number;
  maxLearnerTurns: number;
  reconnectWindowSeconds: number;
  providerErrorLimit: number;
  unsafeLimit: number;
}
