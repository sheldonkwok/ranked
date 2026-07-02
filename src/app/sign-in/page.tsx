import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

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
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-zinc-200 px-8 py-10 text-center dark:border-zinc-800">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-semibold">Ranked</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Rank every game you&apos;ve played
          </p>
        </div>

        {error && (
          <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
            Something went wrong signing you in. Please try again.
          </p>
        )}

        <a
          href="/api/auth/twitch"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#9146FF] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#7d38e0]"
        >
          Continue with Twitch
        </a>
      </div>
    </div>
  );
}
