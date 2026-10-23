import { describe, expect, it } from "vitest";
import { loadConfig } from "@/lib/config";
import { MemorySpendStore, monthKey } from "@/lib/limits/budget";
import { DemoLlm, DemoStt, DemoTts } from "@/lib/providers/demo";
import { FakeLlm, FakeStt, stt } from "@/lib/providers/fakes";
import { SessionService, ServiceError, type OutFrame } from "@/lib/session/service";
import { MemorySessionStore } from "@/lib/session/store";
import type { ServerEvent } from "@/lib/contracts/events";
import type { SttProvider } from "@/lib/providers/types";
import { TURN_SCHEMA } from "@/lib/tutor/turn-pipeline";

async function collect(gen: AsyncGenerator<OutFrame>) {
  const events: ServerEvent[] = [];
  let audio = 0;
  for await (const f of gen) {
    if (f.kind === "event") events.push(f.event);
    else audio++;
  }
  return { events, audio, types: events.map((e) => e.t) };
}

function setup(over: { env?: Record<string, string>; stt?: SttProvider; spend?: MemorySpendStore } = {}) {
  let t = 1_000_000;
  const clock = { advance: (s: number) => (t += s * 1000) };
  let n = 0;
  const spend = over.spend ?? new MemorySpendStore();
  const svc = new SessionService({
    store: new MemorySessionStore(), stt: over.stt ?? new DemoStt(), llm: new DemoLlm(), tts: new DemoTts(), spend,
    config: loadConfig(over.env ?? {}), now: () => t, newId: () => `id-${++n}`,
  });
  return { svc, clock, spend };
}

const speech = { speechMs: 2000, clipMs: 3000 };
const audio = new Uint8Array(100);

