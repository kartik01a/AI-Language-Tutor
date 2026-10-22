import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasErrors, validateAvatarSvg } from "@/lib/avatar/contract";
import { AvatarController, blinkProfile, nextBlinkDelayMs, BLINK_DURATION_MS } from "@/lib/avatar/controller";

const svg = readFileSync("assets/avatars/src/ja-yuki.svg", "utf8");
const rules = (s: string) => validateAvatarSvg(s).filter((i) => i.level === "error").map((i) => i.rule);

describe("avatar contract", () => {
  it("the Yuki avatar satisfies the MVP contract", () => {
    expect(validateAvatarSvg(svg).filter((i) => i.level === "error")).toEqual([]);
  });

  it.each([
    ['viewBox="0 0 512 512"', 'viewBox="0 0 100 100"', "root.viewBox"],
    ['data-contract="1"', "", "root.contract"],
    ['<svg xmlns="http://www.w3.org/2000/svg"', '<svg width="512" xmlns="http://www.w3.org/2000/svg"', "root.size"],
    ['id="mouth_mbp"', 'id="mouth_rest"', "id.unique"],
    ['id="expr_confused"', 'id="Expr-Confused"', "id.format"],
    ['id="head" data-pivot="256 440"', 'id="head"', "pivot"],
    ["</g>\n  </g>\n</svg>", '<text>x</text></g>\n  </g>\n</svg>', "forbidden.tag"],
    ['<g id="mouth_rest" visibility="hidden">', '<g id="mouth_rest" display="none">', "hidden"],
    ['href="/avatars/ja-yuki-art.webp"', 'href="https://example.com/x.png"', "image.href"],
    ['href="/avatars/ja-yuki-art.webp"', 'href="data:image/png;base64,AAAA"', "image.href"],
    ['<g id="body" data-pivot="256 500"></g>', '<g id="body" data-pivot="256 500"><image href="/avatars/ja-yuki-art.webp" width="1" height="1"/></g>', "image.count"],
  ])("rejects a broken asset (%#)", (from, to, rule) => {
    expect(svg).toContain(from);
    expect(rules(svg.replace(from, to))).toContain(rule);
  });

  it("reports missing required groups", () => {
    expect(rules(svg.replace('id="mouth_o"', 'id="mouth_zz"'))).toContain("id.required");
  });

  it("flags empty mouth shapes", () => {
    const empty = svg.replace(/(<g id="mouth_u" visibility="hidden">)[\s\S]*?(<\/g>)/, "$1$2");
    expect(rules(empty)).toContain("mouth.empty");
  });

  it("enforces the hard size budget", () => {
    const big = svg.replace("</svg>", `<!-- ${"x".repeat(130_000)} --></svg>`);
    expect(rules(big)).toContain("budget.bytes");
  });

  it("production tier additionally requires encouraging/celebrating/cheeks/shadow", () => {
    const prod = validateAvatarSvg(svg.replace('id="cheeks"', 'id="cheeksx"'), "production");
    expect(hasErrors(prod)).toBe(true);
  });
});

describe("blink timing", () => {
  const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

  it("delays stay within 1.2–8 s, shorter while speaking on average", () => {
    const r = seeded(7);
    const idle = Array.from({ length: 500 }, () => nextBlinkDelayMs(r, false));
    const talk = Array.from({ length: 500 }, () => nextBlinkDelayMs(r, true));
    for (const d of [...idle, ...talk]) { expect(d).toBeGreaterThanOrEqual(1200); expect(d).toBeLessThanOrEqual(8000); }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(mean(talk)).toBeLessThan(mean(idle));
  });

  it("blink profile closes then reopens", () => {
    expect(blinkProfile(0)).toBe(0);
    expect(blinkProfile(60)).toBe(1);
    expect(blinkProfile(80)).toBe(1);
    expect(blinkProfile(BLINK_DURATION_MS - 1)).toBeLessThan(0.1);
    expect(blinkProfile(BLINK_DURATION_MS + 5)).toBe(0);
  });
});

describe("AvatarController", () => {
  const rng = () => 0.9; // no double blinks, deterministic

  it("idle: rest mouth, neutral expression, gentle breathing", () => {
    const c = new AvatarController(rng);
    const f = c.frame(1000);
    expect(f.mouth).toBe("rest");
    expect(f.expression).toBe("neutral");
    expect(f.bodyScaleY).toBeGreaterThan(0.98);
    expect(f.bodyScaleY).toBeLessThan(1.02);
  });

  it("states map to expressions and rest mouths", () => {
    const c = new AvatarController(rng);
    c.setState("confused");
    expect(c.frame(0)).toMatchObject({ expression: "confused", mouth: "o" });
    c.setState("celebrating");
    expect(c.frame(10)).toMatchObject({ expression: "celebrating", mouth: "a" });
    c.setState("thinking");
    expect(c.frame(20)).toMatchObject({ expression: "thinking", pupil: { x: -2, y: -2 } });
  });

  it("follows a viseme track against the audio clock", () => {
    const c = new AvatarController(rng);
    let audio = 0; // elapsed audible ms since the message started
    c.playVisemeTrack([{ t: 0, v: "a" }, { t: 100, v: "mbp" }, { t: 250, v: "rest" }], () => audio);
    expect(c.getState()).toBe("speaking");
    expect(c.frame(0).mouth).toBe("a");
    audio = 120;
    expect(c.frame(120).mouth).toBe("mbp");
    audio = 300;
    expect(c.frame(300).mouth).toBe("rest");
    c.stopSpeaking();
    c.setState("listening");
    expect(c.frame(400).mouth).toBe("rest");
  });

  it("reduced motion: no sway, breathing or jump — but blinking stays", () => {
    const c = new AvatarController(rng);
    c.setReducedMotion(true);
    c.setState("celebrating");
    const f = c.frame(1234);
    expect(f.bodyScaleY).toBe(1);
    expect(f.rigOffsetY).toBe(0);
    expect(f.headRotationDeg).toBe(0);
    c.setReducedMotion(false);
    c.setState("idle");
    let blinked = false;
    const c2 = new AvatarController(rng);
    c2.setReducedMotion(true);
    for (let t = 0; t < 12000; t += 16) if (c2.frame(t).blink > 0) blinked = true;
    expect(blinked).toBe(true);
  });

  it("listening tilts the head and uses short blinks", () => {
    const c = new AvatarController(rng);
    c.setState("listening");
    expect(c.frame(0).headRotationDeg).toBeGreaterThan(2);
    c.blink();
    const peak = Math.max(...[0, 20, 40, 60].map((t) => c.frame(t).blink));
    expect(peak).toBe(1);
  });

  it("later sentences are placed on the message timeline, and nothing shows before audio starts", () => {
    const c = new AvatarController(rng);
    let audio = -40; // audio not audible yet (output latency)
    c.startMessage(() => audio);
    c.appendVisemes([{ t: 0, v: "a" }, { t: 100, v: "e" }]);
    c.appendVisemes([{ t: 0, v: "o" }], 800); // second sentence starts 800 ms into the message
    expect(c.frame(0).mouth).toBe("rest");
    audio = 50;
    expect(c.frame(1).mouth).toBe("a");
    audio = 850;
    expect(c.frame(2).mouth).toBe("o");
  });

  it("an explicit viseme overrides the track (for the Avatar Lab)", () => {
    const c = new AvatarController(rng);
    c.setViseme("fv");
    expect(c.frame(0).mouth).toBe("fv");
    c.setViseme(null);
    expect(c.frame(1).mouth).toBe("rest");
  });
});
