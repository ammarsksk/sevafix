import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Newsreader } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { Providers } from "@/lib/providers";

import "./globals.css";

const displayFont = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  preload: true,
});

const uiFont = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  preload: true,
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "SevaFix — Government application preparation",
    template: "%s · SevaFix",
  },
  description:
    "Understand requirements, check documents, and fix preventable issues before submitting through the official government portal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${displayFont.variable} ${uiFont.variable} ${monoFont.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
