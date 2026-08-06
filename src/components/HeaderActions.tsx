"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ShareButton from "@/components/ShareButton";
import { iconButton } from "@/components/ui/button";

export default function HeaderActions({
  username,
  displayName,
  avatarUrl,
}: {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  // Public ranking pages (/u/*) are for viewing, not authoring — hide rank/share actions there, but keep the avatar/settings link so visitors can still reach their own account.
  const onPublicProfile = pathname.startsWith("/u/");

  return (
    <div className="flex items-center gap-5 mobile:gap-3.5">
      {!onPublicProfile && (
        <>
          <Link
            href="/add"
            aria-label="Rank a game"
            title="Rank a game (A)"
            className={iconButton({ className: "flex items-center" })}
          >
            <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
          </Link>
          <ShareButton username={username} />
        </>
      )}
      <Link href="/settings" className="flex items-center gap-2.5">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName ?? username}
            width={24}
            height={24}
            className="border border-edge/60"
          />
        ) : (
          <div className="cover-hatch h-6 w-6 border border-edge/60" />
        )}
        {/* The name is the only elastic header element — hide it below 360px to avoid overflow (avatar alone still links to /settings); prefer displayName since a Steam-only account's username defaults to unreadable "steam-<id>". */}
        <span className="text-[13px] text-ink-muted mobile-xs:hidden">{displayName ?? username}</span>
      </Link>
    </div>
  );
}
