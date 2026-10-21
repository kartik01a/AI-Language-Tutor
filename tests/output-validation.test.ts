import { describe, expect, it } from "vitest";
import { isPhantomTranscript, validateReply } from "@/lib/tutor/output-validation";
import { reconcileCategory, turnOutputSchema, type TurnOutput } from "@/lib/tutor/schemas";

const baseOut = (over: Partial<TurnOutput["analysis"]> = {}): TurnOutput => ({
  analysis: {
    category: "understood", topic: null, meaning_summary: "likes ramen", recovered_fragment: null,
    off_topic_reason: null, meta: { kind: null, word: null }, goal_progress: [], recast_candidate: null, ...over,
  },
  reply: { recast: null, sentences: ["いいですね！", "何が好きですか？"], translation: [], teach_phrase: null },
  hints: { hint: "h", starter: "s", example: "e", example_translation: "t" },
  words_introduced: [],
});

describe("reply validation", () => {
  it("accepts a short polite Japanese reply with one final question", () => {
    expect(validateReply(["いいですね！", "どんなラーメンが好きですか？"], { lang: "ja", level: "A2" }).ok).toBe(true);
  });
  it("flags more than one question or a question that isn't last", () => {
    expect(validateReply(["何が好きですか？", "なぜですか？"], { lang: "ja", level: "B1" }).issues).toContain("question_count");
    expect(validateReply(["何が好きですか？", "いいですね。"], { lang: "ja", level: "B1" }).issues).toContain("question_not_last");
  });
  it("flags replies over the level budget (A1 ja ≈ 30 chars ×1.3)", () => {
    const long = "今日はとてもいい天気ですね。私は朝から公園に行って、友達とたくさん話しました。あなたは何をしましたか？";
    expect(validateReply([long], { lang: "ja", level: "A1" }).issues).toContain("too_long");
  });
  it("flags replies in the wrong language", () => {
    expect(validateReply(["What do you like to eat today my friend?"], { lang: "ja", level: "B2" }).issues).toContain("wrong_language");
  });
  it("counts English/German in words", () => {
    expect(validateReply(["Nice! What did you eat?"], { lang: "en", level: "A2" }).ok).toBe(true);
    expect(validateReply(["Das ist ja wirklich sehr schön, erzähl mir bitte mehr darüber, was du gestern alles gemacht hast, wo du warst und mit wem du dort gesprochen hast?"], { lang: "de", level: "A1" }).issues).toContain("too_long");
  });
});

describe("phantom transcripts", () => {
  it.each(["", "  ", "ご視聴ありがとうございました", "チャンネル登録よろしくお願いします", "Thanks for watching!", "you", "Vielen Dank fürs Zuschauen"])(
    "rejects %j", (t) => expect(isPhantomTranscript(t)).toBe(true));
  it("rejects repetition loops", () => expect(isPhantomTranscript("ありがとう ありがとう ありがとう ありがとう ありがとう ありがとう ありがとう ありがとう")).toBe(true));
  it.each(["私は学生です", "I go to school", "Ich habe gegangen"])("keeps real learner speech %j", (t) =>
    expect(isPhantomTranscript(t)).toBe(false));
});

describe("category reconciliation", () => {
  it("downgrades 'understood' with empty meaning or borderline confidence", () => {
    expect(reconcileCategory(baseOut({ meaning_summary: "" }), { borderlineConfidence: false, hasNonTargetTokens: false })).toBe("partially_understood");
    expect(reconcileCategory(baseOut(), { borderlineConfidence: true, hasNonTargetTokens: false })).toBe("partially_understood");
    expect(reconcileCategory(baseOut(), { borderlineConfidence: false, hasNonTargetTokens: false })).toBe("understood");
  });
  it("does not accept 'native language help' without non-target tokens", () => {
    expect(reconcileCategory(baseOut({ category: "native_language_help" }), { borderlineConfidence: false, hasNonTargetTokens: false })).toBe("not_understood");
    expect(reconcileCategory(baseOut({ category: "native_language_help" }), { borderlineConfidence: false, hasNonTargetTokens: true })).toBe("native_language_help");
  });
});

describe("turn schema", () => {
  it("accepts a well-formed output and rejects malformed ones", () => {
    expect(turnOutputSchema.safeParse(baseOut()).success).toBe(true);
    const bad = baseOut() as unknown as { reply: { sentences: string[] } };
    bad.reply.sentences = [];
    expect(turnOutputSchema.safeParse(bad).success).toBe(false);
    expect(turnOutputSchema.safeParse({ analysis: {} }).success).toBe(false);
  });
});
