import { requireAdmin } from "@/lib/admin";
import { respond } from "@/lib/http";
import { stopRoom } from "@/lib/rooms";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    await requireAdmin();
    await stopRoom((await params).id);
  });
}
