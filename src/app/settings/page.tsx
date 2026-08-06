import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import SteamLink from "@/components/SteamLink";
import TwitchLink from "@/components/TwitchLink";
import Banner from "@/components/ui/Banner";
import { heading } from "@/components/ui/surface";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Settings",
};

type SettingsPageProps = {
  searchParams: Promise<{ steam?: string; twitch?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { steam, twitch } = await searchParams;

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
        <h1 className={heading({ className: "text-[18px]" })}>{(user.displayName ?? user.username).toUpperCase()}</h1>
        <p className="text-sm tracking-[1px] text-ink-dim">@{user.username}</p>
        <p className="text-xs tracking-[1px] text-ink-faint">MEMBER SINCE {memberSince.toUpperCase()}</p>
      </div>

      {steam === "error" && (
        <Banner variant="error">Something went wrong linking your Steam account. Please try again.</Banner>
      )}
      {steam === "taken" && (
        <Banner variant="error">That Steam account is already linked to another Ranked account.</Banner>
      )}
      {steam === "last_identity" && (
        <Banner variant="error">Steam is the only way you sign in — link Twitch before unlinking it.</Banner>
      )}
      {twitch === "error" && (
        <Banner variant="error">Something went wrong linking your Twitch account. Please try again.</Banner>
      )}
      {twitch === "taken" && (
        <Banner variant="error">That Twitch account is already linked to another Ranked account.</Banner>
      )}

      <TwitchLink twitchId={user.twitchId} username={user.username} avatarUrl={user.avatarUrl} />
      <SteamLink
        steamId={user.steamId}
        steamPersonaName={user.steamPersonaName}
        steamAvatarUrl={user.steamAvatarUrl}
        canUnlink={Boolean(user.twitchId)}
      />

      <SignOutButton />
    </div>
  );
}
