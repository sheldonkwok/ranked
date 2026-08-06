import Image from "next/image";
import { button } from "@/components/ui/button";
import { steamProfileUrl } from "@/lib/steam";

type SteamLinkProps = {
  steamId: string | null;
  steamPersonaName: string | null;
  steamAvatarUrl: string | null;
  // False when Steam is this account's only identity — unlinking would trip the users_identity_required check and lock the user out (the unlink route already refuses it; this just avoids offering an action that would bounce).
  canUnlink: boolean;
};

export default function SteamLink({ steamId, steamPersonaName, steamAvatarUrl, canUnlink }: SteamLinkProps) {
  return (
    <div className="flex w-full flex-col gap-3 border-t border-edge/35 pt-6">
      <p className="text-xs tracking-[1px] text-ink-faint">STEAM</p>

      {steamId ? (
        <div className="flex items-center justify-between gap-3">
          <a href={steamProfileUrl(steamId)} target="_blank" rel="noreferrer" className="flex items-center gap-2.5">
            {steamAvatarUrl ? (
              <Image
                src={steamAvatarUrl}
                alt={steamPersonaName ?? steamId}
                width={32}
                height={32}
                className="border border-edge/60"
              />
            ) : (
              <div className="cover-hatch h-8 w-8 border border-edge/60" />
            )}
            <span className="text-sm text-ink-muted">{steamPersonaName ?? steamId}</span>
          </a>
          {canUnlink ? (
            <form method="post" action="/api/auth/steam/unlink">
              <button type="submit" className={button({ variant: "ghost", tone: "danger" })}>
                UNLINK
              </button>
            </form>
          ) : (
            <span className="text-xs tracking-[1px] text-ink-faint">SIGN-IN METHOD</span>
          )}
        </div>
      ) : (
        <a href="/api/auth/steam" className={button({ variant: "nav", className: "text-center" })}>
          CONNECT STEAM
        </a>
      )}
    </div>
  );
}
