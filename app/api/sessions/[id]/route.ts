import { z } from "zod";
import { errorStatus, getService } from "@/lib/server/runtime";
import { ServiceError } from "@/lib/session/service";

const body = z.object({ coachMode: z.enum(["tutor", "casual"]) });

/** Switch between Tutor mode (corrections) and Casual mode (just talk) during a conversation. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid request" } }, { status: 400 });
  try {
    await getService().setCoachMode(id, parsed.data.coachMode);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof ServiceError) return Response.json({ error: { code: e.code, message: e.message } }, { status: errorStatus(e.code) });
    throw e;
  }
}
