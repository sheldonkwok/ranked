import type { Metadata } from "next";
import { VT323 } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import ChaliceLogo from "@/components/ChaliceLogo";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
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
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${vt323.variable} antialiased`}>
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
                <ChaliceLogo />
                <span
                  className="pixel-heading ml-1.5 text-[13px] tracking-[1px]"
                  style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
                >
                  RANKED
                </span>
              </Link>
              {user && (
                <Link href="/settings" className="flex items-center gap-2.5">
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
              )}
            </div>
          </header>
          <main className="mx-auto max-w-[980px] px-6 pt-10 pb-25">{children}</main>
        </div>
      </body>
    </html>
  );
}
