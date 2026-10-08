import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { sortByActivity } from "@/lib/conversation";
import { useChatStore } from "@/stores/chat";
import { useUiStore } from "@/stores/ui";

export const SEARCH_INPUT_ID = "conversation-search";

export const SHORTCUTS = [
  { keys: "Ctrl/⌘ + K", description: "Search chats" },
  { keys: "Alt + ↑ / ↓", description: "Previous / next chat" },
  { keys: "Ctrl/⌘ + ,", description: "Open settings" },
  { keys: "Esc", description: "Close dialog or panel" },
];

/** Signal-style keyboard shortcuts (adapted to avoid browser-reserved combos). */
export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/chats");
        setTimeout(() => document.getElementById(SEARCH_INPUT_ID)?.focus(), 0);
      } else if (mod && e.key === ",") {
        e.preventDefault();
        useUiStore.getState().openSettings();
      } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const { conversations, activeId } = useChatStore.getState();
        const ordered = sortByActivity(Object.values(conversations));
        if (ordered.length === 0) return;
        const index = ordered.findIndex((c) => c.id === activeId);
        const step = e.key === "ArrowUp" ? -1 : 1;
        const next = index === -1 ? 0 : (index + step + ordered.length) % ordered.length;
        router.push(`/chats/${ordered[next].id}`);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}
