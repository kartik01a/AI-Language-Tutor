import { z } from "zod";
import { getService, errorStatus } from "@/lib/server/runtime";
import { ServiceError } from "@/lib/session/service";

const body = z.object({
  level: z.enum(["A1", "A2", "B1", "B2"]).default("A2"),
  strictness: z.enum(["relaxed", "balanced", "strict"]).optional(),
  firstName: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid request" } }, { status: 400 });
  try {
    return Response.json(await getService().createSession(parsed.data));
  } catch (e) {
    if (e instanceof ServiceError) return Response.json({ error: { code: e.code, message: e.message } }, { status: errorStatus(e.code) });
    throw e;
  }
}