describe("session flow", () => {
  it("creates a session, greets, and asks for a topic with an audio frame per sentence", async () => {
    const { svc } = setup();
    const { sessionId, chips } = await svc.createSession({ level: "A2" });
    expect(chips.length).toBe(4);
    const r = await collect(svc.handleEvent(sessionId, { e: "start" }));
    expect(r.events.filter((e) => e.t === "sentence")).toHaveLength(2);
    expect(r.audio).toBe(2);
    expect(r.types.at(-1)).toBe("turn_end");
    const s = r.events.find((e) => e.t === "sentence");
    expect(s && s.t === "sentence" && s.visemes.length).toBeGreaterThan(0);
  });

  it("a topic chip starts the conversation with a question", async () => {
    const { svc } = setup();
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    const r = await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    const texts = r.events.flatMap((e) => (e.t === "sentence" ? [e.text] : []));
    expect(texts.at(-1)).toContain("好きな食べ物");
  });

  it("an understood turn: transcript, category, validated reply spoken", async () => {
    const { svc } = setup();
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    const r = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    const tr = r.events.find((e) => e.t === "transcript");
    expect(tr).toMatchObject({ display: "normal", text: "わたしはラーメンがすきです" });
    expect(r.events.find((e) => e.t === "category")).toMatchObject({ category: "UNDERSTOOD", action: "RESPOND" });
    expect(r.events.filter((e) => e.t === "sentence").length).toBeGreaterThan(0);
  });

  it("unclear speech: no transcript shown, template clarification, then 'You can say' and move on", async () => {
    const unclear = new FakeStt([stt("すきな しく", [0.4, 0.3])]);
    const { svc } = setup({ stt: unclear });
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "週末" }));

    const first = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    expect(first.events.find((e) => e.t === "transcript")).toMatchObject({ display: "unclear", text: null });
    expect(first.events.find((e) => e.t === "category")).toMatchObject({ action: "CLARIFY" });

    const second = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    expect(second.events.find((e) => e.t === "category")).toMatchObject({ action: "SUGGEST_AND_MOVE_ON" });
    expect(second.events.filter((e) => e.t === "sentence").length).toBeGreaterThanOrEqual(1);
  });

  it("silence never calls STT and tells the learner nothing was heard", async () => {
    const counting = new FakeStt([stt("x")]);
    const { svc, spend } = setup({ stt: counting });
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "旅行" }));
    const before = await spend.monthToDate(monthKey(new Date(1_000_000)));
    const r = await collect(svc.handleTurn(sessionId, audio, "audio/webm", { speechMs: 50, clipMs: 3000 }));
    expect(counting.calls).toBe(0);
    expect(r.events.find((e) => e.t === "category")).toMatchObject({ category: "NO_SPEECH" });
    const texts = r.events.flatMap((e) => (e.t === "sentence" ? [e.text] : []));
    expect(texts[0]).toContain("聞こえませんでした");
    // Only (cheap) TTS cost, no STT/LLM cost.
    const after = await spend.monthToDate(monthKey(new Date(1_000_000)));
    expect(after - before).toBeLessThan(0.001);
  });

  it("hint ladder via events, then the model answer is spoken", async () => {
    const { svc } = setup();
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech)); // loads hints
    const levels: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await collect(svc.handleEvent(sessionId, { e: "hint_request" }));
      const h = r.events.find((e) => e.t === "hint");
      levels.push(h && h.t === "hint" ? h.level : -1);
    }
    expect(levels).toEqual([1, 2, 3]);
    const fourth = await collect(svc.handleEvent(sessionId, { e: "hint_request" }));
    expect(fourth.events.some((e) => e.t === "sentence")).toBe(true);
  });

  describe("hints are requested beside the reply, not inside it", () => {
    const build = (failEnrich = false) => {
      const inner = new DemoLlm();
      const calls: string[] = [];
      const llm = {
        async turn(req: Parameters<DemoLlm["turn"]>[0]) {
          calls.push(req.schema?.name ?? "none");
          if (failEnrich && req.schema?.name === "turn_enrichment") throw new Error("down");
          return inner.turn(req);
        },
      };
      const svc = new SessionService({
        store: new MemorySessionStore(), stt: new DemoStt(), llm, tts: new DemoTts(), spend: new MemorySpendStore(),
        config: loadConfig({}), now: () => 1_000_000, newId: (() => { let n = 0; return () => `id-${++n}`; })(),
      });
      return { svc, calls };
    };

    it("the live turn schema has no hints/words fields, and a separate call fills them", async () => {
      const { svc, calls } = build();
      const { sessionId } = await svc.createSession({ level: "A2" });
      await collect(svc.handleEvent(sessionId, { e: "start" }));
      await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
      await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
      expect(calls).toContain("turn_output");
      expect(calls).toContain("turn_enrichment");
      const turn = TURN_SCHEMA.jsonSchema as { properties: Record<string, unknown> };
      expect(Object.keys(turn.properties).sort()).toEqual(["analysis", "reply"]);
      const hint = (await collect(svc.handleEvent(sessionId, { e: "hint_request" }))).events.find((e) => e.t === "hint");
      expect(hint && hint.t === "hint" && hint.text).not.toBe("Say something short, like a topic you like.");
    });

    it("if the hints request fails the turn still completes and the generic hint is used", async () => {
      const { svc } = build(true);
      const { sessionId } = await svc.createSession({ level: "A2" });
      await collect(svc.handleEvent(sessionId, { e: "start" }));
      await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
      const r = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
      expect(r.types.at(-1)).toBe("turn_end");
      const hint = (await collect(svc.handleEvent(sessionId, { e: "hint_request" }))).events.find((e) => e.t === "hint");
      expect(hint && hint.t === "hint" && hint.text).toBe("Say something short, like a topic you like.");
    });
  });

  it("silence nudge speaks a line and opens hint level 1", async () => {
    const { svc } = setup();
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    const r = await collect(svc.handleEvent(sessionId, { e: "silence_timeout" }));
    expect(r.events.some((e) => e.t === "sentence")).toBe(true);
    expect(r.events.find((e) => e.t === "hint")).toMatchObject({ level: 1 });
  });
});

