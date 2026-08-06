import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Banner from "@/components/ui/Banner";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
};

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="pixel-panel flex w-full max-w-sm flex-col items-center gap-6 px-8 py-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="pixel-heading text-[20px]">RANKED</h1>
          <p className="text-sm tracking-[1px] text-ink-dim">Rank every game you&apos;ve played</p>
        </div>

        {error && <Banner variant="error">Something went wrong signing you in. Please try again.</Banner>}

        <a
          href="/api/auth/twitch"
          className="flex w-full items-center justify-center gap-2 border border-[#b98cff] bg-[#9146FF] px-4 py-3 text-sm tracking-[1px] text-white uppercase transition-colors hover:bg-[#7d38e0] active:translate-y-0.5"
        >
          Continue with Twitch
        </a>

        <a
          href="/api/auth/steam"
          className="flex w-full items-center justify-center gap-2 border border-[#66c0f4] bg-[#1b2838] px-4 py-3 text-sm tracking-[1px] text-white uppercase transition-colors hover:bg-[#25415a] active:translate-y-0.5"
        >
          Continue with Steam
        </a>
      </div>
    </div>
  );
}
