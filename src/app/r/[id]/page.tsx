import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Room } from "@/components/room/room";
import { engineInfo } from "@/judge";
import { BRAND } from "@/lib/brand";
import { getRoom, normalizeRoomId, toMeta } from "@/lib/rooms";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function load(params: Props["params"]) {
  const id = normalizeRoomId((await params).id);
  return id ? getRoom(id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const room = await load(params);
  return { title: room ? `${room.motion} · ${BRAND.name}` : BRAND.name };
}

export default async function RoomPage({ params }: Props) {
  const room = await load(params);
  if (!room) notFound();
  return <Room meta={toMeta(room)} engine={engineInfo().kind} />;
}
