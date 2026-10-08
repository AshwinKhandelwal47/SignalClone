"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { NavRail } from "@/components/layout/NavRail";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth";
import { useChatStore } from "@/stores/chat";
import { useUiStore } from "@/stores/ui";

/** Authenticated shell: guards the route, opens the WebSocket and renders the nav rail. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, user, token, init, clear } = useAuthStore();
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const loadTheme = useUiStore((s) => s.loadTheme);
  useKeyboardShortcuts();

  useEffect(() => {
    init();
    loadTheme();
  }, [init, loadTheme]);

  useEffect(() => {
    if (status === "anonymous") router.replace("/onboarding");
    else if (status === "authenticated" && user && !user.display_name) router.replace("/onboarding");
  }, [status, user, router]);

  useEffect(() => {
    useChatStore.getState().setNavigate((path) => router.push(path));
  }, [router]);

  useEffect(() => {
    if (status !== "authenticated" || !token) return;
    const chat = useChatStore.getState();
    chat.loadConversations().catch(() => {});
    connectSocket(token, {
      onEvent: (event) => useChatStore.getState().handleEvent(event),
      onOpen: (isReconnect) => {
        const state = useChatStore.getState();
        state.setSocketConnected(true);
        // Catch up on anything missed while disconnected.
        if (isReconnect) {
          state.loadConversations().catch(() => {});
          if (state.activeId) state.loadMessages(state.activeId, true);
        }
      },
      onClose: () => useChatStore.getState().setSocketConnected(false),
      onUnauthorized: clear,
    });
    return () => disconnectSocket();
  }, [status, token, clear]);

  if (status !== "authenticated" || !user?.display_name) {
    return <div className="h-full bg-chat" />;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <NavRail />
      <div className="flex min-w-0 flex-1">{children}</div>
      {settingsOpen && <SettingsModal />}
    </div>
  );
}