describe("limits and endings", () => {
  it("soft time limit: the exchange finishes, then Yuki closes and the session ends", async () => {
    const { svc, clock } = setup({ env: { SESSION_TARGET_MINUTES: "1" } });
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    clock.advance(45);
    const mid = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    expect(mid.types).not.toContain("session_end");
    clock.advance(30); // crosses 60 s of active time while the learner thinks
    const last = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    const texts = last.events.flatMap((e) => (e.t === "sentence" ? [e.text] : []));
    expect(texts.at(-1)).toContain("また話しましょう"); // closing line
    expect(last.events.find((e) => e.t === "limits")).toMatchObject({ wrapUp: true, reason: "time" });
    expect(last.types).toContain("session_end");
    const after = await collect(svc.handleEvent(sessionId, { e: "hint_request" }));
    expect(after.events[0]).toMatchObject({ t: "error", code: "SESSION_ENDED" });
  });

  it("long idle gaps are capped, so a learner who walks away isn't charged trial time", async () => {
    const { svc, clock } = setup({ env: { IDLE_PAUSE_SECONDS: "90", SESSION_TARGET_MINUTES: "5" } });
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    clock.advance(3600);
    const r = await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    const lim = r.events.find((e) => e.t === "limits");
    expect(lim && lim.t === "limits" && lim.activeSeconds).toBe(90);
  });

  it("budget kill switch: new sessions are refused; running sessions wrap up", async () => {
    const spend = new MemorySpendStore();
    const { svc } = setup({ spend });
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    await spend.add(monthKey(new Date(1_000_000)), 50);
    const r = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    expect(r.events.find((e) => e.t === "limits")).toMatchObject({ wrapUp: true, reason: "budget" });
    expect(r.types).toContain("session_end");
    await expect(svc.createSession({ level: "A2" })).rejects.toMatchObject({ code: "BUDGET_PAUSED" });
    await expect(svc.createSession({ level: "A2" })).rejects.toBeInstanceOf(ServiceError);
  });

  it("explicit end finishes the session", async () => {
    const { svc } = setup();
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    const r = await collect(svc.handleEvent(sessionId, { e: "end" }));
    expect(r.types).toContain("session_end");
    expect(r.events.at(-1)).toMatchObject({ t: "turn_end", expect: "end" });
  });
});

describe("failures", () => {
  it("provider failure: apologetic template, not counted as unclear; two in a row is fatal", async () => {
    const boom = new FakeStt([new Error("503")]);
    const { svc } = setup({ stt: boom });
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    const a = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    expect(a.events.find((e) => e.t === "category")).toMatchObject({ category: "PROVIDER_ERROR" });
    expect(a.events.some((e) => e.t === "error")).toBe(false);
    const b = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    expect(b.events.find((e) => e.t === "error")).toMatchObject({ code: "PROVIDER_FATAL", retryable: true });
  });

  it("unknown session", async () => {
    const { svc } = setup();
    await expect(collect(svc.handleEvent("nope", { e: "start" }))).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });

  it("concurrent duplicate requests: the loser gets STATE_CONFLICT instead of corrupting state", async () => {
    const { svc } = setup();
    const { sessionId } = await svc.createSession({ level: "A2" });
    const [a, b] = await Promise.all([
      collect(svc.handleEvent(sessionId, { e: "start" })),
      collect(svc.handleEvent(sessionId, { e: "start" })),
    ]);
    const conflicts = [a, b].filter((r) => r.events.some((e) => e.t === "error" && e.code === "STATE_CONFLICT"));
    expect(conflicts).toHaveLength(1);
  });

  it("records a plausible per-session cost", async () => {
    const { svc, spend } = setup();
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    const total = await spend.monthToDate(monthKey(new Date(1_000_000)));
    expect(total).toBeGreaterThan(0.0001);
    expect(total).toBeLessThan(0.02);
  });
});

