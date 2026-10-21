import { loadConfig } from "@/lib/config";
import { MemorySpendStore } from "@/lib/limits/budget";
import { DemoLlm, DemoStt, DemoTts } from "@/lib/providers/demo";
import { SessionService, ServiceError, type OutFrame } from "@/lib/session/service";
import { MemorySessionStore } from "@/lib/session/store";
import { encodeAudioFrame, encodeJsonFrame } from "@/lib/contracts/frames";
import type { ErrorCode } from "@/lib/contracts/events";

// Process-wide singletons (kept on globalThis so dev hot-reload doesn't wipe sessions).
// PROVIDERS=demo runs scripted STT/LLM/TTS with no API keys. Real providers and the
// Postgres-backed store are wired here later; until then there is deliberately NO auth:
// this runtime must not be exposed publicly (it refuses to start in production).

const g = globalThis as unknown as { __lactice?: SessionService };

export function getService(): SessionService {
  if (process.env.NODE_ENV === "production" && process.env.PROVIDERS !== "real") {
    throw new Error("Demo providers are disabled in production; real providers are not wired yet.");
  }
  if (process.env.PROVIDERS === "real") throw new Error("Real providers are not implemented yet.");
  return (g.__lactice ??= new SessionService({
    store: new MemorySessionStore(),
    stt: new DemoStt(),
    llm: new DemoLlm(),
    tts: new DemoTts(),
    spend: new MemorySpendStore(),
    config: loadConfig(),
  }));
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
