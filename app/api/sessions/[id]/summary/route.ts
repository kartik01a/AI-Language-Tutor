import { errorStatus, getService } from "@/lib/server/runtime";
import { ServiceError } from "@/lib/session/service";

export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]/summary">) {
  const { id } = await ctx.params;
  try {
    return Response.json(await getService().summarise(id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ServiceError) return Response.json({ error: { code: e.code, message: e.message } }, { status: errorStatus(e.code) });
    throw e;
  }
}
