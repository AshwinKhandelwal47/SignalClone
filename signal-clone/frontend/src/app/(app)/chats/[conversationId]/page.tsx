"use client";

import { useParams } from "next/navigation";
import { ChatPane } from "@/components/chat/ChatPane";

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const id = Number(conversationId);
  // `key` resets the pane's local state (draft, open panels) when switching chats.
  return <ChatPane key={id} conversationId={id} />;
}
