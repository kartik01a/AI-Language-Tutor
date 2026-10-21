import type { VisemeEvent } from "@/lib/avatar/visemes";
import type { TurnCategory } from "@/lib/tutor/types";
import type { CorrectionCard } from "@/lib/tutor/correction-pipeline";

// Server → client events (docs/11 §3.3). Audio travels in separate binary frames that follow
// the `sentence` event they belong to.

/** Per-stage timings of one learner turn (ms). firstAudioMs is measured from the start of the request. */
export interface TurnLatency {
  sttMs: number | null;
  llmMs: number | null;
  firstAudioMs: number | null;
  totalMs: number;
}

/**
 * Why a turn was treated the way it was. Sent only outside production: it includes what the
 * recogniser heard, which we must not leak into logs or analytics (docs/14).
 */
export interface TurnDiagnostic {
  reason: string | null;
  heard: string | null;
  lang: string | null;
  meanConf: number | null;
  speechMs: number;
  clipMs: number;
  sttMs: number | null;
}

export type ErrorCode =
  | "SESSION_NOT_FOUND" | "SESSION_ENDED" | "SESSION_NOT_ENDED" | "STATE_CONFLICT" | "BUDGET_PAUSED"
  | "PAYLOAD_TOO_LARGE" | "BAD_REQUEST" | "PROVIDER_FATAL" | "INTERNAL";

export type ServerEvent =
  | { t: "transcript"; seq: number; turnId: string; text: string | null; display: "normal" | "unclear" | "confirm"; riskSpans: [number, number][]; diagnostic?: TurnDiagnostic }
  | { t: "category"; seq: number; category: TurnCategory; action: string }
  | {
      t: "sentence"; seq: number; messageId: string; index: number; text: string; translation?: string;
      role: "template" | "reply"; audio: { format: "wav" | "mp3"; durationMs: number }; visemes: VisemeEvent[];
    }
  | { t: "corrections"; seq: number; turnId: string; cards: CorrectionCard[] }
  | { t: "hint"; seq: number; level: 1 | 2 | 3; text: string; translation?: string }
  | { t: "limits"; seq: number; activeSeconds: number; wrapUp: boolean; reason: string | null }
  | { t: "translation"; seq: number; messageId: string; index: number; text: string }
  | { t: "turn_end"; seq: number; stateVersion: number; expect: "learner" | "end"; /** Server phase: the topic buttons stay until it leaves TOPIC_SELECTION. */ phase: string; latency?: TurnLatency }
  | { t: "session_end"; seq: number; reason: string }
  | { t: "error"; seq: number; code: ErrorCode; retryable: boolean; message: string };

export type ClientEvent =
  | { e: "start" }
  | { e: "topic_chip"; label: string }
  | { e: "hint_request" }
  /** Answer to "Did you say …?": yes = continue with the heard text, no = treat as unclear. */
  | { e: "confirm_heard"; yes: boolean }
  | { e: "card_report"; cardId: string; reason: "was_correct" | "misheard" | "other" }
  | { e: "silence_timeout" }
  | { e: "end" };