describe("corrections in the live session", () => {
  const turn = async (svc: SessionService, id: string) => collect(svc.handleTurn(id, audio, "audio/webm", speech));
  async function started(over = {}) {
    const s = setup(over);
    const { sessionId } = await s.svc.createSession({ level: "A2" });
    await collect(s.svc.handleEvent(sessionId, { e: "start" }));
    await collect(s.svc.handleEvent(sessionId, { e: "topic_chip", label: "週末" }));
    return { ...s, sessionId };
  }

  it("a genuine particle error gets a card (answer hidden first), delivered after the turn has ended", async () => {
    const { svc, sessionId } = await started();
    await turn(svc, sessionId); // 1: clear, no error
    await turn(svc, sessionId); // 2: unclear
    const r = await turn(svc, sessionId); // 3: 公園を行きました
    const c = r.events.find((e) => e.t === "corrections");
    expect(c && c.t === "corrections" && c.cards).toHaveLength(1);
    const card = c && c.t === "corrections" ? c.cards[0] : null;
    expect(card).toMatchObject({ errorCode: "ja.particle.destination", original: "を", corrected: "に", tryAgainFirst: true });
    // Cards arrive AFTER turn_end so the learner can already answer while they are computed.
    expect(r.types.indexOf("corrections")).toBeGreaterThan(r.types.indexOf("turn_end"));
  });

  it("correct sentences and unclear turns produce no cards", async () => {
    const { svc, sessionId } = await started();
    const good = await turn(svc, sessionId);
    const unclear = await turn(svc, sessionId);
    expect(good.types).not.toContain("corrections");
    expect(unclear.types).not.toContain("corrections");
  });

  it("the tutor never calls the correction pipeline for an unclear turn (no wasted cost)", async () => {
    const unclear = new FakeStt([stt("すきな しく", [0.4, 0.3])]);
    const { svc, spend, sessionId } = await started({ stt: unclear });
    const before = await spend.monthToDate(monthKey(new Date(1_000_000)));
    await turn(svc, sessionId);
    const after = await spend.monthToDate(monthKey(new Date(1_000_000)));
    expect(after - before).toBeLessThan(0.005); // STT + TTS only; no 3 detection calls
  });

  it("fast-path recast: a clear tense error is echoed in Yuki's voice, before the reply", async () => {
    const { svc, sessionId } = await started();
    for (let i = 0; i < 5; i++) await turn(svc, sessionId); // advance the demo script to the tense error
    const r = await turn(svc, sessionId);
    const texts = r.events.flatMap((e) => (e.t === "sentence" ? [e.text] : []));
    expect(texts[0]).toBe("ラーメンを食べたんですね！");
    const card = r.events.find((e) => e.t === "corrections");
    expect(card && card.t === "corrections" && card.cards[0]).toMatchObject({ errorCode: "ja.verb.tense", corrected: "たべました" });
  });

  it("Relaxed strictness shows the answer immediately; reports are stored for evaluation", async () => {
    const s = setup();
    const { sessionId } = await s.svc.createSession({ level: "A2", strictness: "relaxed" });
    await collect(s.svc.handleEvent(sessionId, { e: "start" }));
    await collect(s.svc.handleEvent(sessionId, { e: "topic_chip", label: "週末" }));
    for (let i = 0; i < 5; i++) await turn(s.svc, sessionId);
    const r = await turn(s.svc, sessionId);
    const c = r.events.find((e) => e.t === "corrections");
    expect(c && c.t === "corrections" && c.cards[0].tryAgainFirst).toBe(false);
    const rep = await collect(s.svc.handleEvent(sessionId, { e: "card_report", cardId: "x", reason: "was_correct" }));
    expect(rep.types).toContain("turn_end");
  });

  it("slow corrections never hold the learner back, and the next turn can start while they are computed", async () => {
    const s = setup();
    const internals = s.svc as unknown as { d: { llm: { turn: (r: { system: string }) => Promise<unknown> } } };
    const orig = internals.d.llm.turn.bind(internals.d.llm);
    internals.d.llm.turn = async (req) => {
      if (req.system.startsWith("EDIT DETECTION")) await new Promise((r) => setTimeout(r, 150));
      return orig(req);
    };
    const { sessionId } = await s.svc.createSession({ level: "A2" });
    await collect(s.svc.handleEvent(sessionId, { e: "start" }));
    await collect(s.svc.handleEvent(sessionId, { e: "topic_chip", label: "週末" }));
    await turn(s.svc, sessionId);
    await turn(s.svc, sessionId);

    // Turn 3 has the particle error. Read its stream manually so we can act at turn_end.
    const gen = s.svc.handleTurn(sessionId, audio, "audio/webm", speech);
    const seen: { t: string; at: number }[] = [];
    const t0 = Date.now();
    let nextTurn: Promise<{ types: string[]; events: ServerEvent[] }> | null = null;
    for await (const f of gen) {
      if (f.kind !== "event") continue;
      seen.push({ t: f.event.t, at: Date.now() - t0 });
      if (f.event.t === "turn_end") nextTurn = turn(s.svc, sessionId); // the learner answers straight away
    }
    const turnEnd = seen.find((e) => e.t === "turn_end");
    const corr = seen.find((e) => e.t === "corrections");
    expect(corr && turnEnd && corr.at - turnEnd.at).toBeGreaterThanOrEqual(100);
    const next = await nextTurn;
    expect(next?.events.some((e) => e.t === "error")).toBe(false); // no STATE_CONFLICT from the late write
    expect(next?.types).toContain("turn_end");
  });

  it("a failing correction pipeline never breaks the conversation", async () => {
    const s = setup();
    const llm = (s.svc as unknown as { d: { llm: { turn: unknown } } }).d.llm;
    const orig = llm.turn as (r: { system: string }) => Promise<unknown>;
    llm.turn = (req: { system: string }) => (req.system.startsWith("EDIT DETECTION") ? Promise.reject(new Error("down")) : orig.call(llm, req));
    const { sessionId } = await s.svc.createSession({ level: "A2" });
    await collect(s.svc.handleEvent(sessionId, { e: "start" }));
    await collect(s.svc.handleEvent(sessionId, { e: "topic_chip", label: "週末" }));
    const r = await turn(s.svc, sessionId);
    expect(r.types).toContain("turn_end");
    expect(r.types).not.toContain("corrections");
    expect(r.events.some((e) => e.t === "error")).toBe(false);
  });
});

