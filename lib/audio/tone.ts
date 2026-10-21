/** 16-bit mono PCM WAV containing a sine tone; used by the audio self-test (no TTS needed). */
export function makeToneWav(freqHz: number, ms: number, sampleRate = 22050, amplitude = 0.3): Uint8Array {
  const n = Math.round((ms / 1000) * sampleRate);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  const fade = Math.min(200, n >> 2);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / fade, (n - 1 - i) / fade);
    v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * freqHz * i) / sampleRate) * amplitude * env * 32767), true);
  }
  return new Uint8Array(buf);
}
