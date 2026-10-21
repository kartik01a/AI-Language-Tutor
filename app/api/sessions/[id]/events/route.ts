import { z } from "zod";
import { frameResponse, getService } from "@/lib/server/runtime";

const event = z.discriminatedUnion("e", [
  z.object({ e: z.literal("start") }),
  z.object({ e: z.literal("topic_chip"), label: z.string().min(1).max(40) }),
  z.object({ e: z.literal("hint_request") }),
  z.object({ e: z.literal("confirm_heard"), yes: z.boolean() }),
  z.object({ e: z.literal("card_report"), cardId: z.string().min(1).max(100), reason: z.enum(["was_correct", "misheard", "other"]) }),
  z.object({ e: z.literal("silence_timeout") }),
  z.object({ e: z.literal("end") }),
]);

export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]/events">) {
  const { id } = await ctx.params;
  const parsed = event.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid event" } }, { status: 400 });
  return frameResponse(getService().handleEvent(id, parsed.data));
}
