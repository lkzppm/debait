import { after } from "next/server";
import { postMention, runMention } from "@/lib/debate/run";
import { asString, readBody, respond } from "@/lib/http";
import { normalizeRoomId } from "@/lib/rooms";

// A web search can take a while; the answer is written after the response.
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const { id } = await params;
    const body = await readBody(request);
    const replyTo = typeof body.replyTo === "string" && body.replyTo ? body.replyTo : null;
    const ask = await postMention(id, asString(body.token), asString(body.text), replyTo);
    const roomId = normalizeRoomId(id)!;
    after(() => runMention(roomId, ask.id));
    return ask;
  });
}
