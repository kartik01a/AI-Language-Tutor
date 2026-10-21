import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/lib/audio/formats";
import { frameResponse, getService } from "@/lib/server/runtime";

const meta = z.object({ speechMs: z.number().min(0).max(120_000), clipMs: z.number().min(0).max(120_000) });
const ALLOWED = /^audio\/(webm|mp4|ogg|wav|x-wav|mpeg|aac|x-m4a)/;

export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]/turns">) {
  const { id } = await ctx.params;
  const bad = (code: string, message: string, status: number) => Response.json({ error: { code, message } }, { status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!form || !(file instanceof Blob)) return bad("BAD_REQUEST", "Missing audio", 400);
  if (file.size > MAX_UPLOAD_BYTES) return bad("PAYLOAD_TOO_LARGE", "Audio too large", 413);
  if (!ALLOWED.test(file.type)) return bad("BAD_REQUEST", "Unsupported audio type", 415);

  let m;
  try {
    m = meta.parse(JSON.parse(String(form.get("meta") ?? "")));
  } catch {
    return bad("BAD_REQUEST", "Invalid meta", 400);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return frameResponse(getService().handleTurn(id, bytes, file.type, m));
}
