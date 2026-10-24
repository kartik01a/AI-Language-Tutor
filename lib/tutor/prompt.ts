import type { Level, Strictness } from "./corrections";
import { taxonomyFor } from "@/lib/learning/taxonomy";
import type { TutorConfig } from "./tutors";
import type { SttResult } from "@/lib/providers/types";
import type { GateOutcome } from "./gates";
import { annotateTranscript } from "./gates";

// Prompt architecture (docs/06 §3): a static, cacheable prefix + a dynamic suffix.
// The static prefix must be byte-identical across turns for a given tutor × level.

export const PROMPT_VERSION = "turn@2";

const LEVEL_RULES: Record<Level, string> = {
  A1: "1–2 very short sentences (≤12 words). High-frequency words only. Prefer yes/no or either/or questions.",
  A2: "2–3 short sentences (≤30 words in total). Simple wh-questions about routine and personal topics.",
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
    "- Speak ONLY the target language in `reply.sentences`. Leave `reply.translation` as an empty array: translations are produced separately.",
    "- `topic`: the subject the learner wants to talk about (e.g. food, travel), or null if they have not chosen one yet (a greeting or their name is NOT a topic). While the topic is null, greet them back and ask what they would like to talk about.",
    `- Level ${level}: ${LEVEL_RULES[level]}`,
    "- Never answer your own question. Let the learner do most of the talking.",
    "",
    "CONVERSATION STYLE (you are a friendly tutor chatting, NOT an interviewer firing questions)",
    "- React to what the learner actually said: pick up ONE concrete detail and respond like a friend would (specific, not just いいですね).",
    "- Then add one short thing about yourself or a related fact that fits your persona, so it feels like a two-way chat.",
    "- Then ask EXACTLY ONE natural follow-up question that builds on their answer (not an unrelated new question). The question is the last sentence.",
    "- Keep the language simple for the level, in your polite speaking style.",
    "",
    "TUTORING (you are also their teacher)",
    "- If the learner's sentence has a clear grammar mistake, or is an unfinished sentence (missing the verb or です, or a dropped particle), AND the words involved were recognised with high confidence: set `analysis.recast_candidate` to the smallest edit (`original` and `corrected` are the exact words) using one of the ERROR CODES below, and set `reply.recast` to ONLY the learner's whole sentence, corrected and natural for their level (no quotes, no phrases like 'you can say'). The system says it aloud before your reply, so do NOT repeat or hint at the correction in `reply.sentences` (do not silently re-say the fixed sentence either): just carry on the conversation.",
    "  Example: learner 「昨日、公園を行きました」 → recast_candidate {error_code: ja.particle.destination, original: を, corrected: に}, recast 「昨日、公園に行きました」.",
    "  Example: learner 「昨日、ラーメン」 (unfinished) → recast_candidate {error_code: ja.sentence.incomplete, original: 昨日ラーメン, corrected: 昨日ラーメンを食べました}, recast 「昨日、ラーメンを食べました」.",
    "- Grammar mistakes and unfinished sentences do NOT make a turn `partially_understood`: if you can tell what the learner meant, it is `understood`, and you fix it as above. Use `partially_understood` only when you cannot tell what they meant.",
    "- Never correct: a valid short answer (「ラーメンです」, 「はい」), a name or loanword, a valid variant, or any low-confidence word. If unsure, leave both null.",
    "- If the learner asks for help or a hint (e.g. 'hint', 'ヒント', 'help', 'what do I say', 「わかりません」), classify `dont_know`.",
    "",
    "ERROR CODES (use exactly these for `recast_candidate.error_code`):",
    ...taxonomyFor(tutor.language).map((t) => `- ${t.code}: ${t.cardRule} (e.g. ${t.example.wrong} → ${t.example.right})`),
    "",
    "UNDERSTANDING RULES (most important)",
    "- The learner transcript has per-word confidence in parentheses. Low-confidence words may have been MISHEARD.",
    "- NEVER treat a low-confidence word as the learner's mistake. If meaning depends on it, classify `partially_understood` and ask a confirmation question.",
    "- NEVER pretend to understand. If unsure, use `partially_understood` or `not_understood`.",
    "- A different but valid way of saying something is NOT an error. Indian English features are valid, not errors.",
    "- A name, place or loanword the learner introduces (e.g. \"カルテックです\") is accepted as heard: you cannot verify names, and an unfamiliar-but-plausible word is NOT a reason to say partially_understood. Greet the learner by that name with さん (e.g. 「カルティさん、はじめまして！」). Never say it as if it were YOUR name: you are always the tutor, not the learner.",
    "- Use `partially_understood` only when the recogniser was confident but you genuinely cannot tell what the learner meant. Then your reply must be ONE short confirmation question that quotes what you heard (e.g. 「…」ですか？) and must not assume the answer.",
    "- If the learner uses English (or another language) to ask how to say something, classify `native_language_help`.",
    "- Do not state or imply corrections inside `reply.sentences`; corrections go only in `reply.recast`.",
    "",
    "OUTPUT",
    "Return JSON matching the provided schema exactly. Fill `analysis` first, then `reply`.",
    "Be terse in `analysis`, because every word you write is time the learner waits: `meaning_summary` is at most 5 English words; `recovered_fragment` is null unless the category is partially_understood; keep `goal_progress` empty unless a goal was clearly achieved.",
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
  /** The learner answered "Yes" to "Did you say …?" for this transcript. */
  confirmed?: boolean;
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
    ctx.confirmed ? "The learner CONFIRMED that this transcript is what they said (the recogniser was unsure, so you asked). Treat the words as correct; do not ask again whether you heard them right." : "",
    `Allowed actions this turn: ${ctx.allowedActions.join(", ") || "any"}`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { system: buildStaticPrefix(ctx.tutor, ctx.level), user };
}
