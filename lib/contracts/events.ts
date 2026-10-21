import type { VisemeEvent } from "@/lib/avatar/visemes";
import type { TurnCategory } from "@/lib/tutor/types";

// Server → client events (docs/11 §3.3). Audio travels in separate binary frames that follow
// the `sentence` event they belong to.

export type ErrorCode =
  | "SESSION_NOT_FOUND" | "SESSION_ENDED" | "STATE_CONFLICT" | "BUDGET_PAUSED"
  | "PAYLOAD_TOO_LARGE" | "BAD_REQUEST" | "PROVIDER_FATAL" | "INTERNAL";

export type ServerEvent =
  | { t: "transcript"; seq: number; turnId: string; text: string | null; display: "normal" | "unclear"; riskSpans: [number, number][] }
  | { t: "category"; seq: number; category: TurnCategory; action: string }
  | {
      t: "sentence"; seq: number; messageId: string; index: number; text: string; translation?: string;
      role: "template" | "reply"; audio: { format: "wav" | "mp3"; durationMs: number }; visemes: VisemeEvent[];
    }
  | { t: "hint"; seq: number; level: 1 | 2 | 3; text: string; translation?: string }
  | { t: "limits"; seq: number; activeSeconds: number; wrapUp: boolean; reason: string | null }
  | { t: "turn_end"; seq: number; stateVersion: number; expect: "learner" | "end" }
  | { t: "session_end"; seq: number; reason: string }
  | { t: "error"; seq: number; code: ErrorCode; retryable: boolean; message: string };

export type ClientEvent =
  | { e: "start" }
  | { e: "topic_chip"; label: string }
  | { e: "hint_request" }
  | { e: "silence_timeout" }
  | { e: "end" };