describe("end-of-session summary", () => {
  const rec = async (svc: SessionService, id: string) => collect(svc.handleTurn(id, audio, "audio/webm", speech));

  it("is refused while the conversation is still going", async () => {
    const { svc } = setup();
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await expect(svc.summarise(sessionId)).rejects.toMatchObject({ code: "SESSION_NOT_ENDED" });
  });

  it("summarises a real session: verified fix, quoted praise, honest stats — and caches the result", async () => {
    const { svc, spend } = setup();
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    await rec(svc, sessionId); // ラーメンがすきです
    await rec(svc, sessionId); // unclear
    await rec(svc, sessionId); // 公園を行きました → particle card
    await collect(svc.handleEvent(sessionId, { e: "hint_request" }));
    await collect(svc.handleEvent(sessionId, { e: "end" }));

    const before = await spend.monthToDate(monthKey(new Date(1_000_000)));
    const s = await svc.summarise(sessionId);
    expect(s.status).toBe("complete");
    expect(s.fixes.map((f) => f.errorCode)).toEqual(["ja.particle.destination"]);
    expect(s.didWell[0]).toMatchObject({ evidence: "ラーメンがすきです" });
    expect(s.stats).toMatchObject({ turns: 3, unclearTurns: 1, hintsUsed: 1 });
    // The demo "speech" is 2 s per turn → only 6 s: far too short to move the level, and it says so.
    expect(s.level).toMatchObject({ updated: false, changed: false });
    expect(s.level.reason).toMatch(/too short/);
    expect(await spend.monthToDate(monthKey(new Date(1_000_000)))).toBeGreaterThan(before); // the analysis calls are paid for

    const again = await svc.summarise(sessionId);
    expect(again).toEqual(s);
    expect(await spend.monthToDate(monthKey(new Date(1_000_000)))).toBeGreaterThan(before);
  });

  it("a card the learner reported never appears as a fix", async () => {
    const { svc } = setup();
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "週末" }));
    await rec(svc, sessionId);
    await rec(svc, sessionId);
    const t3 = await rec(svc, sessionId);
    const card = t3.events.find((e) => e.t === "corrections");
    const id = card && card.t === "corrections" ? card.cards[0].id : "";
    await collect(svc.handleEvent(sessionId, { e: "card_report", cardId: id, reason: "was_correct" }));
    await collect(svc.handleEvent(sessionId, { e: "end" }));
    const s = await svc.summarise(sessionId);
    expect(s.fixes).toEqual([]);
    expect(s.worthASecondLook).toEqual([]);
  });

  it("an unknown session is a clear error", async () => {
    const { svc } = setup();
    await expect(svc.summarise("nope")).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });
});

