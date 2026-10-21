// Character error rate on kana-normalised text (docs/05 §8): kanji vs kana spelling differences must
// not count as recognition errors, so both sides are compared as hiragana.

const kata2hira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Drop punctuation, spaces and the long-vowel mark variants that recognisers disagree on. */
export function normaliseKana(s: string): string {
  return kata2hira(s)
    .normalize("NFKC")
    .replace(/[\s、。，．,.!！?？「」『』"'・~〜ー-]/g, "")
    .toLowerCase();
}

export function editDistance(a: string, b: string): number {
  const m = [...a];
  const n = [...b];
  const dp = Array.from({ length: m.length + 1 }, (_, i) => [i, ...Array(n.length).fill(0)] as number[]);
  for (let j = 1; j <= n.length; j++) dp[0][j] = j;
  for (let i = 1; i <= m.length; i++) {
    for (let j = 1; j <= n.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (m[i - 1] === n[j - 1] ? 0 : 1));
    }
  }
  return dp[m.length][n.length];
}

/** CER between a reference reading and a (kana-normalised) hypothesis. 0 = perfect; can exceed 1. */
export function cer(referenceKana: string, hypothesisKana: string): number {
  const r = normaliseKana(referenceKana);
  const h = normaliseKana(hypothesisKana);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  return editDistance(r, h) / [...r].length;
}
