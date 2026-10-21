import { rm, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { encodeWav, readWavInfo } from "@/lib/audio/wav";
import { cer, editDistance, normaliseKana } from "@/lib/eval/cer";
import { AzureStt, parseAzureStt } from "@/lib/providers/azure-stt";
import { OpenAiStt } from "@/lib/providers/openai-stt";
import { GET, POST } from "@/app/api/dev/clips/route";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

describe("WAV", () => {
  it("round-trips: header fields and length", () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1, 2]), 16000);
    expect(readWavInfo(wav)).toEqual({ sampleRate: 16000, samples: 6, bitsPerSample: 16, channels: 1 });
    expect(wav.length).toBe(44 + 12);
  });
  it("clips out-of-range samples instead of wrapping", () => {
    const v = new DataView(encodeWav(new Float32Array([2, -2]), 16000).buffer);
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32768);
  });
  it("rejects things that aren't our WAVs", () => {
    expect(readWavInfo(new Uint8Array(10))).toBeNull();
    expect(readWavInfo(new Uint8Array(60))).toBeNull();
  });
});

describe("CER (kana-normalised)", () => {
  it("katakana, punctuation, spaces and the long-vowel mark don't count as errors", () => {
    expect(normaliseKana("ラーメン、 が。")).toBe("らめんが");
    expect(cer("わたしはらーめんがすきです", "わたしはラーメンがすきです。")).toBe(0);
  });
  it("is 0 for identical text and counts substitutions, insertions and deletions", () => {
    expect(cer("こんにちは", "こんにちは")).toBe(0);
    expect(cer("こんにちは", "こんばんは")).toBeCloseTo(2 / 5);
    expect(editDistance("abc", "abcd")).toBe(1);
    expect(editDistance("abc", "")).toBe(3);
  });
  it("an empty reference is handled", () => {
    expect(cer("", "")).toBe(0);
    expect(cer("", "あ")).toBe(1);
  });
  it("can exceed 1 when the hypothesis is much longer", () => {
    expect(cer("あ", "あいうえお")).toBe(4);
  });
});

describe("Azure STT adapter", () => {
  it("parses a detailed success response with its single utterance confidence", () => {
    const r = parseAzureStt({ RecognitionStatus: "Success", NBest: [{ Confidence: 0.83, Display: "こんにちは。" }] }, "ja-JP");
    expect(r).toMatchObject({ text: "こんにちは。", words: [{ w: "こんにちは。", conf: 0.83 }] });
  });
  it("NoMatch / InitialSilenceTimeout is an empty transcript, never an invented one", () => {
    expect(parseAzureStt({ RecognitionStatus: "NoMatch" }, "ja-JP").text).toBe("");
    expect(parseAzureStt({ RecognitionStatus: "InitialSilenceTimeout" }, "ja-JP").words).toEqual([]);
  });
  it("maps the language, sends WAV with the key, and refuses non-WAV audio", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const f = (async (url: string, init: RequestInit) => ((seen = { url, init }), json({ RecognitionStatus: "Success", NBest: [{ Confidence: 0.9, Display: "a" }] }))) as unknown as typeof fetch;
    const stt = new AzureStt({ key: "k", region: "centralindia", fetchImpl: f });
    await stt.transcribe(new Uint8Array(4), "audio/wav", ["ja"]);
    expect(seen?.url).toContain("centralindia.stt.speech.microsoft.com");
    expect(seen?.url).toContain("language=ja-JP");
    expect((seen?.init.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"]).toBe("k");
    await expect(stt.transcribe(new Uint8Array(4), "audio/webm", ["ja"])).rejects.toThrow(/WAV/);
  });
  it("surfaces HTTP errors", async () => {
    const bad = (async () => json({}, 401)) as unknown as typeof fetch;
    await expect(new AzureStt({ key: "x", region: "r", fetchImpl: bad }).transcribe(new Uint8Array(1), "audio/wav", ["ja"])).rejects.toThrow(/401/);
  });
});

describe("OpenAI STT adapter", () => {
  it("returns the text with UNKNOWN confidence (null), never a made-up score", async () => {
    const f = (async () => json({ text: " こんにちは " })) as unknown as typeof fetch;
    const r = await new OpenAiStt({ apiKey: "k", fetchImpl: f }).transcribe(new Uint8Array(4), "audio/wav", ["ja"]);
    expect(r.text).toBe("こんにちは");
    expect(r.words).toEqual([{ w: "こんにちは", conf: null }]);
  });
  it("empty text gives no words; errors are reported", async () => {
    expect((await new OpenAiStt({ apiKey: "k", fetchImpl: (async () => json({ text: "" })) as unknown as typeof fetch }).transcribe(new Uint8Array(1), "audio/wav", ["ja"])).words).toEqual([]);
    await expect(new OpenAiStt({ apiKey: "k", fetchImpl: (async () => json({ error: { message: "bad" } }, 400)) as unknown as typeof fetch }).transcribe(new Uint8Array(1), "audio/wav", ["ja"])).rejects.toThrow(/400.*bad/);
  });
});

describe("dev clip-saving endpoint", () => {
  const DIR = path.join(process.cwd(), "eval", "audio", "zz-test");
  const wav = () => new Blob([encodeWav(new Float32Array(1600), 16000) as BlobPart], { type: "audio/wav" });
  const post = (fields: Record<string, string>, audio: Blob | null = wav()) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    if (audio) form.append("audio", audio, "c.wav");
    return POST(new Request("http://x/api/dev/clips", { method: "POST", body: form }));
  };
  afterEach(() => vi.unstubAllEnvs());
  afterAll(() => rm(DIR, { recursive: true, force: true }));

  it("saves a valid 16 kHz mono clip under the speaker's folder", async () => {
    const r = await post({ speaker: "zz-test", promptId: "p01" });
    expect(r.status).toBe(200);
    expect((await stat(path.join(DIR, "p01.wav"))).size).toBe(44 + 3200);
    expect(readWavInfo(new Uint8Array(await readFile(path.join(DIR, "p01.wav"))))?.sampleRate).toBe(16000);
    const list = await (await GET(new Request("http://x/api/dev/clips?speaker=zz-test"))).json();
    expect(list.saved).toContain("p01");
  });

  it.each([
    ["path traversal in the speaker name", { speaker: "../../etc", promptId: "p01" }, 400],
    ["uppercase / odd speaker", { speaker: "Bad Name", promptId: "p01" }, 400],
    ["unknown prompt id (can't choose a file name)", { speaker: "zz-test", promptId: "../x" }, 400],
  ])("rejects %s", async (_n, fields, status) => {
    expect((await post(fields)).status).toBe(status);
  });

  it("rejects non-WAV or wrong-format audio and missing audio", async () => {
    expect((await post({ speaker: "zz-test", promptId: "p02" }, new Blob(["not a wav"]))).status).toBe(415);
    const wrongRate = new Blob([encodeWav(new Float32Array(100), 44100) as BlobPart]);
    expect((await post({ speaker: "zz-test", promptId: "p02" }, wrongRate)).status).toBe(415);
    expect((await post({ speaker: "zz-test", promptId: "p02" }, null)).status).toBe(400);
  });

  it("does not exist in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await post({ speaker: "zz-test", promptId: "p03" })).status).toBe(404);
    expect((await GET(new Request("http://x/api/dev/clips?speaker=zz-test"))).status).toBe(404);
  });
});
