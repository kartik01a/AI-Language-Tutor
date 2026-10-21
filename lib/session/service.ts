import { budgetStatus, llmCost, monthKey, sttCost, ttsCost, azureBillableChars, type SpendStore } from "@/lib/limits/budget";
import type { AppConfig } from "@/lib/config";
import type { ServerEvent, ErrorCode } from "@/lib/contracts/events";
import type { LlmProvider, SttProvider, TtsProvider } from "@/lib/providers/types";
import { createInitialState, step } from "@/lib/tutor/dialogue-machine";
import { processLearnerTurn } from "@/lib/tutor/turn-pipeline";
import { YUKI_CHIPS, YUKI_CLOSING, YUKI_GREETING, NUDGE_LINE, templateFor, type Spoken } from "@/lib/tutor/templates";
import { TUTORS } from "@/lib/tutor/tutors";
import type { Level, Strictness } from "@/lib/tutor/corrections";
import type { DialogueEvent, MachineConfig, StepResult } from "@/lib/tutor/types";
import type { HistoryItem, SessionRecord, SessionStore } from "./store";
import type { ClientEvent } from "@/lib/contracts/events";

export type OutFrame = { kind: "event"; event: ServerEvent } | { kind: "audio"; bytes: Uint8Array };

export interface ServiceDeps {
  store: SessionStore;
  stt: SttProvider;
  llm: LlmProvider;
  tts: TtsProvider;
  spend: SpendStore;
  config: AppConfig;
  now?: () => number;
  newId?: () => string;
}

export class ServiceError extends Error {
  constructor(public code: ErrorCode, message: string, public retryable = false) {
    super(message);
  }
}

const TOPIC_QUESTIONS: Record<string, Spoken> = {
  食べ物: { text: "好きな食べ物は何ですか？", translation: "What's your favourite food?" },
  週末: { text: "週末は何をしましたか？", translation: "What did you do at the weekend?" },
  旅行: { text: "どこに行きたいですか？", translation: "Where would you like to go?" },
};
const DEFAULT_QUESTION: Spoken = { text: "どんなことが好きですか？", translation: "What kinds of things do you like?" };

export class SessionService {
  private now: () => number;
  private newId: () => string;
  private machine: MachineConfig;

  constructor(private d: ServiceDeps) {
    this.now = d.now ?? Date.now;
    this.newId = d.newId ?? (() => crypto.randomUUID());
    this.machine = {
      unclearMaxRetries: d.config.UNCLEAR_MAX_RETRIES,
      sessionTargetSeconds: d.config.SESSION_TARGET_MINUTES * 60,
      graceSeconds: d.config.SESSION_GRACE_SECONDS,
      maxLearnerTurns: d.config.MAX_LEARNER_TURNS,
      reconnectWindowSeconds: d.config.RECONNECT_WINDOW_SECONDS,
      providerErrorLimit: 2,
      unsafeLimit: 3,
    };
  }

  async createSession(input: { level: Level; strictness?: Strictness; firstName?: string }) {
    const b = await budgetStatus(this.d.spend, this.d.config.AI_MONTHLY_BUDGET_USD, new Date(this.now()));
    if (b.status === "exhausted") throw new ServiceError("BUDGET_PAUSED", "Practice is paused for now.");
    const tutor = TUTORS["yuki-ja"];
    const rec: SessionRecord = {
      id: this.newId(), tutorId: tutor.id, level: input.level, strictness: input.strictness ?? "balanced",
      firstName: input.firstName ?? "Learner", state: createInitialState(), history: [], lastHints: null,
      currentQuestion: null, lastActivityAt: this.now(), seq: 0, costUsd: 0, endEmitted: false, rev: 0,
    };
    await this.d.store.create(rec);
    return {
      sessionId: rec.id,
      tutor: { id: tutor.id, name: tutor.name, accent: tutor.accent },
      chips: YUKI_CHIPS,
      limits: { sessionTargetSeconds: this.machine.sessionTargetSeconds },
    };
  }

  // ---------- helpers ----------

  private emit(rec: SessionRecord, e: DistributiveOmit<ServerEvent, "seq">): OutFrame {
    return { kind: "event", event: { ...e, seq: ++rec.seq } as ServerEvent };
  }

  private async load(id: string): Promise<{ rec: SessionRecord; rev: number }> {
    const rec = await this.d.store.get(id);
    if (!rec) throw new ServiceError("SESSION_NOT_FOUND", "Unknown session");
    return { rec, rev: rec.rev };
  }

  private applyStep(rec: SessionRecord, event: DialogueEvent): StepResult {
    const r = step(rec.state, event, this.machine);
    rec.state = r.state;
    return r;
  }

