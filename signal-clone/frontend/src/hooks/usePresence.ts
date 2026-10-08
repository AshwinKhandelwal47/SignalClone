import { useChatStore } from "@/stores/chat";
import type { User } from "@/lib/types";

/** Live presence for a user: socket updates win over the snapshot that came with the data. */
export function usePresence(user: User | undefined) {
  const live = useChatStore((s) => (user ? s.presence[user.id] : undefined));
  if (!user) return { isOnline: false, lastSeenAt: null };
  return {
    isOnline: live?.is_online ?? user.is_online,
    lastSeenAt: live?.last_seen_at ?? user.last_seen_at,
  };
}
