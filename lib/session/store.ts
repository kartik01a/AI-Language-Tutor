import type { Enrichment } from "@/lib/tutor/schemas";
import type { CoachMode } from "@/lib/tutor/prompt";
import type { Level, Strictness } from "@/lib/tutor/corrections";
import type { DialogueState } from "@/lib/tutor/types";
import type { SttResult } from "@/lib/providers/types";
import type { GateOutcome } from "@/lib/tutor/gates";
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
  /** tutor = fix mistakes aloud and with cards; casual = just talk, never correct. Switchable mid-conversation. */
  coachMode: CoachMode;
  firstName: string;
  state: DialogueState;
  history: HistoryItem[];
  lastHints: Enrichment["hints"] | null;
  currentQuestion: { text: string; expects: "open" | "closed" | "repetition" | "topic" } | null;
  /** ms epoch of the last accounted activity (active-time accounting is server-side). */
  lastActivityAt: number;
  seq: number;
  costUsd: number;
  reports: { cardId: string; reason: string }[];
  /** A transcript awaiting the learner's "Yes, that's what I said" (see CONFIRM_HEARD). */
  pendingConfirm: { turnId: string; asr: SttResult; gate: GateOutcome; clip: { speechMs: number; clipMs: number }; mime: string } | null;
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
  /**
   * Corrections are append-only and live OUTSIDE the session record: they are produced after the
   * learner's turn has finished, so they must never contend with the next turn's revision check
   * (in Postgres this is simply inserts into the corrections table).
   */
  addCorrection(sessionId: string, entry: CorrectionRecord): Promise<void>;
  listCorrections(sessionId: string): Promise<CorrectionRecord[]>;
  get(id: string): Promise<SessionRecord | null>;
  /** Stores the record only if the stored revision still equals `expectedRev`. */
  put(rec: SessionRecord, expectedRev: number): Promise<boolean>;
  create(rec: SessionRecord): Promise<void>;
}

export class MemorySessionStore implements SessionStore {
  private m = new Map<string, SessionRecord>();
  private corr = new Map<string, CorrectionRecord[]>();
  async addCorrection(sessionId: string, entry: CorrectionRecord) {
    this.corr.set(sessionId, [...(this.corr.get(sessionId) ?? []), structuredClone(entry)]);
  }
  async listCorrections(sessionId: string) {
    return structuredClone(this.corr.get(sessionId) ?? []);
  }
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
