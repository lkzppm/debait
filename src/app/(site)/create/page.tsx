import type { Metadata } from "next";
import { Create } from "@/components/site/create";
import { isAdmin, usingDevPassword } from "@/lib/admin";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Create · ${BRAND.name}`, robots: { index: false } };

/** Creating a debate needs the admin password; the form appears once the cookie is set. */
export default async function CreatePage() {
  return <Create authed={await isAdmin()} devHint={usingDevPassword()} />;
}
