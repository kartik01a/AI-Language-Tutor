import type { Level } from "./corrections";

// Checks run on every generated reply before TTS (docs/06 §9). Budgets are
// provisional assumptions to be tuned in Phase 2.

export type Lang = "ja" | "de" | "en";

const WORD_BUDGET: Record<Level, number> = { A1: 12, A2: 30, B1: 45, B2: 60 };
const JA_CHAR_BUDGET: Record<Level, number> = { A1: 30, A2: 65, B1: 90, B2: 120 };
const TOLERANCE = 1.3;

const JA_RE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/g;
const LATIN_RE = /[A-Za-zÄÖÜäöüß]/g;
const QUESTION_COUNT_RE = /[?？]/g;
const QUESTION_CHAR_RE = /[?？]/;
const JA_UNIT_RE = /[\u3040-\u30ff\u3400-\u9fffー]/g;

export function countUnits(text: string, lang: Lang): number {
  if (lang === "ja") return (text.match(JA_UNIT_RE) ?? []).length;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function targetScriptRatio(text: string, lang: Lang): number {
  const letters = text.match(lang === "ja" ? JA_RE : LATIN_RE)?.length ?? 0;
  const other = lang === "ja" ? (text.match(LATIN_RE)?.length ?? 0) : (text.match(JA_RE)?.length ?? 0);
  const total = letters + other;
  return total === 0 ? 1 : letters / total;
}

export type ValidationIssue =
  | "too_long"
  | "wrong_language"
  | "question_count"
  | "question_not_last";

export interface ReplyCheck {
  ok: boolean;
  issues: ValidationIssue[];
}

export function validateReply(sentences: string[], opts: { lang: Lang; level: Level }): ReplyCheck {
  const issues: ValidationIssue[] = [];
  const full = sentences.join(" ");

  const budget = (opts.lang === "ja" ? JA_CHAR_BUDGET : WORD_BUDGET)[opts.level] * TOLERANCE;
  if (countUnits(full, opts.lang) > budget) issues.push("too_long");

  if (targetScriptRatio(full, opts.lang) < 0.7) issues.push("wrong_language");

  const questions = full.match(QUESTION_COUNT_RE)?.length ?? 0;
  if (questions !== 1) issues.push("question_count");
  else if (!QUESTION_CHAR_RE.test(sentences[sentences.length - 1].trim().slice(-1))) {
    issues.push("question_not_last");
  }

  return { ok: issues.length === 0, issues };
}

/** Phantom STT phrases that must never be treated as learner speech (docs/06 §4.1 G2). */
const PHANTOM = [
  /ご視聴ありがとうございました/,
  /チャンネル登録/,
  /ご覧いただきありがとうございます/,
  /thanks? for watching/i,
  /^\s*(you|bye\.?|thank you\.?)\s*$/i,
  /vielen dank f(ü|u)r(s)? (das )?(zuschauen|zusehen)/i,
  /untertitel(ung)?\b.*(zdf|amara)/i,
];

export function isPhantomTranscript(text: string): boolean {
  const t = text.trim();
  if (t === "") return true;
  if (PHANTOM.some((re) => re.test(t))) return true;
  // Repetition loop: same chunk repeated many times.
  const chunks = t.split(/[\s、。,.!！？?]+/).filter(Boolean);
  if (chunks.length >= 6 && new Set(chunks).size <= Math.ceil(chunks.length / 4)) return true;
  return false;
}
