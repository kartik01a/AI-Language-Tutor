// Mouth-shape mapping (docs/03 §B6, avatar research §1.3/1.5). Ten shapes; one visible at a time.

export type VisemeId = "rest" | "mbp" | "cons" | "a" | "i" | "u" | "e" | "o" | "fv" | "l_th";
export type VisemeEvent = { t: number; v: VisemeId };

/** Azure viseme ID (0–21) → our shape(s). Two entries = diphthong, split 60/40. */
const AZURE: Record<number, VisemeId[]> = {
  0: ["rest"], 1: ["e"], 2: ["a"], 3: ["o"], 4: ["e"], 5: ["o"], 6: ["i"], 7: ["u"],
  8: ["o"], 9: ["a", "u"], 10: ["o", "i"], 11: ["a", "i"], 12: ["cons"], 13: ["o"],
  14: ["l_th"], 15: ["cons"], 16: ["cons"], 17: ["l_th"], 18: ["fv"], 19: ["cons"],
  20: ["cons"], 21: ["mbp"],
};

export interface AzureVisemeEvent {
  visemeId: number;
  /** Audio offset in 100-ns ticks, as delivered by the Speech SDK. */
  audioOffset: number;
}

export function mapAzureVisemes(
  events: AzureVisemeEvent[],
  opts: { locale?: string; totalMs?: number } = {},
): VisemeEvent[] {
  const out: VisemeEvent[] = [];
  const sorted = [...events].sort((a, b) => a.audioOffset - b.audioOffset);
  sorted.forEach((ev, i) => {
    const start = ev.audioOffset / 10_000; // ticks → ms
    let shapes = AZURE[ev.visemeId] ?? ["rest"];
    // German r (ʁ) is not lip-rounded, unlike English r.
    if (ev.visemeId === 13 && opts.locale?.startsWith("de")) shapes = ["cons"];
    const nextStart = i + 1 < sorted.length ? sorted[i + 1].audioOffset / 10_000 : (opts.totalMs ?? start + 120);
    const dur = Math.max(1, nextStart - start);
    if (shapes.length === 1) out.push({ t: start, v: shapes[0] });
    else {
      out.push({ t: start, v: shapes[0] });
      out.push({ t: start + dur * 0.6, v: shapes[1] });
    }
  });
  return cleanTrack(out);
}

/** Merge repeats and drop shapes shorter than one frame; enforce a minimum hold. */
export function cleanTrack(track: VisemeEvent[], minHoldMs = 40): VisemeEvent[] {
  const out: VisemeEvent[] = [];
  for (const ev of track) {
    const last = out[out.length - 1];
    if (last && last.v === ev.v) continue;
    // Never swallow a closure (mbp/fv): it's the most visible lip-sync cue.
    if (last && ev.t - last.t < minHoldMs && last.v !== "mbp" && last.v !== "fv") {
      out[out.length - 1] = { t: last.t, v: ev.v };
      continue;
    }
    out.push(ev);
  }
  return out;
}

/** Look up the shape active at time `t` (binary search). */
export function visemeAt(track: VisemeEvent[], t: number): VisemeId {
  let lo = 0;
  let hi = track.length - 1;
  let ans: VisemeId = "rest";
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (track[mid].t <= t) {
      ans = track[mid].v;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

// ---- Japanese kana → mouth shapes (for the word-boundary / ElevenLabs fallback) ----

const kata2hira = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const VOWEL: Record<string, VisemeId> = { あ: "a", い: "i", う: "u", え: "e", お: "o" };

// Consonant row → [onset shape]; vowel taken from the kana's column.
const ROWS: [string, VisemeId][] = [
  ["かきくけこがぎぐげご", "cons"], ["さしすせそざじずぜぞ", "cons"], ["たちつてとだぢづでど", "cons"],
  ["なにぬねの", "cons"], ["はひへほ", "cons"], ["ばびぶべぼぱぴぷぺぽ", "mbp"], ["らりるれろ", "cons"], ["やゆよ", "cons"],
  ["まみむめも", "mbp"],
];
const COLUMNS: Record<string, string> = {
  あ: "あかがさざたただなはばぱまやらわ", い: "いきぎしじちぢにひびぴみり", う: "うくぐすずつづぬふぶぷむゆる",
  え: "えけげせぜてでねへべぺめれ", お: "おこごそぞとどのほぼぽもよろをん",
};

function columnOf(ch: string): VisemeId | null {
  for (const [v, chars] of Object.entries(COLUMNS)) if (chars.includes(ch)) return VOWEL[v];
  return null;
}
function onsetOf(ch: string): VisemeId | null {
  if (ch === "ふ") return "u"; // bilabial, not fv
  if (ch === "わ" || ch === "を") return "u";
  for (const [chars, shape] of ROWS) if (chars.includes(ch)) return shape;
  return null;
}

/** Convert kana to a sequence of (onset?, vowel) shapes, one entry per mora. */
export function kanaToShapes(input: string): VisemeId[] {
  const s = kata2hira(input);
  const out: VisemeId[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];
    if (/[、。！？!?,.\s]/.test(ch)) { out.push("rest"); continue; }
    if (ch === "っ") { // geminate: hold the next consonant's closure
      const n = next ? onsetOf(next) : null;
      out.push(n === "mbp" || next === "ぱ" || next === "ぴ" || next === "ぷ" || next === "ぺ" || next === "ぽ" ? "mbp" : "cons");
      continue;
    }
    if (ch === "ん") { // before m/b/p → closure; utterance-final → rest; else half-open
      const n = next ? onsetOf(next) : null;
      out.push(!next ? "rest" : n === "mbp" || "ばびぶべぼぱぴぷぺぽ".includes(next) ? "mbp" : "cons");
      continue;
    }
    if (ch === "ー") { // extend the previous vowel
      const prev = out.slice().reverse().find((x) => ["a", "i", "u", "e", "o"].includes(x));
      if (prev) out.push(prev);
      continue;
    }
    // yōon: きゃ しゅ ちょ → onset + glide, then the small kana's vowel
    if (next && "ゃゅょ".includes(next)) {
      const vowel: VisemeId = next === "ゃ" ? "a" : next === "ゅ" ? "u" : "o";
      out.push("cons", vowel);
      i++;
      continue;
    }
    const vowel = VOWEL[ch] ?? columnOf(ch);
    if (!vowel) continue; // non-kana: skip
    const onset = VOWEL[ch] ? null : onsetOf(ch);
    if (onset) out.push(onset);
    out.push(vowel);
  }
  return out;
}
