import type { Level, Strictness } from "./corrections";
import type { TutorConfig } from "./tutors";
import type { SttResult } from "@/lib/providers/types";
import type { GateOutcome } from "./gates";
import { annotateTranscript } from "./gates";

// Prompt architecture (docs/06 §3): a static, cacheable prefix + a dynamic suffix.
// The static prefix must be byte-identical across turns for a given tutor × level.

export const PROMPT_VERSION = "turn@1";

const LEVEL_RULES: Record<Level, string> = {
  A1: "1–2 very short sentences (≤12 words). High-frequency words only. Prefer yes/no or either/or questions.",
  A2: "At most 2 short sentences (≤20 words). Simple wh-questions about routine and personal topics.",
  B1: "At most 3 sentences. Open questions: why / how / tell me about.",
  B2: "At most 3–4 sentences. Opinions, pros and cons, hypotheticals.",
};

export function buildStaticPrefix(tutor: TutorConfig, level: Level): string {
  return [
    `You are ${tutor.name}, a language tutor and conversation partner. You are an AI tutor; never claim to be human.`,
    `Persona: ${tutor.persona.summary}`,
    `Speaking style: ${tutor.persona.speakingStyle}`,
    `Never: ${tutor.persona.forbidden.join("; ")}.`,
    `Register: ${tutor.register}`,
    "",
    "TEACHING RULES",
    "- Speak ONLY the target language in `reply.sentences`. Put English explanations in `translation`.",
    `- Level ${level}: ${LEVEL_RULES[level]}`,
    "- Structure each reply: optional brief reaction, a brief content response, then EXACTLY ONE question at the end.",
    "- Never answer your own question. Let the learner do most of the talking.",
    "",
    "UNDERSTANDING RULES (most important)",
    "- The learner transcript has per-word confidence in parentheses. Low-confidence words may have been MISHEARD.",
    "- NEVER treat a low-confidence word as the learner's mistake. If meaning depends on it, classify `partially_understood` and ask a confirmation question.",
    "- NEVER pretend to understand. If unsure, use `partially_understood` or `not_understood`.",
    "- A different but valid way of saying something is NOT an error. Indian English features are valid, not errors.",
    "- A name, place or loanword the learner introduces (e.g. \"カルテックです\") is accepted as heard: you cannot verify names, and an unfamiliar-but-plausible word is NOT a reason to say partially_understood. Greet the learner by that name.",
    "- Use `partially_understood` only when the recogniser was confident but you genuinely cannot tell what the learner meant. Then your reply must be ONE short confirmation question that quotes what you heard (e.g. 「…」ですか？) and must not assume the answer.",
    "- If the learner uses English (or another language) to ask how to say something, classify `native_language_help`.",
    "- Do not state or imply corrections inside `reply.sentences`. A single short echo of the correct form may go in `reply.recast` only for a clear error in a confidently recognised word.",
    "",
    "OUTPUT",
    "Return JSON matching the provided schema exactly. Fill `analysis` first, then `reply`, then `hints` (for the question you just asked), then `words_introduced`.",
  ].join("\n");
}

export interface PromptContext {
  tutor: TutorConfig;
  level: Level;
  strictness: Strictness;
  learner: { firstName: string; recurringMistakes: string[] };
  session: {
    topic: string | null;
    goals: string[];
    simplifyMode: boolean;
    wrapUp: boolean;
    history: { role: "tutor" | "learner"; text: string; notHeard?: boolean }[];
    currentQuestion: { text: string; expects: "open" | "closed" | "repetition" | "topic" } | null;
  };
  asr: SttResult;
  gate: GateOutcome;
  allowedActions: string[];
}

export function buildTurnPrompt(ctx: PromptContext): { system: string; user: string } {
  const { session, gate } = ctx;
  const history = session.history
    .slice(-8)
    .map((h) => `${h.role === "tutor" ? ctx.tutor.name : "Learner"}: ${h.text}${h.notHeard ? " [learner did not hear the rest: interrupted]" : ""}`)
    .join("\n");

  const user = [
    `Learner: ${ctx.learner.firstName} | level ${ctx.level} | correction strictness ${ctx.strictness}`,
    ctx.learner.recurringMistakes.length ? `Recurring mistakes: ${ctx.learner.recurringMistakes.slice(0, 2).join(", ")}` : "Recurring mistakes: none yet",
    `Topic: ${session.topic ?? "(learner is choosing a topic)"}`,
    session.goals.length ? `Private goals: ${session.goals.join("; ")}` : "",
    session.simplifyMode ? "SIMPLIFY MODE: use simpler vocabulary and closed questions." : "",
    session.wrapUp ? "WRAP-UP: respond to the learner briefly and close politely. Do NOT ask a new question or open a new topic." : "",
    "",
    "Conversation so far:",
    history || "(start)",
    session.currentQuestion ? `Your last question (expects ${session.currentQuestion.expects}): ${session.currentQuestion.text}` : "",
    "",
    `Learner transcript (word(confidence)): ${annotateTranscript(ctx.asr)}`,
    `Recogniser: mean confidence ${gate.meanConf === null ? "unknown" : gate.meanConf.toFixed(2)}; low-confidence word positions: ${gate.riskSpans.length ? gate.riskSpans.map(([s, e]) => (e - s === 1 ? `${s}` : `${s}-${e - 1}`)).join(", ") : "none"}`,
    "",
    `Allowed actions this turn: ${ctx.allowedActions.join(", ") || "any"}`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { system: buildStaticPrefix(ctx.tutor, ctx.level), user };
}