describe("clarification the learner can follow", () => {
  it("a confident transcript the model wants confirmed is shown and answered with the model's question (not 'I couldn't catch that')", async () => {
    const out = (cat: string, sentences: string[]) => ({
      analysis: { category: cat, topic: null, meaning_summary: "greeting", recovered_fragment: null, off_topic_reason: null, meta: { kind: null, word: null }, goal_progress: [], recast_candidate: null },
      reply: { recast: null, sentences, translation: [], teach_phrase: null },
      hints: { hint: "h", starter: "s", example: "e", example_translation: "t" }, words_introduced: [],
    });
    let n = 0;
    const llm = new FakeLlm(() => (n++ === 0 ? out("partially_understood", ["「カルテック」はお名前ですか？"]) : out("understood", ["いいですね！", "何が好きですか？"])));
    const svc = new SessionService({
      store: new MemorySessionStore(), stt: new FakeStt([stt("こんにちは、 カルテック です", 0.92)]), llm, tts: new DemoTts(),
      spend: new MemorySpendStore(), config: loadConfig({}), now: () => 1_000_000, newId: (() => { let i = 0; return () => `id-${++i}`; })(),
    });
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    const r = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    expect(r.events.find((e) => e.t === "transcript")).toMatchObject({ display: "normal", text: "こんにちは、カルテックです" });
    expect(r.events.find((e) => e.t === "category")).toMatchObject({ category: "AMBIGUOUS", action: "CLARIFY" });
    const spoken = r.events.flatMap((e) => (e.t === "sentence" ? [e.text] : []));
    expect(spoken).toEqual(["「カルテック」はお名前ですか？"]);
    expect(spoken.join("")).not.toContain("聞こえませんでした");
  });
});

/** Tutor-turn calls only: translation/correction/summary calls are separate requests. */
const turnCalls = (llm: FakeLlm) => llm.calls.filter((c) => c.schema?.name === "turn_output");

