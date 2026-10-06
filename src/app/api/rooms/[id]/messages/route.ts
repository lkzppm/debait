import { after } from "next/server";
import { postMessage, runJudgement } from "@/lib/debate/run";
import { asString, readBody, respond } from "@/lib/http";
import { normalizeRoomId } from "@/lib/rooms";

// The judgement runs after the response, inside this function's lifetime.
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const { id } = await params;
    const body = await readBody(request);
    const message = await postMessage(id, asString(body.token), asString(body.text));
    const roomId = normalizeRoomId(id)!;
    after(() => runJudgement(roomId, message.id));
    return message;
  });
}
