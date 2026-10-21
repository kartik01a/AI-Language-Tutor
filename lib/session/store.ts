import type { TurnOutput } from "@/lib/tutor/schemas";
import type { Level, Strictness } from "@/lib/tutor/corrections";
import type { DialogueState } from "@/lib/tutor/types";

export interface HistoryItem {
  role: "tutor" | "learner";
  text: string;
  notHeard?: boolean;
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