  private accrueTime(rec: SessionRecord): void {
    const t = this.now();
    const delta = Math.min(Math.max(0, (t - rec.lastActivityAt) / 1000), this.d.config.IDLE_PAUSE_SECONDS);
    rec.lastActivityAt = t;
    if (delta > 0) this.applyStep(rec, { type: "active_time", seconds: delta });
  }

  private async addSpend(rec: SessionRecord, usd: number): Promise<void> {
    rec.costUsd += usd;
    await this.d.spend.add(monthKey(new Date(this.now())), usd);
  }

  private async *speak(rec: SessionRecord, lines: Spoken[], role: "template" | "reply", messageId: string): AsyncGenerator<OutFrame> {
    const tutor = TUTORS[rec.tutorId];
    let index = 0;
    for (const line of lines) {
      const voice = { ...tutor.voice, rate: tutor.voice.rateByLevel[rec.level] };
      const r = await this.d.tts.synthesize(line.text, voice);
      await this.addSpend(rec, ttsCost("azure-standard", azureBillableChars(line.text)));
      yield this.emit(rec, {
        t: "sentence", messageId, index: index++, text: line.text, translation: line.translation, role,
        audio: { format: "wav", durationMs: r.durationMs }, visemes: r.visemes,
      });
      yield { kind: "audio", bytes: r.audio };
      rec.history.push({ role: "tutor", text: line.text } as HistoryItem);
    }
    const last = lines[lines.length - 1];
    if (last) rec.currentQuestion = { text: last.text, expects: "open" };
  }

  private *finishIfEnded(rec: SessionRecord): Generator<OutFrame> {
    if (rec.state.phase === "ENDED" && !rec.endEmitted) {
      rec.endEmitted = true;
      yield this.emit(rec, { t: "session_end", reason: rec.state.endReason ?? "time" });
    }
  }

  private async *persist(rec: SessionRecord, rev: number): AsyncGenerator<OutFrame> {
    const ok = await this.d.store.put(rec, rev);
    if (!ok) yield this.emit(rec, { t: "error", code: "STATE_CONFLICT", retryable: true, message: "Session changed elsewhere; please retry." });
  }

  private hintText(rec: SessionRecord, level: 1 | 2 | 3): { text: string; translation?: string } {
    const h = rec.lastHints;
    if (!h) return { text: level === 1 ? "Say something short, like a topic you like." : "Try: 好きな食べ物は…" };
    if (level === 1) return { text: h.hint };
    if (level === 2) return { text: h.starter };
    return { text: h.example, translation: h.example_translation };
  }

  // ---------- events ----------

  async *handleEvent(sessionId: string, ev: ClientEvent): AsyncGenerator<OutFrame> {
    const { rec, rev } = await this.load(sessionId);
    if (rec.state.phase === "ENDED") {
      yield this.emit(rec, { t: "error", code: "SESSION_ENDED", retryable: false, message: "This conversation has ended." });
      return;
    }
    const messageId = this.newId();
    this.accrueTime(rec);

    switch (ev.e) {
      case "start": {
        this.applyStep(rec, { type: "greeting_sent" });
        yield* this.speak(rec, YUKI_GREETING, "template", messageId);
        break;
      }
      case "topic_chip": {
        this.applyStep(rec, { type: "topic_chip", label: ev.label });
        const q = TOPIC_QUESTIONS[ev.label] ?? DEFAULT_QUESTION;
        yield* this.speak(rec, [{ text: `${ev.label}ですね。いいですね！`, translation: `${ev.label} — nice!` }, q], "template", messageId);
        break;
      }
      case "hint_request": {
        const r = this.applyStep(rec, { type: "hint_request" });
        if (r.action.kind === "HINT") {
          yield this.emit(rec, { t: "hint", level: r.action.level, ...this.hintText(rec, r.action.level) });
        } else if (r.action.kind === "MODEL_ANSWER_AND_MOVE_ON") {
          const ex = this.hintText(rec, 3);
          yield* this.speak(rec, [{ text: "大丈夫です！こう言えますよ。", translation: "No problem! You can say:" }, { text: ex.text, translation: ex.translation ?? "" }], "template", messageId);
        }
        break;
      }
      case "silence_timeout": {
        const r = this.applyStep(rec, { type: "silence_timeout" });
        if (r.action.kind === "HINT") {
          yield* this.speak(rec, [NUDGE_LINE], "template", messageId);
          yield this.emit(rec, { t: "hint", level: r.action.level, ...this.hintText(rec, r.action.level) });
        } else if (r.close) {
          yield* this.speak(rec, [YUKI_CLOSING], "template", messageId);
          this.applyStep(rec, { type: "closing_delivered" });
        }
        break;
      }
      case "end": {
        this.applyStep(rec, { type: "end_requested" });
        break;
      }
    }

    yield this.emit(rec, { t: "limits", activeSeconds: Math.round(rec.state.activeSeconds), wrapUp: rec.state.wrapUp, reason: rec.state.wrapUpReason });
    yield* this.finishIfEnded(rec);
    yield this.emit(rec, { t: "turn_end", stateVersion: rec.state.stateVersion, expect: isEnded(rec) ? "end" : "learner" });
    yield* this.persist(rec, rev);
  }

