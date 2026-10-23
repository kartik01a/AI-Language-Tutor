import { describe, expect, it } from "vitest";
import { buildDeepgramUrl, DeepgramStt, parseDeepgram } from "@/lib/providers/deepgram";
import { buildRequestBody, OpenAiLlm, parseResponse } from "@/lib/providers/openai";
import { strictJsonSchema } from "@/lib/providers/json-schema";
import { buildSsml } from "@/lib/providers/azure-tts";
import { enrichSchema, turnCoreSchema } from "@/lib/tutor/schemas";
import { editsSchema, explanationsSchema } from "@/lib/tutor/correction-pipeline";
import { z } from "zod";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("strict JSON schemas (OpenAI structured outputs)", () => {
  const verify = z.object({ verdicts: z.array(z.object({ card_id: z.string(), agree: z.boolean() })) });
  const summary = z.object({ did_well: z.array(z.object({ text: z.string().max(160), evidence: z.string() })).max(5), next_focus: z.string() });
  const all: [string, z.ZodType][] = [["turn", turnCoreSchema], ["enrich", enrichSchema], ["edits", editsSchema], ["explanations", explanationsSchema], ["verify", verify], ["summary", summary]];

  function walk(node: unknown, visit: (n: Record<string, unknown>) => void) {
    if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
    else if (node && typeof node === "object") {
      visit(node as Record<string, unknown>);
      Object.values(node).forEach((v) => walk(v, visit));
    }
  }

  it.each(all)("%s: every object is closed with all properties required, and no unsupported keywords remain", (_name, schema) => {
    const js = strictJsonSchema(schema);
    walk(js, (n) => {
      if (n.type === "object") {
        expect(n.additionalProperties).toBe(false);
        expect([...(n.required as string[])].sort()).toEqual(Object.keys(n.properties as object).sort());
      }
      for (const bad of ["minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum", "pattern", "format", "$schema", "default"]) {
        expect(n).not.toHaveProperty(bad);
      }
    });
  });
});

type Body = { store: boolean; reasoning: { effort: string }; text: { format: Record<string, unknown> }; safety_identifier?: string; input: { role: string }[] };

describe("OpenAI adapter", () => {
  const req = { system: "sys", user: "usr", schema: { name: "x", jsonSchema: { type: "object" } } };

  it("never stores data, uses the strict schema, and defaults to no reasoning", () => {
    const b = buildRequestBody(req, "gpt-6-luna", "hash123") as Body;
    expect(b.store).toBe(false);
    expect(b.reasoning).toEqual({ effort: "none" });
    expect(b.text.format).toMatchObject({ type: "json_schema", name: "x", strict: true });
    expect(b.safety_identifier).toBe("hash123");
    expect(b.input.map((m) => m.role)).toEqual(["system", "user"]);
  });

  it("falls back to JSON mode without a schema, and honours an explicit effort", () => {
    const b = buildRequestBody({ system: "s", user: "u", effort: "low" }, "m") as Body;
    expect(b.text.format).toEqual({ type: "json_object" });
    expect(b.reasoning.effort).toBe("low");
    expect("safety_identifier" in b).toBe(false);
  });

  it("parses output text and token usage including cache hits", () => {
    const r = parseResponse({
      output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: '{"a":1}' }] }],
      usage: { input_tokens: 3000, output_tokens: 200, input_tokens_details: { cached_tokens: 2000 } },
    });
    expect(r.json).toEqual({ a: 1 });
    expect(r.usage).toEqual({ inputTokens: 3000, cachedInputTokens: 2000, outputTokens: 200 });
  });

  it("surfaces refusals, empty output and API errors instead of guessing", () => {
    expect(() => parseResponse({ output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] })).toThrow(/refused/);
    expect(() => parseResponse({ output: [], status: "incomplete" })).toThrow(/no text/);
    expect(() => parseResponse({ error: { message: "bad" } })).toThrow(/bad/);
  });

  it("sends the key as a bearer token and throws on HTTP errors", async () => {
    let seen: RequestInit | undefined;
    const ok = new OpenAiLlm({ apiKey: "k", fetchImpl: (async (_u: string, init: RequestInit) => ((seen = init), json({ output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] }))) as unknown as typeof fetch });
    await ok.turn(req);
    expect((seen?.headers as Record<string, string>).Authorization).toBe("Bearer k");
    const bad = new OpenAiLlm({ apiKey: "k", fetchImpl: (async () => json({ error: { message: "rate limited" } }, 429)) as unknown as typeof fetch });
    await expect(bad.turn(req)).rejects.toThrow(/429.*rate limited/);
  });

  it("times out instead of hanging a turn", async () => {
    const hang = ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    const llm = new OpenAiLlm({ apiKey: "k", fetchImpl: hang, timeoutMs: 20 });
    await expect(llm.turn(req)).rejects.toThrow(/aborted/);
  });
});

