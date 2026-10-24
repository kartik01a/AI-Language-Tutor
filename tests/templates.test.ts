import { describe, expect, it } from "vitest";
import { correctionLine, fallbackHint, GENERIC_HINT } from "@/lib/tutor/templates";

describe("spoken correction line", () => {
  it("wraps the corrected sentence, and unwraps one the model already quoted", () => {
    expect(correctionLine("昨日、公園に行きました。").text).toBe("「昨日、公園に行きました」と言うといいですよ。");
    expect(correctionLine("「昨日、公園に行きました」と言うといいですよ。").text).toBe("「昨日、公園に行きました」と言うといいですよ。");
  });
});

describe("built-in hints", () => {
  it("has an example for the topic chips and a generic one otherwise", () => {
    expect(fallbackHint("食べ物").example).toContain("ラーメン");
    expect(fallbackHint("おまかせ")).toBe(GENERIC_HINT);
    expect(fallbackHint(null)).toBe(GENERIC_HINT);
  });
});
