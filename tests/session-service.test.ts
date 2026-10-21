import { describe, expect, it } from "vitest";
import { loadConfig } from "@/lib/config";
import { MemorySpendStore, monthKey } from "@/lib/limits/budget";
import { DemoLlm, DemoStt, DemoTts } from "@/lib/providers/demo";
import { FakeStt, stt } from "@/lib/providers/fakes";
import { SessionService, ServiceError, type OutFrame } from "@/lib/session/service";
import { MemorySessionStore } from "@/lib/session/store";
import type { ServerEvent } from "@/lib/contracts/events";
import type { SttProvider } from "@/lib/providers/types";

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