describe("Deepgram adapter", () => {
  it("always opts out of model training and keeps the raw words", () => {
    const u = new URL(buildDeepgramUrl("nova-3", "ja"));
    expect(u.searchParams.get("mip_opt_out")).toBe("true");
    expect(u.searchParams.get("smart_format")).toBe("false");
    expect(u.searchParams.get("language")).toBe("ja");
    expect(new URL(buildDeepgramUrl("nova-3", "ja", true)).searchParams.get("language")).toBe("multi");
  });

  it("parses words with their confidences and timings", () => {
    const r = parseDeepgram({ results: { channels: [{ alternatives: [{ transcript: " 私は学生です ", confidence: 0.9, words: [{ word: "私", start: 0, end: 0.2, confidence: 0.99 }, { word: "は", start: 0.2, end: 0.3, confidence: 0.4 }] }] }] } }, "ja");
    expect(r.text).toBe("私は学生です");
    expect(r.words).toEqual([{ w: "私", conf: 0.99, start: 0, end: 0.2 }, { w: "は", conf: 0.4, start: 0.2, end: 0.3 }]);
    expect(r.lang).toBe("ja");
  });

  it("empty or missing results give an empty transcript, never an invented one", () => {
    expect(parseDeepgram({}, "ja").text).toBe("");
    expect(parseDeepgram({ results: { channels: [{ alternatives: [{ transcript: "", confidence: 0, words: [] }] }] } }, "ja").words).toEqual([]);
  });

  it("authenticates, forwards the audio MIME type, and throws on HTTP errors", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const okFetch = (async (url: string, init: RequestInit) => ((seen = { url, init }), json({ results: { channels: [{ alternatives: [{ transcript: "a", confidence: 1, words: [] }] }] } }))) as unknown as typeof fetch;
    await new DeepgramStt({ apiKey: "dg", fetchImpl: okFetch }).transcribe(new Uint8Array(3), "audio/webm;codecs=opus", ["ja", "en"]);
    expect((seen?.init.headers as Record<string, string>).Authorization).toBe("Token dg");
    expect((seen?.init.headers as Record<string, string>)["Content-Type"]).toBe("audio/webm;codecs=opus");
    const bad = (async () => json({}, 401)) as unknown as typeof fetch;
    await expect(new DeepgramStt({ apiKey: "x", fetchImpl: bad }).transcribe(new Uint8Array(1), "audio/webm", ["ja"])).rejects.toThrow(/401/);
  });
});

describe("Azure SSML", () => {
  const v = { voiceName: "ja-JP-NanamiNeural", locale: "ja-JP" };
  it("escapes XML so learner/LLM text can never break out of the markup", () => {
    const s = buildSsml(`A & B <script>"x"</script>`, v);
    expect(s).not.toContain("<script>");
    expect(s).toContain("A &amp; B &lt;script&gt;");
  });
  it("sets the voice and locale, and only adds prosody when a rate is given", () => {
    expect(buildSsml("こんにちは", v)).toContain('<voice name="ja-JP-NanamiNeural">');
    expect(buildSsml("こんにちは", v)).not.toContain("prosody");
    expect(buildSsml("こんにちは", { ...v, rate: "0%" })).not.toContain("prosody");
    expect(buildSsml("こんにちは", { ...v, rate: "-12%" })).toContain('<prosody rate="-12%">');
  });
  it("applies reading overrides, longest first, without double-wrapping", () => {
    const s = buildSsml("一日中、今日は晴れ", v, [{ text: "一日", alias: "いちにち" }, { text: "一日中", alias: "いちにちじゅう" }, { text: "今日", alias: "きょう" }]);
    expect(s).toContain('<sub alias="いちにちじゅう">一日中</sub>');
    expect(s).toContain('<sub alias="きょう">今日</sub>');
    expect(s).not.toContain('<sub alias="いちにち">一日</sub>中');
  });
});

