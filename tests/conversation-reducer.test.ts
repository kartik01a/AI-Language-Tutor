import { describe, expect, it } from "vitest";
import { initialUi, reducer, type UiState } from "@/components/conversation/reducer";

const at = (phase: UiState["phase"]): UiState => ({ ...initialUi, phase });

describe("conversation reducer", () => {
  it("phase changes normally", () => {
    expect(reducer(at("waiting"), { type: "phase", phase: "recording" }).phase).toBe("recording");
  });
  it("an ended session never reopens", () => {
    expect(reducer(at("ended"), { type: "phase", phase: "waiting" }).phase).toBe("ended");
  });
  it("a failed session stays failed unless explicitly reset", () => {
    expect(reducer(at("error"), { type: "phase", phase: "waiting" }).phase).toBe("error");
    expect(reducer(at("error"), { type: "phase", phase: "intro" }).phase).toBe("intro");
  });
  it("starting to record clears the hint banner", () => {
    const s = { ...at("waiting"), hint: { level: 1, text: "x" } };
    expect(reducer(s, { type: "phase", phase: "recording" }).hint).toBeNull();
    expect(reducer(s, { type: "phase", phase: "processing" }).hint).not.toBeNull();
  });
  it("fatal errors end the flow; non-fatal ones only show a message", () => {
    expect(reducer(at("waiting"), { type: "error", message: "x", fatal: true }).phase).toBe("error");
    const soft = reducer(at("waiting"), { type: "error", message: "retry" });
    expect(soft.phase).toBe("waiting");
    expect(soft.error).toBe("retry");
  });
  it("appends messages in order and records the end reason", () => {
    let s = reducer(initialUi, { type: "message", message: { id: "1", role: "tutor", text: "a" } });
    s = reducer(s, { type: "message", message: { id: "2", role: "learner", text: "b" } });
    expect(s.messages.map((m) => m.id)).toEqual(["1", "2"]);
    expect(reducer(s, { type: "ended", reason: "time" })).toMatchObject({ phase: "ended", endReason: "time" });
  });
});

describe("confirmation bubble", () => {
  const confirming = { id: "t1", role: "learner" as const, text: "こんにちは", confirming: true };

  it("a tentative bubble shows the buttons for its turn", () => {
    const s = reducer(initialUi, { type: "message", message: confirming });
    expect(s.confirmTurnId).toBe("t1");
    expect(s.messages).toHaveLength(1);
  });

  it("the answer REPLACES the same bubble (no duplicate) and clears the question", () => {
    let s = reducer(initialUi, { type: "message", message: confirming });
    s = reducer(s, { type: "message", message: { id: "t1", role: "learner", text: "こんにちは" } });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].confirming).toBeUndefined();
    expect(s.confirmTurnId).toBeNull();
  });

  it("a 'No' replaces it with the unclear bubble", () => {
    let s = reducer(initialUi, { type: "message", message: confirming });
    s = reducer(s, { type: "message", message: { id: "t1", role: "learner", text: "(I couldn't catch this)", unclear: true } });
    expect(s.messages[0]).toMatchObject({ unclear: true });
    expect(s.confirmTurnId).toBeNull();
  });

  it("speaking again withdraws an unanswered question", () => {
    let s = reducer(initialUi, { type: "message", message: confirming });
    s = reducer(s, { type: "confirm_clear" });
    expect(s.confirmTurnId).toBeNull();
    expect(s.messages[0]).toMatchObject({ confirming: false, unclear: true });
  });

  it("other messages are unaffected, and ordering is preserved", () => {
    let s = reducer(initialUi, { type: "message", message: { id: "a", role: "tutor", text: "x" } });
    s = reducer(s, { type: "message", message: confirming });
    s = reducer(s, { type: "message", message: { id: "b", role: "tutor", text: "y" } });
    s = reducer(s, { type: "message", message: { id: "t1", role: "learner", text: "final" } });
    expect(s.messages.map((m) => m.id)).toEqual(["a", "t1", "b"]);
    expect(s.messages[1].text).toBe("final");
  });
});

describe("translations", () => {
  it("attach to the right tutor message once they arrive", () => {
    let s = reducer(initialUi, { type: "message", message: { id: "m-0", role: "tutor", text: "いいですね！" } });
    s = reducer(s, { type: "message", message: { id: "m-1", role: "tutor", text: "何が好きですか？" } });
    s = reducer(s, { type: "translation", id: "m-1", text: "What do you like?" });
    expect(s.messages.map((m) => m.translation)).toEqual([undefined, "What do you like?"]);
  });
  it("a translation for an unknown message is ignored", () => {
    const s = reducer(initialUi, { type: "translation", id: "ghost", text: "x" });
    expect(s.messages).toEqual([]);
  });
});
