import type { CorrectionCard } from "@/lib/tutor/correction-pipeline";
import type { TurnDiagnostic } from "@/lib/contracts/events";

// UI state for the conversation screen (docs/02 §5.3). The server's dialogue machine owns
// pedagogy; this only tracks what to show.

export type Phase = "intro" | "starting" | "tutor" | "waiting" | "recording" | "processing" | "ended" | "error";

export interface Message {
  id: string;
  role: "tutor" | "learner";
  text: string;
  translation?: string;
  unclear?: boolean;
  /** Tentative: waiting for the learner's "Yes, that's what I said". */
  confirming?: boolean;
  /** Dev-only: why a turn was rejected (what was heard, confidence, clip stats). */
  diagnostic?: TurnDiagnostic;
  /** Set on learner messages once the correction pipeline has produced cards. */
  cards?: CorrectionCard[];
}

export interface UiState {
  phase: Phase;
  messages: Message[];
  chips: { label: string; hint: string }[];
  needsTopic: boolean;
  /** Turn id of the message currently asking "Did you say …?" (buttons are shown on it). */
  confirmTurnId: string | null;
  hint: { level: number; text: string; translation?: string } | null;
  wrapUp: boolean;
  error: string | null;
  endReason: string | null;
  sessionId: string | null;
}

export const initialUi: UiState = {
  phase: "intro", messages: [], chips: [], needsTopic: true, confirmTurnId: null, hint: null, wrapUp: false, error: null, endReason: null, sessionId: null,
};

export type Action =
  | { type: "phase"; phase: Phase }
  | { type: "chips"; chips: UiState["chips"] }
  | { type: "message"; message: Message }
  | { type: "confirm_clear" }
  | { type: "hint"; hint: UiState["hint"] }
  | { type: "cards"; turnId: string; cards: CorrectionCard[] }
  | { type: "topic_chosen" }
  | { type: "limits"; wrapUp: boolean }
  | { type: "error"; message: string; fatal?: boolean }
  | { type: "session"; id: string }
  | { type: "ended"; reason: string };

export function reducer(s: UiState, a: Action): UiState {
  switch (a.type) {
    case "phase":
      // An ended or failed session never goes back to waiting.
      if (s.phase === "ended" || (s.phase === "error" && a.phase !== "intro")) return s;
      return { ...s, phase: a.phase, hint: a.phase === "recording" ? null : s.hint };
    case "chips":
      return { ...s, chips: a.chips };
    case "message": {
      // A message with an existing id REPLACES it: the learner's answer to "Did you say …?" turns the
      // tentative bubble into the real one instead of adding a duplicate.
      const i = s.messages.findIndex((m) => m.id === a.message.id);
      const messages = i >= 0 ? s.messages.map((m, j) => (j === i ? a.message : m)) : [...s.messages, a.message];
      return { ...s, messages, confirmTurnId: a.message.confirming ? a.message.id : s.confirmTurnId === a.message.id ? null : s.confirmTurnId };
    }
    case "confirm_clear":
      // The learner ignored the buttons and spoke again: the old question is withdrawn.
      return {
        ...s,
        confirmTurnId: null,
        messages: s.messages.map((m) => (m.id === s.confirmTurnId ? { ...m, confirming: false, unclear: true, text: "(I couldn't catch this)" } : m)),
      };
    case "hint":
      return { ...s, hint: a.hint };
    case "cards":
      return { ...s, messages: s.messages.map((m) => (m.id === a.turnId ? { ...m, cards: a.cards } : m)) };
    case "topic_chosen":
      return { ...s, needsTopic: false };
    case "limits":
      return { ...s, wrapUp: a.wrapUp };
    case "error":
      return a.fatal ? { ...s, phase: "error", error: a.message } : { ...s, error: a.message };
    case "session":
      return { ...s, sessionId: a.id };
    case "ended":
      return { ...s, phase: "ended", endReason: a.reason };
  }
}

export const STATUS_LABEL: Record<Phase, string> = {
  intro: "Ready when you are",
  starting: "Getting ready…",
  tutor: "Speaking… tap 🎤 to answer",
  waiting: "Tap to speak",
  recording: "Listening… tap to send",
  processing: "Thinking…",
  ended: "Conversation finished",
  error: "Something went wrong",
};
