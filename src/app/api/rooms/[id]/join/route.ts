import { ApiError, asString, readBody, respond } from "@/lib/http";
import { joinRoom } from "@/lib/rooms";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    const { id } = await params;
    const body = await readBody(request);
    const seat = body.seat;
    if (seat !== "a" && seat !== "b") throw new ApiError("bad_request");
    return joinRoom(id, seat, asString(body.name));
  });
}
