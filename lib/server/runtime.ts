import { loadConfig } from "@/lib/config";
import { MemorySpendStore } from "@/lib/limits/budget";
import { DemoLlm, DemoStt, DemoTts } from "@/lib/providers/demo";
import { AzureTts } from "@/lib/providers/azure-tts";
import { DeepgramStt } from "@/lib/providers/deepgram";
import { DEFAULT_MODEL, OpenAiLlm } from "@/lib/providers/openai";
import type { LlmProvider, SttProvider, TtsProvider } from "@/lib/providers/types";
import { warmUpSchemas } from "./warmup";
import { createWarmKeeper, installKeepAlive } from "./http";
import { SessionService, ServiceError, type OutFrame } from "@/lib/session/service";
import { MemorySessionStore } from "@/lib/session/store";
import { encodeAudioFrame, encodeJsonFrame } from "@/lib/contracts/frames";
import type { ErrorCode } from "@/lib/contracts/events";

// Process-wide singletons (kept on globalThis so dev hot-reload doesn't wipe sessions).
// PROVIDERS=demo runs scripted STT/LLM/TTS with no API keys. Real providers and the
// Postgres-backed store are wired here later; until then there is deliberately NO auth:
// this runtime must not be exposed publicly (it refuses to start in production).

const g = globalThis as unknown as { __lactice?: SessionService };

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Set it in .env.local (see .env.example).`);
  return v;
}

/** PROVIDERS=demo (default): scripted, no keys. PROVIDERS=real: Deepgram + OpenAI + Azure. */
export function buildProviders(env: NodeJS.ProcessEnv = process.env): { stt: SttProvider; llm: LlmProvider; tts: TtsProvider; mode: "demo" | "real" } {
  if (env.PROVIDERS !== "real") return { stt: new DemoStt(), llm: new DemoLlm(), tts: new DemoTts(), mode: "demo" };
  installKeepAlive();
  return {
    mode: "real",
    stt: new DeepgramStt({ apiKey: requireEnv("DEEPGRAM_API_KEY") }),
    // Hedging: a backup request after 4 s tames OpenAI's heavy latency tail (we saw 11–15 s outliers).
    llm: new OpenAiLlm({ apiKey: requireEnv("OPENAI_API_KEY"), model: env.OPENAI_MODEL_TURN || DEFAULT_MODEL, hedgeAfterMs: 4000, timeoutMs: 15000 }),
    tts: new AzureTts({ key: requireEnv("AZURE_SPEECH_KEY"), region: requireEnv("AZURE_SPEECH_REGION") }),
  };
}

/** Keeps the Deepgram and OpenAI connections warm while conversations are active (see ./http). */
export function realKeeper() {
  return createWarmKeeper([
    { url: "https://api.deepgram.com/v1/projects", headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` } },
    { url: `https://api.openai.com/v1/models/${process.env.OPENAI_MODEL_TURN || DEFAULT_MODEL}`, headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } },
  ]);
}

export function getService(): SessionService {
  // No authentication exists yet: this runtime spends real money per request, so it must never be
  // reachable from the public internet. Remove this guard only together with auth (docs/09 §6).
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_PRODUCTION !== "i-understand-there-is-no-auth") {
    throw new Error("Refusing to start in production: authentication is not implemented yet.");
  }
  return (g.__lactice ??= (() => {
    const p = buildProviders();
    if (p.mode === "real") {
      void warmUpSchemas(p.llm); // fire and forget
    }
    const keeper = p.mode === "real" ? realKeeper() : null;
    return new SessionService({
      store: new MemorySessionStore(), stt: p.stt, llm: p.llm, tts: p.tts, spend: new MemorySpendStore(), config: loadConfig(),
      onActivity: keeper?.touch,
    });
  })());
}

/** Streams generator frames as the length-prefixed binary protocol (docs/11 §3.2). */
export function frameResponse(gen: AsyncGenerator<OutFrame>): Response {
  const enc = (f: OutFrame) => (f.kind === "event" ? encodeJsonFrame(f.event) : encodeAudioFrame(f.bytes));
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const f of gen) controller.enqueue(enc(f));
      } catch (e) {
        const code: ErrorCode = e instanceof ServiceError ? e.code : "INTERNAL";
        controller.enqueue(encodeJsonFrame({ t: "error", seq: 0, code, retryable: false, message: e instanceof ServiceError ? e.message : "Something went wrong." }));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}

export function errorStatus(code: ErrorCode): number {
  return { SESSION_NOT_FOUND: 404, SESSION_ENDED: 409, SESSION_NOT_ENDED: 409, STATE_CONFLICT: 409, BUDGET_PAUSED: 503, PAYLOAD_TOO_LARGE: 413, BAD_REQUEST: 400, PROVIDER_FATAL: 502, INTERNAL: 500 }[code];
}
