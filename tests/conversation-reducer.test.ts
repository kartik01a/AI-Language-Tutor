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
