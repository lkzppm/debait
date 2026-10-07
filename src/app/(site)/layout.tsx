import { Nav } from "@/components/site/nav";

/** The pages outside a room share the top bar, which stays put while the page under it changes. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  );
}
