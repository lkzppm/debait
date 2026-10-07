import type { Metadata } from "next";
import { Join } from "@/components/site/join";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Join · ${BRAND.name}` };

export default function JoinPage() {
  return <Join />;
}
