"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useChatStore } from "@/stores/chat";
import { useAuthStore } from "@/stores/auth";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { ConversationDetails } from "./ConversationDetails";
import { MessageList } from "./MessageList";

export function ChatPane({ conversationId }: { conversationId: number }) {
  const meId = useAuthStore((s) => s.user!.id);
  const conversation = useChatStore((s) => s.conversations[conversationId]);
  const conversationsLoaded = useChatStore((s) => s.conversationsLoaded);
  const { setActive, loadMessages, refreshConversation, markRead } = useChatStore.getState();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setActive(conversationId);
    loadMessages(conversationId);
    return () => setActive(null);
  }, [conversationId, setActive, loadMessages]);

  // Deep link to a chat that isn't in the list yet (e.g. an empty 1:1 chat).
  useEffect(() => {
    if (conversationsLoaded && !conversation) {
      refreshConversation(conversationId).then(() => {
        if (!useChatStore.getState().conversations[conversationId]) setNotFound(true);
      });
    }
  }, [conversationsLoaded, conversation, conversationId, refreshConversation]);

  // Mark as read while the chat is open and the window is visible.
  const unread = conversation?.unread_count ?? 0;
  useEffect(() => {
    const readIfVisible = () => {
      if (document.visibilityState === "visible") markRead(conversationId);
    };
    if (unread > 0) readIfVisible();
    document.addEventListener("visibilitychange", readIfVisible);
    return () => document.removeEventListener("visibilitychange", readIfVisible);
  }, [unread, conversationId, markRead]);

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-secondary">
        <p>This chat doesn&apos;t exist or you don&apos;t have access to it.</p>
        <Link href="/chats" className="text-ultramarine">
          Back to chats
        </Link>
      </div>
    );
  }
  if (!conversation) return <div className="flex-1" />;

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          conversation={conversation}
          meId={meId}
          onToggleDetails={() => setDetailsOpen((o) => !o)}
        />
        <MessageList conversation={conversation} meId={meId} />
        {conversation.is_active_member ? (
          <Composer conversationId={conversationId} />
        ) : (
          <div className="border-t border-border px-4 py-4 text-center text-[13px] text-secondary">
            You can&apos;t send messages to this group because you&apos;re no longer a member.
          </div>
        )}
      </div>
      {detailsOpen && (
        <ConversationDetails conversation={conversation} meId={meId} onClose={() => setDetailsOpen(false)} />
      )}
    </div>
  );
}
