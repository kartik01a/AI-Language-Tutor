import { Agent, setGlobalDispatcher } from "undici";

// Node closes idle HTTPS connections after ~4 s, but a learner takes longer than that between turns, so
// every call paid a fresh TLS handshake (measured: 1.6 s cold vs 0.4–0.8 s warm for speech-to-text). A long
// keep-alive keeps the connection to Deepgram / OpenAI open across turns.

const g = globalThis as { __lacticeHttp?: boolean };

export function installKeepAlive(): void {
  if (g.__lacticeHttp) return;
  g.__lacticeHttp = true;
  setGlobalDispatcher(new Agent({ keepAliveTimeout: 55_000, keepAliveMaxTimeout: 600_000, connections: 32 }));
}

export interface WarmTarget {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Deepgram and OpenAI close an idle connection after a few seconds (measured: a call after a 6 s pause pays
 * ~1 s of reconnecting; with a ping every 3 s it costs 0.4 s). While a conversation is active, send a cheap
 * authenticated GET to each host every few seconds. Stops by itself when nobody has been active for a while.
 */
export function createWarmKeeper(
  targets: WarmTarget[],
  o: { everyMs?: number; idleStopMs?: number; fetchImpl?: typeof fetch; now?: () => number } = {},
): { touch: () => void; stop: () => void } {
  const every = o.everyMs ?? 3000;
  const idleStop = o.idleStopMs ?? 10 * 60_000;
  const f = o.fetchImpl ?? fetch;
  const now = o.now ?? Date.now;
  let last = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const ping = () => {
    if (now() - last > idleStop) return stop();
    for (const t of targets) void f(t.url, { headers: t.headers, signal: AbortSignal.timeout(5000) }).then((r) => r.body?.cancel()).catch(() => {});
  };
  function stop() {
    if (timer) clearInterval(timer);
    timer = undefined;
  }
  return {
    touch() {
      const wasIdle = !timer;
      last = now();
      if (wasIdle) {
        ping();
        timer = setInterval(ping, every);
        timer.unref?.();
      }
    },
    stop,
  };
}
