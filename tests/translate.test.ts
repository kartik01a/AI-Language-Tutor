import { describe, expect, it } from "vitest";
import { translateLines } from "@/lib/tutor/translate";
import { FakeLlm } from "@/lib/providers/fakes";

describe("translateLines", () => {
  it("returns one trimmed translation per line, in order, with a strict schema and no reasoning", async () => {
    const llm = new FakeLlm(() => ({ items: [" Nice! ", "What do you like?"] }));
    const r = await translateLines(llm, ["いいですね！", "何が好きですか？"]);
    expect(r?.items).toEqual(["Nice!", "What do you like?"]);
    expect(llm.calls[0].user).toBe("1. いいですね！\n2. 何が好きですか？");
    expect(llm.calls[0].schema?.name).toBe("translations");
    expect(llm.calls[0].effort).toBe("none");
  });
  it("makes no call for no lines", async () => {
    const llm = new FakeLlm(() => ({ items: [] }));
    expect(await translateLines(llm, [])).toBeNull();
    expect(llm.calls).toHaveLength(0);
  });
  it.each([
    ["wrong count", { items: ["one"] }],
    ["blank item", { items: ["ok", "  "] }],
    ["bad shape", { oops: true }],
  ])("rejects %s rather than guessing which line is which", async (_n, out) => {
    expect(await translateLines(new FakeLlm(() => out), ["a", "b"])).toBeNull();
  });
  it("swallows provider errors", async () => {
    expect(await translateLines(new FakeLlm(() => new Error("down")), ["a"])).toBeNull();
  });
});