  // ---------- learner turn ----------

  async *handleTurn(
    sessionId: string,
    audio: Uint8Array,
    mime: string,
    clip: { speechMs: number; clipMs: number },
  ): AsyncGenerator<OutFrame> {
    const { rec, rev } = await this.load(sessionId);
    if (rec.state.phase === "ENDED") {
      yield this.emit(rec, { t: "error", code: "SESSION_ENDED", retryable: false, message: "This conversation has ended." });
      return;
    }
    const messageId = this.newId();
    const turnId = this.newId();

    this.accrueTime(rec);
    const b = await budgetStatus(this.d.spend, this.d.config.AI_MONTHLY_BUDGET_USD, new Date(this.now()));
    if (b.status === "exhausted") this.applyStep(rec, { type: "limit_reached", reason: "budget" });

    const tutor = TUTORS[rec.tutorId];
    const result = await processLearnerTurn(
      { stt: this.d.stt, llm: this.d.llm, machine: this.machine, minSpeechMs: this.d.config.MIN_SPEECH_MS },
      {
        state: rec.state, audio, mime, clip, target: "ja",
        prompt: {
          tutor, level: rec.level, strictness: rec.strictness,
          learner: { firstName: rec.firstName, recurringMistakes: [] },
          session: {
            topic: rec.state.topic?.label ?? null, goals: [], simplifyMode: false, wrapUp: rec.state.wrapUp,
            history: rec.history, currentQuestion: rec.currentQuestion,
          },
        },
      },
    );
    rec.state = result.state;

    // Costs: STT only if it was actually called; LLM per call.
    if (result.asr) await this.addSpend(rec, sttCost("deepgram-nova-3", clip.clipMs / 1000));
    for (const u of result.usage) await this.addSpend(rec, llmCost("gpt-6-luna", u));

    // What the learner sees: unclear turns never show a confident-looking transcript.
    const unclear = result.category === "NO_SPEECH" || result.category === "UNCLEAR_AUDIO" || result.category === "AMBIGUOUS";
    yield this.emit(rec, {
      t: "transcript", turnId, text: result.asr && !unclear ? result.asr.text.replace(/ /g, "") : null,
      display: unclear ? "unclear" : "normal", riskSpans: result.gate?.riskSpans ?? [],
    });
    if (result.asr && !unclear) rec.history.push({ role: "learner", text: result.asr.text.replace(/ /g, "") });
    yield this.emit(rec, { t: "category", category: result.category, action: result.action.kind });

    if (result.analysis) rec.lastHints = result.analysis.hints;

    // What the tutor says: a template for recovery actions, the validated LLM reply otherwise.
    const example = rec.lastHints ? { text: rec.lastHints.example, translation: rec.lastHints.example_translation } : undefined;
    const tmpl = templateFor(result.action, { example, silent: result.category === "NO_SPEECH" });
    if (tmpl !== null) {
      yield* this.speak(rec, tmpl, "template", messageId);
    } else if (result.replySentences && result.analysis) {
      const tr = result.analysis.reply.translation;
      const lines: Spoken[] = result.replySentences.map((text, i) => ({ text, translation: tr[i] ?? "" }));
      yield* this.speak(rec, lines, "reply", messageId);
    }

    if (result.action.kind === "PROVIDER_FATAL") {
      yield this.emit(rec, { t: "error", code: "PROVIDER_FATAL", retryable: true, message: "Something's wrong on our end. Your conversation is saved." });
    }

    if (result.close && !isEnded(rec)) {
      yield* this.speak(rec, [YUKI_CLOSING], "template", this.newId());
      this.applyStep(rec, { type: "closing_delivered" });
    }

    yield this.emit(rec, { t: "limits", activeSeconds: Math.round(rec.state.activeSeconds), wrapUp: rec.state.wrapUp, reason: rec.state.wrapUpReason });
    yield* this.finishIfEnded(rec);
    yield this.emit(rec, { t: "turn_end", stateVersion: rec.state.stateVersion, expect: isEnded(rec) ? "end" : "learner" });
    yield* this.persist(rec, rev);
  }
}

// Function call so TypeScript doesn't keep an earlier `phase !== ENDED` narrowing after state mutations.
const isEnded = (r: SessionRecord): boolean => r.state.phase === "ENDED";

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
