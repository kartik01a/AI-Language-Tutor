import type { LlmProvider, LlmUsage, SttProvider, SttResult } from "@/lib/providers/types";
import { createInitialState, step } from "./dialogue-machine";
import { applyGates, hasNonTargetTokens, type ClipInfo, type GateOutcome, type GateThresholds } from "./gates";
import { buildTurnPrompt, type PromptContext } from "./prompt";
import { reconcileCategory, turnOutputSchema, turnCoreSchema, type LlmCategory, type TurnOutput } from "./schemas";
import { strictJsonSchema } from "@/lib/providers/json-schema";
import type { DialogueState, MachineConfig, PolicyAction, TurnCategory } from "./types";
import { validateReply } from "./output-validation";

// Orchestrates one learner turn: STT → gates → LLM → reconcile → dialogue machine.
// Providers are injected, so the whole decision path is testable with fakes.

const LLM_TO_TURN: Record<LlmCategory, TurnCategory> = {
  understood: "UNDERSTOOD",
  partially_understood: "AMBIGUOUS",
  not_understood: "UNCLEAR_AUDIO",
  off_topic: "UNDERSTOOD_OFF_TOPIC",
  native_language_help: "L1_HELP_REQUEST",
  native_language_answer: "L1_ANSWER",
  dont_know: "DONT_KNOW",
  meta_request: "META_REQUEST",
  unsafe: "UNSAFE",
};

export interface TurnDeps {
  stt: SttProvider;
  llm: LlmProvider;
  machine: MachineConfig;
  minSpeechMs: number;
  thresholds?: GateThresholds;
}

export interface TurnInput {
  state: DialogueState;
  audio: Uint8Array;
  mime: string;
  clip: ClipInfo;
  target: "ja" | "de" | "en";
  /**
   * Continue a turn whose transcript the learner has already confirmed ("Did you say …?" → Yes):
   * skips speech-to-text and the confidence gates, which are what asked for the confirmation.
   * Word confidences are kept, so corrections on shaky words stay blocked.
   */
  precomputed?: { asr: SttResult; gate: GateOutcome };
  /** Treat a pre-computed transcript as rejected (the learner answered "No"). */
  rejectAs?: "UNCLEAR_AUDIO";
  prompt: Omit<PromptContext, "asr" | "gate" | "allowedActions">;
}

export interface TurnResult {
  category: TurnCategory;
  action: PolicyAction;
  close: boolean;
  state: DialogueState;
  asr: SttResult | null;
  gate: GateOutcome | null;
  analysis: TurnOutput | null;
  /** Reply text only when the action uses the LLM's reply (never for templates). */
  replySentences: string[] | null;
  replyIssues: string[];
  /**
   * True when the model itself judged the turn partially understood, so its reply is a targeted
   * confirmation question to speak instead of the generic "say it again" template. NOT set when code
   * downgraded the model's "understood" (borderline confidence): that reply assumed understanding.
   */
  modelClarification: boolean;
  usage: LlmUsage[];
  gateReason: string | null;
  /** Wall-clock ms spent in each provider call (null when the stage didn't run). */
  timings: { sttMs: number | null; llmMs: number | null };
  /** Which provider failed and why (for logs/diagnostics; never shown to learners in production). */
  providerError: { stage: "stt" | "llm"; message: string } | null;
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e)).slice(0, 200);

const LLM_REPLY_ACTIONS = new Set([
  "RESPOND", "ACKNOWLEDGE_REPETITION", "REPHRASE_QUESTION", "TEACH_PHRASE", "MODEL_IN_TARGET", "HINT",
  "MODEL_ANSWER_AND_MOVE_ON", "SUGGEST_AND_MOVE_ON", "EXPLAIN_WORD",
]);

export const TURN_SCHEMA = { name: "turn_output", jsonSchema: strictJsonSchema(turnCoreSchema) };

async function callLlmWithRepair(llm: LlmProvider, req: { system: string; user: string }, usage: LlmUsage[]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    // Latency-critical: no reasoning (docs/04 §4).
    const r = await llm.turn({ ...req, schema: TURN_SCHEMA, effort: "none" });
    usage.push(r.usage);
    const parsed = turnOutputSchema.safeParse(r.json);
    if (parsed.success) return parsed.data;
  }
  throw new Error("LLM returned invalid output twice");
}

