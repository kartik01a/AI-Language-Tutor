// Length-prefixed frame protocol for the streamed turn response (docs/11 §3.2).
// [type:1][length:4 big-endian][payload:length]. 0x01 = JSON event, 0x02 = audio bytes.

export const FRAME_JSON = 0x01;
export const FRAME_AUDIO = 0x02;
export const MAX_FRAME_BYTES = 4 * 1024 * 1024;

export type Frame =
  | { type: typeof FRAME_JSON; json: unknown }
  | { type: typeof FRAME_AUDIO; bytes: Uint8Array };

function header(type: number, length: number): Uint8Array {
  const h = new Uint8Array(5);
  h[0] = type;
  new DataView(h.buffer).setUint32(1, length, false);
  return h;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function encodeJsonFrame(value: unknown): Uint8Array {
  const payload = new TextEncoder().encode(JSON.stringify(value));
  return concat(header(FRAME_JSON, payload.length), payload);
}

export function encodeAudioFrame(bytes: Uint8Array): Uint8Array {
  return concat(header(FRAME_AUDIO, bytes.length), bytes);
}

/** Incremental decoder: feed arbitrary network chunks, receive complete frames. */
export class FrameDecoder {
  private buf: Uint8Array<ArrayBufferLike> = new Uint8Array(0);

  push(chunk: Uint8Array): Frame[] {
    this.buf = this.buf.length ? concat(this.buf, chunk) : chunk;
    const frames: Frame[] = [];
    for (;;) {
      if (this.buf.length < 5) break;
      const type = this.buf[0];
      const length = new DataView(this.buf.buffer, this.buf.byteOffset + 1, 4).getUint32(0, false);
      if (type !== FRAME_JSON && type !== FRAME_AUDIO) throw new Error(`Unknown frame type ${type}`);
      if (length > MAX_FRAME_BYTES) throw new Error(`Frame too large: ${length}`);
      if (this.buf.length < 5 + length) break;
      const payload = this.buf.slice(5, 5 + length);
      this.buf = this.buf.slice(5 + length);
      frames.push(
        type === FRAME_JSON
          ? { type, json: JSON.parse(new TextDecoder().decode(payload)) }
          : { type, bytes: payload },
      );
    }
    return frames;
  }

  /** Bytes buffered but not yet forming a full frame (non-zero at stream end = truncation). */
  get pending(): number {
    return this.buf.length;
  }
}
