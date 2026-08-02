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
          className="border border-edge/60"
        />
      ) : (
        <div className="cover-hatch h-24 w-24 border border-edge/60" />
      )}

      <div className="flex flex-col gap-2">
        <h1 className="pixel-heading text-[18px]">{(user.displayName ?? user.username).toUpperCase()}</h1>
        <p className="text-sm tracking-[1px] text-ink-dim">@{user.username}</p>
        <p className="text-xs tracking-[1px] text-ink-faint">MEMBER SINCE {memberSince.toUpperCase()}</p>
      </div>

      <SignOutButton />
    </div>
  );
}
