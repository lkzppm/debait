import { engineInfo } from "@/judge";
import { requireAdmin } from "@/lib/admin";
import { asString, readBody, respond } from "@/lib/http";
import { createRoom, listRooms } from "@/lib/rooms";
import { kv } from "@/lib/store";
import { BUDGET_STOP, getDailyUsage, LIMITS } from "@/lib/usage";
import { isLocale } from "@/i18n/locales";

export const dynamic = "force-dynamic";

/** Everything the admin panel shows, in one request so it can poll. */
export async function GET() {
  return respond(async () => {
    await requireAdmin();
    const [rooms, usage] = await Promise.all([listRooms(), getDailyUsage()]);
    return { rooms, usage, engine: engineInfo(), store: kv().kind, limits: LIMITS, budgetStop: BUDGET_STOP };
  });
}

export async function POST(request: Request) {
  return respond(async () => {
    await requireAdmin();
    const body = await readBody(request);
    return createRoom({
      motion: asString(body.motion),
      stanceA: asString(body.stanceA),
      stanceB: asString(body.stanceB),
      locale: isLocale(body.locale) ? body.locale : "pt",
      rounds: body.rounds,
      charLimit: body.charLimit,
      challenges: body.challenges,
    });
  });
}