describe("Did you say …? (confirming an uncertain transcript)", () => {
  const goodOut = (sentences = ["こんにちは、カールテクさん！", "今日は何について話しましょうか？"]) => ({
    analysis: { category: "understood", topic: null, meaning_summary: "greeting with name", recovered_fragment: null, off_topic_reason: null, meta: { kind: null, word: null }, goal_progress: [], recast_candidate: null },
    reply: { recast: null, sentences, translation: [], teach_phrase: null },
    hints: { hint: "h", starter: "s", example: "e", example_translation: "t" }, words_introduced: [],
  });
  const mid = () => stt("こんにちは カールテク です", 0.62);

  function make(sttScript: ConstructorParameters<typeof FakeStt>[0]) {
    const s = new FakeStt(sttScript);
    const llm = new FakeLlm(() => goodOut());
    const spend = new MemorySpendStore();
    let i = 0;
    const svc = new SessionService({ store: new MemorySessionStore(), stt: s, llm, tts: new DemoTts(), spend, config: loadConfig({}), now: () => 1_000_000, newId: () => `id-${++i}` });
    return { svc, s, llm, spend };
  }
  const begin = async (svc: SessionService) => {
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    return sessionId;
  };

  it("shows the heard text tentatively, asks the question aloud, and never calls the LLM yet", async () => {
    const { svc, llm } = make([mid()]);
    const id = await begin(svc);
    const r = await collect(svc.handleTurn(id, audio, "audio/webm", speech));
    expect(r.events.find((e) => e.t === "transcript")).toMatchObject({ display: "confirm", text: "こんにちはカールテクです" });
    expect(r.events.find((e) => e.t === "category")).toMatchObject({ category: "CONFIRM_HEARD", action: "CONFIRM_HEARD" });
    expect(r.events.flatMap((e) => (e.t === "sentence" ? [e.text] : []))).toEqual(["「こんにちはカールテクです」と聞こえました。合っていますか？"]);
    expect(llm.calls).toHaveLength(0);
  });

  it("Yes: the same turn continues; Yuki answers; speech-to-text is not paid for twice", async () => {
    const { svc, s, llm, spend } = make([mid()]);
    const id = await begin(svc);
    const ask = await collect(svc.handleTurn(id, audio, "audio/webm", speech));
    const askTurnId = (ask.events.find((e) => e.t === "transcript") as { turnId: string }).turnId;
    const afterAsk = await spend.monthToDate(monthKey(new Date(1_000_000)));
    const r = await collect(svc.handleEvent(id, { e: "confirm_heard", yes: true }));
    expect(s.calls).toBe(1);
    expect(r.events.find((e) => e.t === "transcript")).toMatchObject({ display: "normal", text: "こんにちはカールテクです" });
    expect(r.events.find((e) => e.t === "transcript")).toHaveProperty("turnId", askTurnId); // same bubble as the question, not a new one
    expect(r.events.find((e) => e.t === "category")).toMatchObject({ category: "UNDERSTOOD" });
    expect(r.events.flatMap((e) => (e.t === "sentence" ? [e.text] : [])).join("")).toContain("カールテクさん");
    // The model sees the ORIGINAL question, not our "合っていますか？" prompt, and is told the learner confirmed.
    expect(llm.calls[0].user).toContain("Your last question (expects open): 今日は何について話しましょうか？");
    expect(llm.calls[0].user).not.toContain("合っていますか");
    expect(llm.calls[0].user).toContain("CONFIRMED");
    expect(await spend.monthToDate(monthKey(new Date(1_000_000)))).toBeGreaterThan(afterAsk); // the LLM call
  });

  it("No (mid-conversation): treated as unclear, and the learner is guided ('You can say…') instead of asked again", async () => {
    const { svc, llm } = make([mid()]);
    const id = await begin(svc);
    await collect(svc.handleEvent(id, { e: "topic_chip", label: "食べ物" }));
    await collect(svc.handleTurn(id, audio, "audio/webm", speech));
    const r = await collect(svc.handleEvent(id, { e: "confirm_heard", yes: false }));
    expect(r.events.find((e) => e.t === "transcript")).toMatchObject({ display: "unclear", text: null });
    expect(r.events.find((e) => e.t === "category")).toMatchObject({ action: "SUGGEST_AND_MOVE_ON" });
    expect(llm.calls).toHaveLength(0);
  });

  it("No (while choosing a topic): Yuki picks the topic, so nobody is stuck", async () => {
    const { svc } = make([mid()]);
    const id = await begin(svc);
    await collect(svc.handleTurn(id, audio, "audio/webm", speech));
    const r = await collect(svc.handleEvent(id, { e: "confirm_heard", yes: false }));
    expect(r.events.find((e) => e.t === "category")).toMatchObject({ action: "SURPRISE_TOPIC" });
  });

  it("the confirmation can be answered only once (a retried click does nothing)", async () => {
    const { svc, llm } = make([mid()]);
    const id = await begin(svc);
    await collect(svc.handleTurn(id, audio, "audio/webm", speech));
    await collect(svc.handleEvent(id, { e: "confirm_heard", yes: true }));
    const again = await collect(svc.handleEvent(id, { e: "confirm_heard", yes: true }));
    expect(again.events.some((e) => e.t === "sentence")).toBe(false);
    expect(turnCalls(llm)).toHaveLength(1);
  });

  it("ignoring the buttons and speaking again supersedes the question; a Yes arriving later does nothing", async () => {
    const { svc, llm } = make([mid(), stt("私 は ラーメン が 好き です", 0.95)]);
    const id = await begin(svc);
    await collect(svc.handleTurn(id, audio, "audio/webm", speech)); // asks to confirm
    const next = await collect(svc.handleTurn(id, audio, "audio/webm", speech)); // learner just speaks again, confidently
    expect(next.events.find((e) => e.t === "category")).toMatchObject({ category: "UNDERSTOOD" });
    const stale = await collect(svc.handleEvent(id, { e: "confirm_heard", yes: true }));
    expect(stale.events.some((e) => e.t === "sentence")).toBe(false);
    expect(turnCalls(llm)).toHaveLength(1);
  });

  it("stats: the confirmation prompt is not counted as a turn or as an unclear moment; the Yes is one turn", async () => {
    const { svc } = make([mid()]);
    const id = await begin(svc);
    await collect(svc.handleTurn(id, audio, "audio/webm", speech));
    await collect(svc.handleEvent(id, { e: "confirm_heard", yes: true }));
    await collect(svc.handleEvent(id, { e: "end" }));
    const s = await svc.summarise(id);
    expect(s.stats).toMatchObject({ turns: 1, unclearTurns: 0 });
  });
});

