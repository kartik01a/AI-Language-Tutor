// Recorder format selection (docs/05 §2): WebM/Opus where available (Chrome, iOS 18.4+),
// else MP4/AAC (older iOS). Both are accepted by the STT providers as-is.

const PREFERENCE = [
  { mime: "audio/webm;codecs=opus", ext: "webm" },
  { mime: "audio/mp4", ext: "m4a" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
] as const;

export interface RecorderFormat {
  mime: string | undefined;
  ext: string;
}

export function pickRecorderFormat(isTypeSupported: (mime: string) => boolean): RecorderFormat {
  for (const f of PREFERENCE) if (isTypeSupported(f.mime)) return { mime: f.mime, ext: f.ext };
  // Let the browser choose; the server detects the container from the upload.
  return { mime: undefined, ext: "webm" };
}

/** Container extension for a recorded blob's MIME type (e.g. "audio/webm;codecs=opus" → "webm"). */
export function extensionFor(mime: string): string {
  if (mime.startsWith("audio/webm")) return "webm";
  if (mime.startsWith("audio/mp4") || mime.startsWith("audio/aac") || mime.startsWith("audio/x-m4a")) return "m4a";
  if (mime.startsWith("audio/ogg")) return "ogg";
  if (mime.startsWith("audio/wav") || mime.startsWith("audio/x-wav")) return "wav";
  if (mime.startsWith("audio/mpeg")) return "mp3";
  return "webm";
}

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
