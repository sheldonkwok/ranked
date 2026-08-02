import type { Metadata } from "next";
import { Press_Start_2P, Silkscreen } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

const pressStart2p = Press_Start_2P({
  variable: "--font-press-start-2p",
  weight: "400",
  subsets: ["latin"],
});

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Ranked",
    template: "%s — Ranked",
  },
  description: "Rank the video games you've played, Beli-style.",
  openGraph: {
    title: "Ranked",
    description: "Rank the video games you've played, Beli-style.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${pressStart2p.variable} ${silkscreen.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        {/* Fixed pixel-art backdrop + legibility scrims, behind all content. */}
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/bg-forest.png)", backgroundColor: "var(--color-bg)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[1]"
          style={{
            background: "linear-gradient(180deg, rgba(4,8,18,0.72) 0%, rgba(4,8,18,0.32) 45%, rgba(4,8,18,0.5) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[1]"
          style={{ background: "radial-gradient(ellipse at 50% 110%, rgba(4,8,18,0.35) 0%, transparent 55%)" }}
        />

        <div className="relative z-[3]">
          <header
            className="border-b border-edge/35 backdrop-blur-[2px]"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 88%, transparent) 0%, color-mix(in srgb, var(--color-panel) 62%, transparent) 100%)",
            }}
          >
            <div className="mx-auto flex max-w-[980px] items-center justify-between gap-6 px-6 py-4">
              <Link href="/" className="flex items-center gap-3.5">
                <div
                  className="h-4 w-4 bg-ink"
                  style={{
                    boxShadow:
                      "5px 0 0 var(--color-blue-bright), 0 5px 0 var(--color-gold), 5px 5px 0 var(--color-blue)",
                  }}
                />
                <span
                  className="pixel-heading ml-1.5 text-[13px] tracking-[1px]"
                  style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
                >
                  RANKED
                </span>
              </Link>
              {user && (
                <div className="flex items-center gap-2.5">
                  <nav className="flex items-center gap-2.5">
                    <Link href="/" className="pixel-btn">
                      HOME
                    </Link>
                    <Link href="/add" className="pixel-btn">
                      + ADD
                    </Link>
                  </nav>
                  <Link href="/settings" className="ml-2 flex items-center gap-2.5">
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt={user.displayName ?? user.username}
                        width={24}
                        height={24}
                        className="border border-edge/60"
                      />
                    ) : (
                      <div className="cover-hatch h-6 w-6 border border-edge/60" />
                    )}
                    <span className="text-[13px] text-ink-muted">{user.username}</span>
                  </Link>
                </div>
              )}
            </div>
          </header>
          <main className="mx-auto max-w-[980px] px-6 pt-10 pb-25">{children}</main>
        </div>
      </body>
    </html>
  );
}
