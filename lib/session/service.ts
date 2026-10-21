import { budgetStatus, llmCost, monthKey, sttCost, ttsCost, azureBillableChars, type SpendStore } from "@/lib/limits/budget";
import type { AppConfig } from "@/lib/config";
import type { ServerEvent, ErrorCode, TurnDiagnostic } from "@/lib/contracts/events";
import type { LlmProvider, SttProvider, SttResult, TtsProvider } from "@/lib/providers/types";
import type { GateOutcome } from "@/lib/tutor/gates";
import { createInitialState, step } from "@/lib/tutor/dialogue-machine";
import { processLearnerTurn } from "@/lib/tutor/turn-pipeline";
import { fastPathRecastAllowed, runCorrectionPipeline } from "@/lib/tutor/correction-pipeline";
import { YUKI_CHIPS, YUKI_CLOSING, YUKI_GREETING, NUDGE_LINE, confirmLine, tidyHeard, templateFor, type Spoken } from "@/lib/tutor/templates";
import { TUTORS } from "@/lib/tutor/tutors";
import type { Level, Strictness } from "@/lib/tutor/corrections";
import type { DialogueEvent, MachineConfig, StepResult } from "@/lib/tutor/types";
import type { HistoryItem, SessionRecord, SessionStore } from "./store";
import type { ClientEvent } from "@/lib/contracts/events";
import { initialSkills, summariseSession, type SessionSummary } from "@/lib/learning/summary";

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
      currentQuestion: null, lastActivityAt: this.now(), seq: 0, costUsd: 0, reports: [], pendingConfirm: null,
      metrics: { learnerSpeechMs: 0, learnerTurns: 0, unclearTurns: 0, providerErrors: 0, maxHintLevel: 0, hintsUsed: 0, wordsIntroduced: [] },
      skills: initialSkills(input.level), summary: null,
      endEmitted: false, rev: 0,
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

  private async *speak(rec: SessionRecord, lines: Spoken[], role: "template" | "reply", messageId: string, trackContext = true): AsyncGenerator<OutFrame> {
    const tutor = TUTORS[rec.tutorId];
    const voice = { ...tutor.voice, rate: tutor.voice.rateByLevel[rec.level] };
    // Synthesise every sentence at once; emit them in order. The first sentence is never delayed
    // by the others, and later ones are ready by the time the previous finishes playing.
    const pending = lines.map((line) => {
      const p = this.d.tts.synthesize(line.text, voice);
      p.catch(() => {}); // a later failure surfaces when we reach that sentence, never as an unhandled rejection
      return p;
    });
    let index = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const r = await pending[i];
      await this.addSpend(rec, ttsCost("azure-standard", azureBillableChars(line.text)));
      yield this.emit(rec, {
        t: "sentence", messageId, index: index++, text: line.text, translation: line.translation, role,
        audio: { format: r.format, durationMs: r.durationMs }, visemes: r.visemes,
      });
      yield { kind: "audio", bytes: r.audio };
      // A confirmation prompt is not part of the conversation: it must not become "the last question".
      if (trackContext) rec.history.push({ role: "tutor", text: line.text } as HistoryItem);
    }
    const last = lines[lines.length - 1];
    if (last && trackContext) rec.currentQuestion = { text: last.text, expects: "open" };
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

  /** End-of-session analysis. Computed once, after the conversation has ended. */
  async summarise(sessionId: string): Promise<SessionSummary> {
    const { rec, rev } = await this.load(sessionId);
    if (rec.state.phase !== "ENDED") throw new ServiceError("SESSION_NOT_ENDED", "The conversation is still going.");
    if (rec.summary) return rec.summary;

    const reported = new Set(rec.reports.map((r) => r.cardId));
    const m = rec.metrics;
    const stored = await this.d.store.listCorrections(rec.id);
    const sentences: Record<string, string> = {};
    for (const e of stored) for (const c of e.cards) sentences[c.id] = e.learnerText;
    const { summary, usage } = await summariseSession({
      llm: this.d.llm,
      endReason: rec.state.endReason ?? "time",
      learnerLines: rec.history.filter((h) => h.role === "learner").map((h) => h.text),
      cards: stored.flatMap((c) => c.cards),
      sentences,
      level: rec.level,
      reportedCardIds: reported,
      metrics: m,
      skills: rec.skills,
      nonUnderstandingRate: m.learnerTurns === 0 ? 0 : m.unclearTurns / m.learnerTurns,
    });
    for (const u of usage) await this.addSpend(rec, llmCost("gpt-6-luna", u));
    rec.summary = summary;
    rec.skills = summary.skills;
    // If a concurrent request already stored a summary, prefer that one.
    const ok = await this.d.store.put(rec, rev);
    if (!ok) {
      const again = await this.d.store.get(sessionId);
      if (again?.summary) return again.summary;
    }
    return summary;
  }

  // ---------- events ----------

  /**
   * The learner answered "Did you say …?". Yes continues the turn with the heard transcript (its word
   * confidences are kept, so corrections on shaky words stay blocked); No is treated as unclear.
   */
  private async *confirmHeard(sessionId: string, yes: boolean): AsyncGenerator<OutFrame> {
    const { rec, rev } = await this.load(sessionId);
    const pending = rec.pendingConfirm;
    if (rec.state.phase === "ENDED" || !pending) {
      yield this.emit(rec, { t: "turn_end", stateVersion: rec.state.stateVersion, expect: isEnded(rec) ? "end" : "learner" });
      return;
    }
    rec.pendingConfirm = null; // consume exactly once, even if the client retries
    if (!(await this.d.store.put(rec, rev))) {
      yield this.emit(rec, { t: "error", code: "STATE_CONFLICT", retryable: true, message: "Session changed elsewhere; please retry." });
      return;
    }
    yield* this.handleTurn(sessionId, new Uint8Array(0), pending.mime, pending.clip, {
      precomputed: { asr: pending.asr, gate: pending.gate },
      rejectAs: yes ? undefined : "UNCLEAR_AUDIO",
      turnId: pending.turnId,
    });
  }

  async *handleEvent(sessionId: string, ev: ClientEvent): AsyncGenerator<OutFrame> {
    if (ev.e === "confirm_heard") {
      yield* this.confirmHeard(sessionId, ev.yes);
      return;
    }
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
          rec.metrics.hintsUsed++;
          rec.metrics.maxHintLevel = Math.max(rec.metrics.maxHintLevel, r.action.level);
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
      case "card_report": {
        // Reports feed the evaluation set and auto-disable noisy categories (docs/06 §11).
        rec.reports.push({ cardId: ev.cardId, reason: ev.reason });
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
    opts: { precomputed?: { asr: SttResult; gate: GateOutcome }; rejectAs?: "UNCLEAR_AUDIO"; turnId?: string } = {},
  ): AsyncGenerator<OutFrame> {
    const { rec, rev } = await this.load(sessionId);
    // A fresh recording supersedes an unanswered "Did you say …?" (it already used up an attempt).
    if (!opts.precomputed) rec.pendingConfirm = null;
    if (rec.state.phase === "ENDED") {
      yield this.emit(rec, { t: "error", code: "SESSION_ENDED", retryable: false, message: "This conversation has ended." });
      return;
    }
    const messageId = this.newId();
    const turnId = opts.turnId ?? this.newId();
    const started = performance.now();
    let firstAudioMs: number | null = null;

    this.accrueTime(rec);
    const b = await budgetStatus(this.d.spend, this.d.config.AI_MONTHLY_BUDGET_USD, new Date(this.now()));
    if (b.status === "exhausted") this.applyStep(rec, { type: "limit_reached", reason: "budget" });

    const tutor = TUTORS[rec.tutorId];
    const result = await processLearnerTurn(
      { stt: this.d.stt, llm: this.d.llm, machine: this.machine, minSpeechMs: this.d.config.MIN_SPEECH_MS },
      {
        state: rec.state, audio, mime, clip, target: "ja", precomputed: opts.precomputed, rejectAs: opts.rejectAs,
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
    if (result.asr && !opts.precomputed) await this.addSpend(rec, sttCost("deepgram-nova-3", clip.clipMs / 1000));
    for (const u of result.usage) await this.addSpend(rec, llmCost("gpt-6-luna", u));

    // What the learner sees: unclear turns never show a confident-looking transcript.
    // "Unclear" (transcript hidden) means we could not trust what was heard. When the recogniser was
    // confident and only the model wanted confirmation, the learner can see what we heard.
    const confirming = result.category === "CONFIRM_HEARD";
    const unclear = result.category === "NO_SPEECH" || result.category === "UNCLEAR_AUDIO" || (result.category === "AMBIGUOUS" && !result.modelClarification);
    const diagnostic: TurnDiagnostic = {
      reason: result.gateReason ?? (unclear ? "model_not_confident" : null),
      heard: result.asr?.text ?? null,
      lang: result.asr?.lang ?? null,
      meanConf: result.gate?.meanConf ?? null,
      speechMs: Math.round(clip.speechMs),
      clipMs: Math.round(clip.clipMs),
      sttMs: result.timings.sttMs,
    };
    // Structured log without the transcript text (docs/14): enough to debug "it didn't hear me".
    console.info("[turn]", JSON.stringify({ session: rec.id.slice(0, 8), category: result.category, action: result.action.kind, reason: diagnostic.reason, meanConf: diagnostic.meanConf, speechMs: diagnostic.speechMs, clipMs: diagnostic.clipMs, sttMs: diagnostic.sttMs, words: result.asr?.words.length ?? 0 }));
    yield this.emit(rec, {
      t: "transcript", turnId,
      // While asking "Did you say …?" the heard text is shown tentatively; once confirmed it becomes the turn.
      text: result.asr && confirming ? tidyHeard(result.asr.text) : result.asr && !unclear ? result.asr.text.replace(/ /g, "") : null,
      display: confirming ? "confirm" : unclear ? "unclear" : "normal", riskSpans: result.gate?.riskSpans ?? [],
      ...(process.env.NODE_ENV !== "production" ? { diagnostic } : {}),
    });
    if (result.asr && !unclear && !confirming) rec.history.push({ role: "learner", text: result.asr.text.replace(/ /g, "") });
    if (confirming && result.asr && result.gate) {
      rec.pendingConfirm = { turnId, asr: result.asr, gate: result.gate, clip, mime };
    }
    yield this.emit(rec, { t: "category", category: result.category, action: result.action.kind });

    if (result.analysis) {
      rec.lastHints = result.analysis.hints;
      for (const w of result.analysis.words_introduced) {
        if (!rec.metrics.wordsIntroduced.some((x) => x.lemma === w.lemma)) rec.metrics.wordsIntroduced.push(w);
      }
    }
    // A confirmation prompt is not a turn: the learner's "Yes" (or "No") is.
    if (result.category !== "PROVIDER_ERROR" && !confirming) {
      rec.metrics.learnerTurns++;
      rec.metrics.learnerSpeechMs += clip.speechMs;
    }
    if (unclear) rec.metrics.unclearTurns++;
    if (result.category === "PROVIDER_ERROR") rec.metrics.providerErrors++;

    // Corrections start now, in parallel with the tutor speaking, and never block the reply.
    const allowCorrections =
      result.category === "UNDERSTOOD" && result.asr !== null && result.gate !== null &&
      (result.action.kind === "RESPOND" || result.action.kind === "ACKNOWLEDGE_REPETITION") && result.action.allowCorrections;
    const counts: Record<string, number> = {};
    for (const entry of await this.d.store.listCorrections(rec.id)) for (const c of entry.cards) counts[c.errorCode] = (counts[c.errorCode] ?? 0) + 1;
    const recurrent = new Set(Object.entries(counts).filter(([, n]) => n >= 2).map(([c]) => c));
    const correctionsP = allowCorrections && result.asr && result.gate
      ? runCorrectionPipeline(this.d.llm, {
          words: result.asr.words, lang: "ja", level: rec.level, strictness: rec.strictness,
          riskSpans: result.gate.riskSpans, recurrent, relaxedRecastTurn: rec.metrics.learnerTurns % 2 === 0,
        }).catch(() => null)
      : null;

    // Spoken recast: only via the fast path's strict checks (never ASR-fragile, never near a risky word).
    let recast: Spoken | null = null;
    if (allowCorrections && result.analysis && result.asr && result.gate && result.analysis.reply.recast) {
      const ok = fastPathRecastAllowed(result.analysis.analysis.recast_candidate, {
        words: result.asr.words, riskSpans: result.gate.riskSpans, level: rec.level, strictness: rec.strictness,
        relaxedRecastTurn: rec.metrics.learnerTurns % 2 === 0, recurrent,
      });
      if (ok) recast = { text: result.analysis.reply.recast, translation: "" };
    }

    // What the tutor says: a template for recovery actions, the validated LLM reply otherwise.
    const example = rec.lastHints ? { text: rec.lastHints.example, translation: rec.lastHints.example_translation } : undefined;
    const tmpl = result.modelClarification ? null : templateFor(result.action, { example, silent: result.category === "NO_SPEECH" });
    // First audio = the moment the first audio frame is ready to leave the server.
    const timed = async function* (gen: AsyncGenerator<OutFrame>): AsyncGenerator<OutFrame> {
      for await (const f of gen) {
        if (f.kind === "audio" && firstAudioMs === null) firstAudioMs = Math.round(performance.now() - started);
        yield f;
      }
    };
    if (confirming && result.asr) {
      yield* timed(this.speak(rec, [confirmLine(result.asr.text)], "template", messageId, false));
    } else if (tmpl !== null) {
      yield* timed(this.speak(rec, tmpl, "template", messageId));
    } else if (result.replySentences && result.analysis) {
      const tr = result.analysis.reply.translation;
      const lines: Spoken[] = result.replySentences.map((text, i) => ({ text, translation: tr[i] ?? "" }));
      yield* timed(this.speak(rec, recast ? [recast, ...lines] : lines, "reply", messageId));
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
    yield* this.persist(rec, rev);
    yield this.emit(rec, {
      t: "turn_end", stateVersion: rec.state.stateVersion, expect: isEnded(rec) ? "end" : "learner",
      latency: { sttMs: result.timings.sttMs, llmMs: result.timings.llmMs, firstAudioMs, totalMs: Math.round(performance.now() - started) },
    });

    // Corrections finish after the learner can already speak again (docs/11 §3.4 allows this): the
    // stream stays open for them. They go to their own store, so they never contend with the next turn.
    if (correctionsP) {
      const out = await correctionsP;
      if (out) {
        // Correction-call cost goes to the global monthly spend (the kill switch); per-session cost
        // attribution moves to the usage ledger when the database store lands.
        for (const u of out.usage) await this.d.spend.add(monthKey(new Date(this.now())), llmCost("gpt-6-luna", u));
        const cards = out.cards.map((c) => ({ ...c, id: `${turnId}-${c.id}` }));
        await this.d.store.addCorrection(rec.id, { turnId, learnerText: result.asr?.text.replace(/ /g, "") ?? "", cards, dropped: out.dropped });
        if (cards.length > 0) yield this.emit(rec, { t: "corrections", turnId, cards });
      }
    }
  }
}

// Function call so TypeScript doesn't keep an earlier `phase !== ENDED` narrowing after state mutations.
const isEnded = (r: SessionRecord): boolean => r.state.phase === "ENDED";

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
