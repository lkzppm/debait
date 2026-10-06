import type { Metadata } from "next";
import { Admin } from "@/components/admin/admin";
import { isAdmin, usingDevPassword } from "@/lib/admin";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Admin · ${BRAND.name}`, robots: { index: false } };

export default async function AdminPage() {
  return <Admin authed={await isAdmin()} devHint={usingDevPassword()} />;
}
