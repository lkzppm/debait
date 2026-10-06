import { checkPassword, endSession, startSession } from "@/lib/admin";
import { ApiError, asString, readBody, respond } from "@/lib/http";

export async function POST(request: Request) {
  return respond(async () => {
    const body = await readBody(request);
    // A short pause makes guessing the password slow.
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (!checkPassword(asString(body.password))) throw new ApiError("unauthorized");
    await startSession();
  });
}

export async function DELETE() {
  return respond(async () => {
    await endSession();
  });
}
