import { FRAME_AUDIO, FRAME_JSON, FrameDecoder } from "@/lib/contracts/frames";
import type { ServerEvent } from "@/lib/contracts/events";

/** Reads a streamed turn/event response, calling back per JSON event and audio frame, in order. */
export async function readFrames(
  res: Response,
  on: { event: (e: ServerEvent) => void | Promise<void>; audio: (b: Uint8Array) => void | Promise<void> },
): Promise<void> {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const dec = new FrameDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    for (const f of dec.push(value)) {
      if (f.type === FRAME_JSON) await on.event(f.json as ServerEvent);
      else if (f.type === FRAME_AUDIO) await on.audio(f.bytes);
    }
  }
  if (dec.pending > 0) throw new Error("Stream ended mid-frame");
}
