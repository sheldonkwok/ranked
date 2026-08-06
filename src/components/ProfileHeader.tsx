import Image from "next/image";
import { heading, panel } from "@/components/ui/surface";

export default function ProfileHeader({
  username,
  displayName,
  avatarUrl,
  gameCount,
}: {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  gameCount: number;
}) {
  return (
    <div className={panel({ className: "mb-4 flex items-center gap-3.5 px-4 py-3.5" })}>
      {avatarUrl ? (
        <Image src={avatarUrl} alt={displayName ?? username} width={48} height={48} className="border border-edge/60" />
      ) : (
        <div className="cover-hatch h-12 w-12 border border-edge/60" />
      )}
      <div>
        <p className={heading({ className: "text-[18px] tracking-[1px] text-ink" })}>{displayName ?? username}</p>
        <p className="text-[13px] tracking-[1px] text-ink-dim">
          {gameCount} {gameCount === 1 ? "GAME" : "GAMES"} RANKED
        </p>
      </div>
    </div>
  );
}
