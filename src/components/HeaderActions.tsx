"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ShareButton from "@/components/ShareButton";

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
  // Public ranking pages (/u/*) are for viewing, not authoring — hide the
  // rank/share actions there even for a signed-in visitor. The avatar/
  // settings link stays so they can still navigate back to their own account.
  const onPublicProfile = pathname.startsWith("/u/");

  return (
    <div className="flex items-center gap-5 mobile:gap-3.5">
      {!onPublicProfile && (
        <>
          <Link
            href="/add"
            aria-label="Rank a game"
            title="Rank a game (A)"
            className="icon-btn-gold flex items-center"
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
        {/* The username is the only elastic element in the header — hide it
            below 360px, where the header would otherwise overflow. The
            avatar alone still links to /settings. */}
        <span className="text-[13px] text-ink-muted mobile-xs:hidden">{username}</span>
      </Link>
    </div>
  );
}
