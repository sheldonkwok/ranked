export default function SignOutButton() {
  return (
    <form method="post" action="/api/auth/sign-out">
      <button
        type="submit"
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Sign out
      </button>
    </form>
  );
}
