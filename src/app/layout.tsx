import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import LocaleProvider from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND.name,
  description:
    "A debate room with an AI referee: every argument is scored live with the math on screen, and either side can call @deb to check a claim.",
};

// The on-screen keyboard shrinks the layout (Chrome on Android), keeping the composer in view.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  themeColor: "#0b0b10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang` follows the visitor's choice after hydration (LocaleProvider).
    <html lang="pt-BR" className={`dark ${GeistSans.variable} ${GeistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full font-sans">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
