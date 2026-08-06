import Image from "next/image";
import { button } from "@/components/ui/button";

type TwitchLinkProps = {
  twitchId: string | null;
  username: string;
  avatarUrl: string | null;
};

// Mirrors SteamLink.tsx; Twitch has no unlink route since a Steam-only account promotes straight to "has both" with no product need to go the other way.
export default function TwitchLink({ twitchId, username, avatarUrl }: TwitchLinkProps) {
  return (
    <div className="flex w-full flex-col gap-3 border-t border-edge/35 pt-6">
      <p className="text-xs tracking-[1px] text-ink-faint">TWITCH</p>

      {twitchId ? (
        <div className="flex items-center gap-2.5">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={username} width={32} height={32} className="border border-edge/60" />
          ) : (
            <div className="cover-hatch h-8 w-8 border border-edge/60" />
          )}
          <span className="text-sm text-ink-muted">@{username}</span>
        </div>
      ) : (
        <a href="/api/auth/twitch" className={button({ variant: "nav", className: "text-center" })}>
          CONNECT TWITCH
        </a>
      )}
    </div>
  );
}