export async function processLearnerTurn(deps: TurnDeps, input: TurnInput): Promise<TurnResult> {
  const usage: LlmUsage[] = [];
  const timings: TurnResult["timings"] = { sttMs: null, llmMs: null };
  const finish = (
    category: TurnCategory,
    extra: Partial<Pick<TurnResult, "asr" | "gate" | "analysis" | "gateReason" | "replySentences" | "replyIssues" | "providerError">> = {},
    event: Parameters<typeof step>[1] = { type: "learner_turn", category },
  ): TurnResult => {
    const r = step(input.state, event, deps.machine);
    return {
      category,
      action: r.action,
      close: r.close,
      state: r.state,
      asr: null,
      gate: null,
      analysis: null,
      replySentences: null,
      replyIssues: [],
      modelClarification: false,
      usage,
      gateReason: null,
      timings,
      providerError: null,
      ...extra,
    };
  };

  // 0. The learner answered a "Did you say …?" prompt.
  if (input.precomputed && input.rejectAs) {
    return finish(input.rejectAs, { asr: input.precomputed.asr, gate: input.precomputed.gate, gateReason: "learner_rejected_transcript" });
  }

  // 1. Speech to text (skipped when the learner already confirmed a transcript).
  //    A provider failure is NOT the learner's fault.
  let asr: SttResult;
  if (input.precomputed) {
    asr = input.precomputed.asr;
  } else {
    if (input.clip.speechMs < deps.minSpeechMs || input.clip.clipMs < 800) {
      // Don't even pay for STT on silence (docs/06 G1).
      return finish("NO_SPEECH", { gateReason: "too_short_or_silent" });
    }
    const t0 = Date.now();
    try {
      // One quick retry: most speech-to-text failures are transient network blips.
      try {
        asr = await deps.stt.transcribe(input.audio, input.mime, [input.target, "en"]);
      } catch {
        asr = await deps.stt.transcribe(input.audio, input.mime, [input.target, "en"]);
      }
    } catch (e) {
      return finish("PROVIDER_ERROR", { providerError: { stage: "stt", message: errorMessage(e) } });
    } finally {
      timings.sttMs = Date.now() - t0;
    }
  }

  // 2. Deterministic gates (already passed, with the learner's confirmation, for a pre-computed transcript).
  const gate = input.precomputed
    ? input.precomputed.gate
    : applyGates(input.clip, asr, { minSpeechMs: deps.minSpeechMs, allowedLangs: [input.target, "en", "hi"], thresholds: deps.thresholds });
  if (gate.rejected && !input.precomputed) return finish(gate.rejected, { asr, gate, gateReason: gate.reason });

  // 3. LLM turn call (analysis first), with one repair retry on invalid JSON.
  let out: TurnOutput;
  try {
    const prompt = buildTurnPrompt({ ...input.prompt, asr, gate, allowedActions: [], confirmed: !!input.precomputed && !input.rejectAs });
    const t0 = Date.now();
    try {
      out = await callLlmWithRepair(deps.llm, prompt, usage);
    } finally {
      timings.llmMs = Date.now() - t0;
    }
  } catch (e) {
    return finish("PROVIDER_ERROR", { asr, gate, providerError: { stage: "llm", message: errorMessage(e) } });
  }

  // 4. Reconcile the model's claim with the evidence, then let the machine decide.
  const llmCategory = reconcileCategory(out, {
    borderlineConfidence: gate.borderline,
    hasNonTargetTokens: hasNonTargetTokens(asr, input.target),
  });
  const category = LLM_TO_TURN[llmCategory];
  const result = finish(
    category,
    { asr, gate, analysis: out },
    {
      type: "learner_turn",
      category,
      offTopicReason: out.analysis.off_topic_reason ?? undefined,
      metaKind: out.analysis.meta.kind ?? undefined,
      phrase: out.reply.teach_phrase?.text,
      topic: out.analysis.topic ? { label: out.analysis.topic, source: "spoken" as const } : undefined,
    },
  );

  // 5. Validate the LLM reply only if the chosen action actually uses it.
  if (LLM_REPLY_ACTIONS.has(result.action.kind)) {
    const check = validateReply(out.reply.sentences, { lang: input.target, level: input.prompt.level });
    result.replySentences = out.reply.sentences;
    result.replyIssues = check.issues;
  }
  const modelClarifies = result.action.kind === "CLARIFY" && category === "AMBIGUOUS" && out.analysis.category === "partially_understood";
  if (modelClarifies) {
    const check = validateReply(out.reply.sentences, { lang: input.target, level: input.prompt.level });
    // Only a well-formed single confirmation question is spoken; anything else falls back to the template.
    if (check.ok) {
      result.modelClarification = true;
      result.replySentences = out.reply.sentences;
    }
    result.replyIssues = check.issues;
  }
  return result;
}

export { createInitialState };
