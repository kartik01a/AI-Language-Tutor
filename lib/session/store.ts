import type { TurnOutput } from "@/lib/tutor/schemas";
import type { Level, Strictness } from "@/lib/tutor/corrections";
import type { DialogueState } from "@/lib/tutor/types";
import type { CorrectionCard, DroppedCorrection } from "@/lib/tutor/correction-pipeline";
import type { SessionSummary, Skills } from "@/lib/learning/summary";

export interface HistoryItem {
  role: "tutor" | "learner";
  text: string;
  notHeard?: boolean;
}

export interface CorrectionRecord {
  turnId: string;
  learnerText: string;
  cards: CorrectionCard[];
  /** Everything the pipeline proposed but the gates removed, with reasons (evaluation data). */
  dropped: DroppedCorrection[];
}

export interface SessionMetrics {
  learnerSpeechMs: number;
  learnerTurns: number;
  unclearTurns: number;
  providerErrors: number;
  maxHintLevel: number;
  hintsUsed: number;
  wordsIntroduced: { lemma: string; reading: string | null; meaning: string }[];
}

export interface SessionRecord {
  id: string;
  tutorId: string;
  level: Level;
  strictness: Strictness;
  firstName: string;
  state: DialogueState;
  history: HistoryItem[];
  lastHints: TurnOutput["hints"] | null;
  currentQuestion: { text: string; expects: "open" | "closed" | "repetition" | "topic" } | null;
  /** ms epoch of the last accounted activity (active-time accounting is server-side). */
  lastActivityAt: number;
  seq: number;
  costUsd: number;
  corrections: CorrectionRecord[];
  reports: { cardId: string; reason: string }[];
  /** Times each error code was shown this session (≥2 counts as recurrent). */
  errorCounts: Record<string, number>;
  metrics: SessionMetrics;
  /** Per-skill level estimates (in-memory in the demo; persisted per learner once the DB is wired). */
  skills: Skills;
  /** Computed once when first requested after the session ends. */
  summary: SessionSummary | null;
  endEmitted: boolean;
  /** Optimistic-concurrency revision, bumped on every successful put. */
  rev: number;
}

export interface SessionStore {
  get(id: string): Promise<SessionRecord | null>;
  /** Stores the record only if the stored revision still equals `expectedRev`. */
  put(rec: SessionRecord, expectedRev: number): Promise<boolean>;
  create(rec: SessionRecord): Promise<void>;
}

export class MemorySessionStore implements SessionStore {
  private m = new Map<string, SessionRecord>();
  async get(id: string) {
    const r = this.m.get(id);
    return r ? structuredClone(r) : null;
  }
  async create(rec: SessionRecord) {
    this.m.set(rec.id, structuredClone(rec));
  }
  async put(rec: SessionRecord, expectedRev: number) {
    const cur = this.m.get(rec.id);
    if (!cur || cur.rev !== expectedRev) return false;
    this.m.set(rec.id, structuredClone({ ...rec, rev: expectedRev + 1 }));
    return true;
  }
}
