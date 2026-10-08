import { asString, readBody, respond } from "@/lib/http";
import { markTyping } from "@/lib/rooms";

/** A debater is typing; the browser pings this every few seconds while they write. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const { id } = await params;
    const body = await readBody(request);
    await markTyping(id, asString(body.token));
  });
}
