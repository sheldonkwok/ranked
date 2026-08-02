import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const memberSince = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(user.createdAt);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-8 text-center">
      {user.avatarUrl ? (
        <Image
          src={user.avatarUrl}
          alt={user.displayName ?? user.username}
          width={96}
          height={96}
          className="rounded-full"
        />
      ) : (
        <div className="h-24 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      )}

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{user.displayName ?? user.username}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">@{user.username}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">Member since {memberSince}</p>
      </div>

      <SignOutButton />
    </div>
  );
}
