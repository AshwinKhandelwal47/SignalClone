/* eslint-disable @next/next/no-img-element -- avatars come from the API host, not next/image */
import { mediaUrl } from "@/lib/api";
import { AVATAR_COLORS, type AvatarColor } from "@/lib/constants";
import { initials } from "@/lib/format";
import { GroupIcon } from "./Icons";

interface AvatarProps {
  name: string;
  color: string;
  url?: string | null;
  size?: number;
  isGroup?: boolean;
  online?: boolean;
}

export function Avatar({ name, color, url, size = 36, isGroup = false, online = false }: AvatarProps) {
  const palette = AVATAR_COLORS[color as AvatarColor] ?? AVATAR_COLORS.A210;
  const src = mediaUrl(url ?? null);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-medium select-none"
          style={{ backgroundColor: palette.bg, color: palette.fg, fontSize: size * 0.4 }}
          aria-label={name}
        >
          {isGroup ? <GroupIcon size={size * 0.55} /> : initials(name)}
        </div>
      )}
      {online && (
        <span
          className="absolute right-0 bottom-0 rounded-full border-2 border-left-pane bg-[#4caf50]"
          style={{ width: size * 0.3, height: size * 0.3 }}
          aria-label="Online"
        />
      )}
    </div>
  );
}