describe("English under every tutor line", () => {
  const turnOut = (topic: string | null, sentences: string[]) => ({
    analysis: { category: "understood", topic, meaning_summary: "x", recovered_fragment: null, off_topic_reason: null, meta: { kind: null, word: null }, goal_progress: [], recast_candidate: null },
    reply: { recast: null, sentences, translation: [], teach_phrase: null },
    hints: { hint: "h", starter: "s", example: "e", example_translation: "t" }, words_introduced: [],
  });
  const mk = (route: (req: { system: string; user: string }) => unknown) => {
    const llm = new FakeLlm((_, req) => route(req));
    let i = 0;
    const svc = new SessionService({
      store: new MemorySessionStore(), stt: new FakeStt([stt("私 は ラーメン が 好き です", 0.95)]), llm, tts: new DemoTts(),
      spend: new MemorySpendStore(), config: loadConfig({}), now: () => 1_000_000, newId: () => `id-${++i}`,
    });
    return { svc, llm };
  };
  const startTopic = async (svc: SessionService) => {
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    return sessionId;
  };

  it("every AI-written line gets a translation event, arriving after the reply (never delaying it)", async () => {
    const { svc } = mk((req) => (req.system.startsWith("TRANSLATE") ? { items: ["Nice!", "What do you like?"] } : turnOut("食べ物", ["いいですね！", "何が好きですか？"])));
    const id = await startTopic(svc);
    const r = await collect(svc.handleTurn(id, audio, "audio/webm", speech));
    const tr = r.events.filter((e) => e.t === "translation");
    expect(tr.map((e) => (e.t === "translation" ? e.text : ""))).toEqual(["Nice!", "What do you like?"]);
    // They point at the right sentences.
    const sentences = r.events.filter((e) => e.t === "sentence");
    expect(tr.map((e) => (e.t === "translation" ? [e.messageId, e.index] : []))).toEqual(sentences.map((e) => (e.t === "sentence" ? [e.messageId, e.index] : [])));
    expect(r.types.indexOf("translation")).toBeGreaterThan(r.types.indexOf("turn_end"));
  });

  it("scripted lines keep their own translations and cost no extra call", async () => {
    const { svc, llm } = mk(() => turnOut("食べ物", ["いいですね！"]));
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    await collect(svc.handleEvent(sessionId, { e: "topic_chip", label: "食べ物" }));
    expect(llm.calls).toHaveLength(0);
  });

  it("if translating fails or returns the wrong count, nothing wrong is shown and the turn still works", async () => {
    for (const bad of [{ items: ["only one"] }, { nonsense: 1 }, new Error("down")]) {
      const { svc } = mk((req) => { if (req.system.startsWith("TRANSLATE")) { if (bad instanceof Error) throw bad; return bad; } return turnOut("食べ物", ["いいですね！", "何が好きですか？"]); });
      const id = await startTopic(svc);
      const r = await collect(svc.handleTurn(id, audio, "audio/webm", speech));
      expect(r.events.some((e) => e.t === "translation")).toBe(false);
      expect(r.events.some((e) => e.t === "error")).toBe(false);
      expect(r.types).toContain("turn_end");
    }
  });
});

describe("topic selection stays open until the learner actually names a topic", () => {
  const turnOut = (topic: string | null) => ({
    analysis: { category: "understood", topic, meaning_summary: "x", recovered_fragment: null, off_topic_reason: null, meta: { kind: null, word: null }, goal_progress: [], recast_candidate: null },
    reply: { recast: null, sentences: ["こんにちは！", "何を話しますか？"], translation: [], teach_phrase: null },
    hints: { hint: "h", starter: "s", example: "e", example_translation: "t" }, words_introduced: [],
  });
  const run = async (topic: string | null) => {
    const svc = new SessionService({
      store: new MemorySessionStore(), stt: new FakeStt([stt("こんにちは、 カルテック です", 0.95)]),
      llm: new FakeLlm((_, req) => (req.system.startsWith("TRANSLATE") ? { items: ["Hi!", "What shall we talk about?"] } : turnOut(topic))),
      tts: new DemoTts(), spend: new MemorySpendStore(), config: loadConfig({}), now: () => 1_000_000,
    });
    const { sessionId } = await svc.createSession({ level: "A2" });
    await collect(svc.handleEvent(sessionId, { e: "start" }));
    const r = await collect(svc.handleTurn(sessionId, audio, "audio/webm", speech));
    return r.events.find((e) => e.t === "turn_end");
  };

  it("a bare greeting/name is answered, but the topic buttons stay (server phase stays TOPIC_SELECTION)", async () => {
    expect(await run(null)).toMatchObject({ phase: "TOPIC_SELECTION" });
  });
  it("naming a topic ends topic selection", async () => {
    expect(await run("食べ物")).toMatchObject({ phase: "CONVERSATION" });
  });
});
