import type { LlmProvider, LlmRequest, LlmUsage } from "./types";

// OpenAI Responses API (docs/04 §4). store:false and a hashed safety identifier on every call;
// reasoning effort "none" keeps tutor turns fast.

export interface OpenAiOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /**
   * Tail-latency protection: if the first request hasn't answered after this many ms, send an identical
   * second request and use whichever succeeds first (the loser is aborted). 0 disables hedging.
   */
  hedgeAfterMs?: number;
  /** Stable, privacy-preserving id for abuse monitoring (e.g. a salted hash of the user id). */
  safetyIdentifier?: string;
}

interface ResponsesOutput {
  output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
  error?: { message?: string } | null;
  status?: string;
}

export function buildRequestBody(req: LlmRequest, model: string, safetyIdentifier?: string): Record<string, unknown> {
  return {
    model,
    input: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    // Without a schema we fall back to JSON mode, which requires the word "JSON" in the prompt.
    text: { format: req.schema ? { type: "json_schema", name: req.schema.name, strict: true, schema: req.schema.jsonSchema } : { type: "json_object" } },
    reasoning: { effort: req.effort ?? "none" },
    store: false,
    ...(safetyIdentifier ? { safety_identifier: safetyIdentifier } : {}),
  };
}

export function parseResponse(j: ResponsesOutput): { json: unknown; usage: LlmUsage } {
  if (j.error?.message) throw new Error(`OpenAI error: ${j.error.message}`);
  const content = j.output?.flatMap((o) => (o.type === "message" ? (o.content ?? []) : [])) ?? [];
  const refusal = content.find((c) => c.type === "refusal");
  if (refusal) throw new Error("OpenAI refused the request");
  const text = content.find((c) => c.type === "output_text")?.text;
  if (!text) throw new Error(`OpenAI returned no text (status ${j.status ?? "unknown"})`);
  return {
    json: JSON.parse(text),
    usage: {
      inputTokens: j.usage?.input_tokens ?? 0,
      cachedInputTokens: j.usage?.input_tokens_details?.cached_tokens ?? 0,
      outputTokens: j.usage?.output_tokens ?? 0,
    },
  };
}

export class OpenAiLlm implements LlmProvider {
  constructor(private o: OpenAiOptions) {}

  private async once(req: LlmRequest, signal: AbortSignal): Promise<{ json: unknown; usage: LlmUsage }> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f(`${this.o.baseUrl ?? "https://api.openai.com"}/v1/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.o.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody(req, this.o.model ?? "gpt-6-luna", this.o.safetyIdentifier)),
      signal,
    });
    const j = (await res.json().catch(() => ({}))) as ResponsesOutput;
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${j.error?.message ?? "request failed"}`);
    return parseResponse(j);
  }

  async turn(req: LlmRequest): Promise<{ json: unknown; usage: LlmUsage }> {
    const timeoutMs = this.o.timeoutMs ?? 15000;
    const hedgeMs = this.o.hedgeAfterMs ?? 0;
    const controllers: AbortController[] = [];
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const attempt = () => {
      const ctl = new AbortController();
      controllers.push(ctl);
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      return this.once(req, ctl.signal).finally(() => clearTimeout(timer));
    };

    try {
      if (hedgeMs <= 0) return await attempt();
      // At most two attempts. The second starts when the first is slow (hedge) or has failed (retry).
      // The first success wins; if both fail, the first error is reported.
      return await new Promise((resolve, reject) => {
        let launched = 0;
        let failed = 0;
        let firstError: unknown;
        const launch = () => {
          launched++;
          attempt().then(resolve, (e) => {
            firstError ??= e;
            failed++;
            if (launched < 2) launch();
            else if (failed >= launched) reject(firstError);
          });
        };
        launch();
        hedgeTimer = setTimeout(() => launched < 2 && launch(), hedgeMs);
      });
    } finally {
      clearTimeout(hedgeTimer);
      for (const c of controllers) c.abort(); // cancel whichever request is still running
    }
  }
}