describe("OpenAI hedged requests (tail-latency protection)", () => {
  const req = { system: "s", user: "u" };
  const okBody = (v: string) => json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ v }) }] }] });
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** A fetch whose Nth call takes `delays[n]` ms (or fails when the delay is "fail"), honouring aborts. */
  function scripted(delays: (number | "fail")[]) {
    const state = { calls: 0, aborted: 0 };
    const impl = ((_u: string, init: RequestInit) => {
      const n = state.calls++;
      const d = delays[Math.min(n, delays.length - 1)];
      return new Promise<Response>((resolve, reject) => {
        let finished = false;
        const t = setTimeout(() => { finished = true; resolve(d === "fail" ? json({ error: { message: "boom" } }, 500) : okBody(`call${n}`)); }, d === "fail" ? 1 : d);
        // Only an abort of a request that was still in flight counts as a cancellation.
        init.signal?.addEventListener("abort", () => { if (finished) return; clearTimeout(t); state.aborted++; reject(new Error("aborted")); });
      });
    }) as unknown as typeof fetch;
    return { state, impl };
  }

  it("does not hedge a fast response", async () => {
    const { state, impl } = scripted([5]);
    const r = await new OpenAiLlm({ apiKey: "k", fetchImpl: impl, hedgeAfterMs: 100 }).turn(req);
    expect(r.json).toEqual({ v: "call0" });
    expect(state.calls).toBe(1);
  });

  it("a slow first call is beaten by the backup, and the loser is cancelled", async () => {
    const { state, impl } = scripted([2000, 5]);
    const t0 = Date.now();
    const r = await new OpenAiLlm({ apiKey: "k", fetchImpl: impl, hedgeAfterMs: 30 }).turn(req);
    expect(r.json).toEqual({ v: "call1" });
    expect(Date.now() - t0).toBeLessThan(500);
    expect(state.calls).toBe(2);
    await sleep(10);
    expect(state.aborted).toBe(1); // the slow request was aborted, not left running
  });

  it("a failed first call is retried once, immediately", async () => {
    const { state, impl } = scripted(["fail", 5]);
    const r = await new OpenAiLlm({ apiKey: "k", fetchImpl: impl, hedgeAfterMs: 5000 }).turn(req);
    expect(r.json).toEqual({ v: "call1" });
    expect(state.calls).toBe(2);
  });

  it("if both attempts fail, the first error is reported (never more than two requests)", async () => {
    const { state, impl } = scripted(["fail", "fail"]);
    await expect(new OpenAiLlm({ apiKey: "k", fetchImpl: impl, hedgeAfterMs: 50 }).turn(req)).rejects.toThrow(/500.*boom/);
    expect(state.calls).toBe(2);
  });

  it("without hedging there is exactly one request", async () => {
    const { state, impl } = scripted(["fail"]);
    await expect(new OpenAiLlm({ apiKey: "k", fetchImpl: impl }).turn(req)).rejects.toThrow();
    expect(state.calls).toBe(1);
  });
});

import { warmUpSchemas } from "@/lib/server/warmup";
import { FakeLlm } from "@/lib/providers/fakes";

describe("schema warm-up", () => {
  it("calls every strict schema once and tolerates failures", async () => {
    const llm = new FakeLlm((n) => (n === 2 ? new Error("down") : {}));
    const r = await warmUpSchemas(llm);
    expect(llm.calls.map((c) => c.schema?.name).sort()).toEqual(["edit_candidates", "explanations", "session_summary", "turn_enrichment", "turn_output", "verify_corrections"]);
    expect(r.warmed).toHaveLength(5);
    expect(r.failed).toHaveLength(1);
  });
});
