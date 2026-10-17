import { describe, expect, it } from "vitest";
import { cleanTrack, kanaToShapes, mapAzureVisemes, visemeAt } from "@/lib/avatar/visemes";

const ticks = (ms: number) => ms * 10_000;

describe("Azure viseme mapping", () => {
  it("converts 100-ns ticks to ms and maps IDs", () => {
    const t = mapAzureVisemes([{ visemeId: 21, audioOffset: ticks(100) }, { visemeId: 2, audioOffset: ticks(250) }]);
    expect(t).toEqual([{ t: 100, v: "mbp" }, { t: 250, v: "a" }]);
  });

  it("splits diphthongs 60/40", () => {
    const t = mapAzureVisemes([{ visemeId: 11, audioOffset: 0 }, { visemeId: 0, audioOffset: ticks(200) }]);
    expect(t.slice(0, 2)).toEqual([{ t: 0, v: "a" }, { t: 120, v: "i" }]);
  });

  it("German r is not rounded, English r is", () => {
    const ev = [{ visemeId: 13, audioOffset: 0 }];
    expect(mapAzureVisemes(ev, { locale: "de-DE" })[0].v).toBe("cons");
    expect(mapAzureVisemes(ev, { locale: "en-US" })[0].v).toBe("o");
  });

  it("sorts unordered input and tolerates unknown IDs", () => {
    const t = mapAzureVisemes([{ visemeId: 99, audioOffset: ticks(300) }, { visemeId: 2, audioOffset: ticks(100) }]);
    expect(t.map((x) => x.v)).toEqual(["a", "rest"]);
  });
});

describe("cleanTrack", () => {
  it("merges repeats and absorbs too-short shapes", () => {
    expect(cleanTrack([{ t: 0, v: "a" }, { t: 10, v: "a" }, { t: 20, v: "e" }, { t: 100, v: "o" }])).toEqual([
      { t: 0, v: "e" }, { t: 100, v: "o" },
    ]);
  });
  it("never swallows a lip closure, however brief", () => {
    const t = cleanTrack([{ t: 0, v: "mbp" }, { t: 10, v: "a" }]);
    expect(t).toEqual([{ t: 0, v: "mbp" }, { t: 10, v: "a" }]);
  });
});

describe("visemeAt", () => {
  const track = [{ t: 0, v: "rest" as const }, { t: 100, v: "a" as const }, { t: 300, v: "mbp" as const }];
  it("returns the active shape", () => {
    expect(visemeAt(track, -5)).toBe("rest");
    expect(visemeAt(track, 99)).toBe("rest");
    expect(visemeAt(track, 100)).toBe("a");
    expect(visemeAt(track, 299)).toBe("a");
    expect(visemeAt(track, 5000)).toBe("mbp");
  });
});

describe("kana → mouth shapes (Japanese)", () => {
  it("vowels map directly", () => expect(kanaToShapes("あいうえお")).toEqual(["a", "i", "u", "e", "o"]));
  it("m/b/p onsets show the lip closure before the vowel", () => expect(kanaToShapes("まば")).toEqual(["mbp", "a", "mbp", "a"]));
  it("ふ is bilabial, not teeth-on-lip", () => expect(kanaToShapes("ふ")).not.toContain("fv"));
  it("katakana is handled like hiragana", () => expect(kanaToShapes("アイ")).toEqual(["a", "i"]));
  it("ん before b/m/p closes, final ん rests", () => {
    expect(kanaToShapes("しんぶん")).toEqual(["cons", "i", "mbp", "mbp", "u", "rest"]);
  });
  it("っ holds the next closure", () => expect(kanaToShapes("いっぽん")[1]).toBe("mbp"));
  it("long vowel extends the previous vowel", () => expect(kanaToShapes("おー")).toEqual(["o", "o"]));
  it("yōon: onset + small-kana vowel", () => expect(kanaToShapes("しゃ")).toEqual(["cons", "a"]));
  it("punctuation rests", () => expect(kanaToShapes("あ。")).toEqual(["a", "rest"]));
});
