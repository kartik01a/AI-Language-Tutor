import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWarmKeeper } from "@/lib/server/http";

describe("connection keeper", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      calls.push(String(u));
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const keeper = createWarmKeeper([{ url: "https://a.test/x" }, { url: "https://b.test/y" }], { everyMs: 3000, idleStopMs: 60_000, fetchImpl, now: () => Date.now() });
    return { calls, keeper };
  };

  it("pings every target immediately and then every interval while active", async () => {
    const { calls, keeper } = make();
    keeper.touch();
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(9000);
    expect(calls).toHaveLength(8);
    keeper.stop();
  });

  it("does not start a second timer on repeated touches", async () => {
    const { calls, keeper } = make();
    keeper.touch();
    keeper.touch();
    keeper.touch();
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls).toHaveLength(4);
    keeper.stop();
  });

  it("stops by itself after the idle window", async () => {
    const { calls, keeper } = make();
    keeper.touch();
    await vi.advanceTimersByTimeAsync(70_000);
    const n = calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls).toHaveLength(n);
  });

  it("restarts after going idle when touched again", async () => {
    const { calls, keeper } = make();
    keeper.touch();
    await vi.advanceTimersByTimeAsync(70_000);
    const n = calls.length;
    keeper.touch();
    expect(calls.length).toBe(n + 2);
    keeper.stop();
  });
});
