import { requireAdmin } from "@/lib/admin";
import { respond } from "@/lib/http";
import { deleteRoom } from "@/lib/rooms";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(async () => {
    await requireAdmin();
    await deleteRoom((await params).id);
  });
}
