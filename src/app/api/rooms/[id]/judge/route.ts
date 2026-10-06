import { after } from "next/server";
import { retryJudgement, runJudgement } from "@/lib/debate/run";
import { asString, readBody, respond } from "@/lib/http";
import { normalizeRoomId } from "@/lib/rooms";

export const maxDuration = 60;

/** Retries the judgement of a message whose first attempt failed or got lost. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const { id } = await params;
    const body = await readBody(request);
    const messageId = asString(body.messageId);
    await retryJudgement(id, asString(body.token), messageId);
    const roomId = normalizeRoomId(id)!;
    after(() => runJudgement(roomId, messageId));
  });
}
