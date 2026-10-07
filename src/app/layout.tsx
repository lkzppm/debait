import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { Inter } from "next/font/google";
import LocaleProvider from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { THEME_SCRIPT } from "@/lib/use-theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#070708" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang` follows the visitor's choice after hydration (LocaleProvider), and
    // the `dark` class is corrected before the first paint by the script below.
    <html lang="pt-BR" className={`dark ${inter.variable} ${GeistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
