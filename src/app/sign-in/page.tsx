type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Sign in to Ranked</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Rank the video games you&apos;ve played, Beli-style.
      </p>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Something went wrong signing you in. Please try again.
        </p>
      )}
      <a
        href="/api/auth/twitch"
        className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
      >
        Sign in with Twitch
      </a>
    </div>
  );
}
