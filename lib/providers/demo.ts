import { kanaToShapes } from "@/lib/avatar/visemes";
import { makeToneWav } from "@/lib/audio/tone";
import type { LlmProvider, LlmRequest, SttProvider, SttResult, TtsProvider, TtsResult } from "./types";
import type { TurnOutput } from "@/lib/tutor/schemas";

// Scripted providers for `PROVIDERS=demo`: lets you run a full practice session in the browser
// with no API keys. The "learner" lines come from a fixed script, whatever the microphone hears.

const SCRIPT: { text: string; conf: number | number[]; lang?: string }[] = [
  { text: "わたし は ラーメン が すき です", conf: 0.95 },
  { text: "すきな しく", conf: [0.4, 0.3] }, // deliberately unclear
  { text: "きのう こうえん を いきました", conf: 0.94 },
  { text: "ともだち と いきました", conf: 0.96 },
  { text: "わたし は how do you say engineer", conf: 0.93 },
  { text: "きのう ラーメン を たべます", conf: 0.95 }, // tense error → spoken recast + card
];

export class DemoStt implements SttProvider {
  private n = 0;
  async transcribe(): Promise<SttResult> {
    const s = SCRIPT[this.n++ % SCRIPT.length];
    const words = s.text.split(" ");
    return {
      text: s.text,
      words: words.map((w, i) => ({ w, conf: Array.isArray(s.conf) ? (s.conf[i] ?? 0.9) : s.conf })),
      lang: s.lang ?? "ja",
      langConf: 0.98,
    };
  }
}

const REPLIES: { sentences: string[]; translation: string[]; hint: [string, string, string] }[] = [
  { sentences: ["いいですね！", "どんなラーメンが好きですか？"], translation: ["Nice!", "What kind of ramen do you like?"], hint: ["Say what kind: miso, shoyu, tonkotsu…", "私は ___ ラーメンが好きです。", "私はみそラーメンが好きです。"] },
  { sentences: ["へえ！", "どこの公園ですか？"], translation: ["Oh!", "Which park?"], hint: ["Name a park or a place.", "___ 公園です。", "大きい公園です。"] },
  { sentences: ["そうですか。", "誰と行きましたか？"], translation: ["I see.", "Who did you go with?"], hint: ["Say who you went with.", "___ と行きました。", "友達と行きました。"] },
  { sentences: ["楽しそうですね！", "その後、何をしましたか？"], translation: ["That sounds fun!", "What did you do after that?"], hint: ["Say one thing you did.", "___ を食べました。", "ラーメンを食べました。"] },
];

const base = (n: number, category: TurnOutput["analysis"]["category"], teach?: { text: string; translation: string }): TurnOutput => {
  const r = REPLIES[n % REPLIES.length];
  return {
    analysis: { category, meaning_summary: "learner answered", recovered_fragment: null, off_topic_reason: null, meta: { kind: null, word: null }, goal_progress: [], recast_candidate: null },
    reply: { recast: null, sentences: r.sentences, translation: r.translation, teach_phrase: teach ?? null },
    hints: { hint: r.hint[0], starter: r.hint[1], example: r.hint[2], example_translation: "(example)" },
    words_introduced: [],
  };
};

const USAGE = { inputTokens: 3000, cachedInputTokens: 2000, outputTokens: 250 };

export class DemoLlm implements LlmProvider {
  private n = 0;
  async turn(req: LlmRequest) {
    // Correction pipeline calls: deterministic, so all samples agree.
    if (req.system.startsWith("EDIT DETECTION")) {
      const edits = [];
      if (req.user.includes("こうえん") && req.user.includes(":を")) edits.push({ code: "ja.particle.destination", original: "を", corrected: "に", token_start: 2, token_end: 3, type: "grammar" });
      if (req.user.includes("たべます")) edits.push({ code: "ja.verb.tense", original: "たべます", corrected: "たべました", token_start: 3, token_end: 4, type: "grammar" });
      return { json: { edits }, usage: USAGE };
    }
    if (req.system.startsWith("EXPLANATION")) {
      const items = req.user.split("\n").filter(Boolean).map((l) => ({
        edit_id: l.split(":")[0],
        rule: l.includes("particle") ? "Use に after places you go to." : "Finished actions end in ～ました.",
        example: l.includes("particle") ? "学校に行きました。" : "昨日、ラーメンを食べました。",
      }));
      return { json: { items }, usage: USAGE };
    }
    const n = this.n++;
    const lower = req.user.toLowerCase();
    const wantsHelp = lower.includes("how do you say");
    const out = wantsHelp
      ? base(n, "native_language_help", { text: "エンジニアです", translation: "I'm an engineer" })
      : base(n, "understood");
    if (wantsHelp) out.reply.sentences = ["「エンジニアです」と言えますよ。", "言ってみてください。"];
    if (lower.includes("たべます")) {
      out.analysis.recast_candidate = { error_code: "ja.verb.tense", original: "たべます", corrected: "たべました" };
      out.reply.recast = "ラーメンを食べたんですね！";
    }
    return { json: out, usage: { inputTokens: 3000, cachedInputTokens: 2000, outputTokens: 250 } };
  }
}

/** Beep "voice": real playable WAV whose length follows the text, with mouth shapes per mora. */
export class DemoTts implements TtsProvider {
  async synthesize(text: string): Promise<TtsResult> {
    const moraMs = 110;
    const speakable = text.replace(/[、。！？!?「」\s]/g, "");
    const n = Math.max(3, speakable.length);
    const shapes = kanaToShapes(speakable.replace(/[^぀-ヿー]/g, "あ"));
    const visemes = Array.from({ length: n }, (_, i) => ({ t: i * moraMs, v: shapes[i % Math.max(1, shapes.length)] ?? "a" }));
    const durationMs = n * moraMs + 150;
    return { audio: makeToneWav(300 + (text.length % 5) * 40, durationMs, 22050, 0.15), visemes, durationMs, billableChars: text.length };
  }
}
