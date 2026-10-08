export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Signal's avatar colour pairs: light background with a saturated foreground for initials. */
export const AVATAR_COLORS = {
  A100: { bg: "#e3e3fe", fg: "#3838f5" },
  A110: { bg: "#dde7fc", fg: "#0d59f2" },
  A120: { bg: "#d8e8f0", fg: "#08698a" },
  A130: { bg: "#cde4cd", fg: "#067906" },
  A140: { bg: "#eae0fd", fg: "#661aff" },
  A150: { bg: "#f5e3fe", fg: "#9f00f0" },
  A160: { bg: "#f6d8ec", fg: "#b8057c" },
  A170: { bg: "#f5d7d7", fg: "#be0404" },
  A180: { bg: "#fef5d0", fg: "#836b01" },
  A190: { bg: "#eae6d5", fg: "#7d6f40" },
  A200: { bg: "#d2d2dc", fg: "#4f4f6d" },
  A210: { bg: "#d7d7d9", fg: "#5c5c5c" },
} as const;

export type AvatarColor = keyof typeof AVATAR_COLORS;
