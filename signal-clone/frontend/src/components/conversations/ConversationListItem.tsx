"use client";

import Link from "next/link";
import { StatusIcon } from "@/components/chat/StatusIcon";
import { TypingDots } from "@/components/chat/TypingDots";
import { Avatar } from "@/components/ui/Avatar";
import { usePresence } from "@/hooks/usePresence";
import { conversationColor, conversationTitle, otherMember } from "@/lib/conversation";
import { formatListTimestamp } from "@/lib/format";
import type { Conversation } from "@/lib/types";
import { useChatStore } from "@/stores/chat";

interface Props {
  conversation: Conversation;
  meId: number;
  active: boolean;
}

export function ConversationListItem({ conversation, meId, active }: Props) {
  const other = otherMember(conversation, meId);
  const { isOnline } = usePresence(other);
  const isTyping = useChatStore((s) => Object.keys(s.typing[conversation.id] ?? {}).length > 0);
  const title = conversationTitle(conversation, meId);
  const last = conversation.last_message;
  const isMine = last?.sender_id === meId;
  const unread = conversation.unread_count;

  let preview = "";
  if (last) {
    if (last.type === "system") preview = last.body;
    else if (isMine) preview = `You: ${last.body}`;
    else if (conversation.type === "group") preview = `${last.sender_name?.split(" ")[0]}: ${last.body}`;
    else preview = last.body;
  }

  return (
    <Link
      href={`/chats/${conversation.id}`}
      className={`mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
        active ? "bg-selected" : "hover:bg-hover"
      }`}
    >
      <Avatar
        name={title}
        color={conversationColor(conversation, meId)}
        url={other?.avatar_url}
        isGroup={conversation.type === "group"}
        online={isOnline}
        size={48}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">{title}</span>
          <span className={`shrink-0 text-[12px] ${unread ? "font-semibold text-primary" : "text-tertiary"}`}>
            {last ? formatListTimestamp(last.created_at) : ""}
          </span>
        </div>
        <div className="mt-0.5 flex items-start justify-between gap-2">
          <span
            className={`line-clamp-2 text-[13px] leading-[18px] ${unread ? "text-primary" : "text-secondary"}`}
          >
            {isTyping ? (
              <TypingDots className="mt-1.5 text-secondary" />
            ) : last?.status === "failed" && isMine ? (
              <span className="text-accent-red">Failed to send</span>
            ) : (
              preview || <span className="italic">No messages yet</span>
            )}
          </span>
          {unread > 0 ? (
            <span className="mt-0.5 min-w-[20px] shrink-0 rounded-full bg-badge-unread px-1.5 text-center text-[12px] leading-[20px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : (
            isMine &&
            last?.type === "text" && (
              <StatusIcon status={last.status} className="mt-1 shrink-0 text-secondary" />
            )
          )}
        </div>
      </div>
    </Link>
  );
}
