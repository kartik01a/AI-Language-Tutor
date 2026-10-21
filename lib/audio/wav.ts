/** 16-bit mono PCM WAV. All three recognisers we compare accept it (Azure's REST API does not accept WebM). */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

/** Minimal reader for the WAVs we write: returns the sample rate and sample count. */
export function readWavInfo(wav: Uint8Array): { sampleRate: number; samples: number; bitsPerSample: number; channels: number } | null {
  if (wav.length < 44 || String.fromCharCode(...wav.slice(0, 4)) !== "RIFF" || String.fromCharCode(...wav.slice(8, 12)) !== "WAVE") return null;
  const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const bits = v.getUint16(34, true);
  return { sampleRate: v.getUint32(24, true), channels: v.getUint16(22, true), bitsPerSample: bits, samples: v.getUint32(40, true) / (bits / 8) };
}

/** Browser only: decode any recorded blob and re-sample to 16 kHz mono WAV. */
export async function blobToWav16k(blob: Blob): Promise<Uint8Array> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();
  const target = 16000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * target)), target);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return encodeWav(rendered.getChannelData(0), target);
}
