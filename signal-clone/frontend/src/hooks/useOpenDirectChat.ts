import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useChatStore } from "@/stores/chat";

/** Opens (or creates) the 1:1 chat with a user and navigates to it. */
export function useOpenDirectChat() {
  const router = useRouter();
  return useCallback(
    async (userId: number) => {
      try {
        const conversation = await api.openDirect(userId);
        useChatStore.getState().upsertConversation(conversation);
        router.push(`/chats/${conversation.id}`);
        return true;
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Couldn't open chat");
        return false;
      }
    },
    [router],
  );
}
