// Cost accounting and the global kill switch (docs/09 §8, docs/12). Prices are a versioned
// table in code; re-verify before relying on them (last checked 2026-10-14).

export const PRICE_TABLE_VERSION = "2026-10-14";

export const PRICES = {
  stt: { "deepgram-nova-3": { perMinute: 0.0052 } },
  llm: {
    // per 1M tokens
    "gpt-6-luna": { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 },
  },
  tts: { "azure-standard": { perMillionChars: 15 } },
} as const;

export function sttCost(model: keyof typeof PRICES.stt, audioSeconds: number): number {
  return (audioSeconds / 60) * PRICES.stt[model].perMinute;
}

export function llmCost(
  model: keyof typeof PRICES.llm,
  u: { inputTokens: number; cachedInputTokens: number; outputTokens: number },
): number {
  const p = PRICES.llm[model];
  const fresh = Math.max(0, u.inputTokens - u.cachedInputTokens);
  return (fresh * p.input + u.cachedInputTokens * p.cachedInput + u.outputTokens * p.output) / 1e6;
}

/** Azure bills each kanji as two characters. */
export function azureBillableChars(text: string): number {
  let n = 0;
  for (const ch of text) n += /[㐀-鿿]/.test(ch) ? 2 : 1;
  return n;
}

export function ttsCost(model: keyof typeof PRICES.tts, billableChars: number): number {
  return (billableChars / 1e6) * PRICES.tts[model].perMillionChars;
}

export interface SpendStore {
  monthToDate(month: string): Promise<number>;
  add(month: string, usd: number): Promise<number>;
}

export class MemorySpendStore implements SpendStore {
  private m = new Map<string, number>();
  async monthToDate(month: string) {
    return this.m.get(month) ?? 0;
  }
  async add(month: string, usd: number) {
    const v = (this.m.get(month) ?? 0) + usd;
    this.m.set(month, v);
    return v;
  }
}

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export type BudgetStatus = "ok" | "warn" | "exhausted";

export async function budgetStatus(store: SpendStore, budgetUsd: number, now = new Date()): Promise<{ status: BudgetStatus; spent: number; fraction: number }> {
  const spent = await store.monthToDate(monthKey(now));
  const fraction = spent / budgetUsd;
  return { status: fraction >= 1 ? "exhausted" : fraction >= 0.8 ? "warn" : "ok", spent, fraction };
}
