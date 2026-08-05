import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import SteamLink from "@/components/SteamLink";
import Banner from "@/components/ui/Banner";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Settings",
};

type SettingsPageProps = {
  searchParams: Promise<{ steam?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { steam } = await searchParams;

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

      {steam === "error" && (
        <Banner variant="error">Something went wrong linking your Steam account. Please try again.</Banner>
      )}
      {steam === "taken" && (
        <Banner variant="error">That Steam account is already linked to another Ranked account.</Banner>
      )}

      <SteamLink steamId={user.steamId} steamPersonaName={user.steamPersonaName} steamAvatarUrl={user.steamAvatarUrl} />

      <SignOutButton />
    </div>
  );
}
