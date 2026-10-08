"use client";

import { Fragment, useLayoutEffect, useMemo, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { LockIcon } from "@/components/ui/Icons";
import { conversationColor, conversationTitle, otherMember } from "@/lib/conversation";
import { formatDateSeparator, isSameDay } from "@/lib/format";
import type { Conversation, Message, User } from "@/lib/types";
import { useChatStore } from "@/stores/chat";
import { MessageBubble, SystemMessage } from "./MessageBubble";
import { TypingDots } from "./TypingDots";

const CLUSTER_WINDOW_MS = 3 * 60_000;
const NEAR_BOTTOM_PX = 150;

function clusters(a: Message | undefined, b: Message | undefined) {
  return (
    !!a &&
    !!b &&
    a.type === "text" &&
    b.type === "text" &&
    a.sender_id === b.sender_id &&
    Math.abs(Date.parse(b.created_at) - Date.parse(a.created_at)) < CLUSTER_WINDOW_MS &&
    isSameDay(a.created_at, b.created_at)
  );
}

export function MessageList({ conversation, meId }: { conversation: Conversation; meId: number }) {
  const list = useChatStore((s) => s.messages[conversation.id]);
  const typing = useChatStore((s) => s.typing[conversation.id]);
  const { loadOlderMessages, retryMessage } = useChatStore.getState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const previous = useRef({ firstId: 0, lastId: 0, scrollHeight: 0, nearBottom: true });

  const items = useMemo(() => list?.items ?? [], [list]);
  const members = useMemo(() => {
    const map = new Map<number, User>();
    conversation.members.forEach((m) => map.set(m.user.id, m.user));
    return map;
  }, [conversation.members]);
  const typingUsers = Object.keys(typing ?? {})
    .map((id) => members.get(Number(id)))
    .filter(Boolean) as User[];

  // Keep the view pinned: jump to the bottom for new messages, preserve position when loading older ones.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstId = items[0]?.id ?? 0;
    const last = items[items.length - 1];
    const prev = previous.current;

    if (prev.lastId === 0 && items.length > 0) {
      el.scrollTop = el.scrollHeight; // first render
    } else if (firstId !== prev.firstId && last?.id === prev.lastId) {
      el.scrollTop += el.scrollHeight - prev.scrollHeight; // older page prepended
    } else if (last && last.id !== prev.lastId && (prev.nearBottom || last.sender_id === meId)) {
      el.scrollTop = el.scrollHeight;
    }
    previous.current = { ...prev, firstId, lastId: last?.id ?? 0, scrollHeight: el.scrollHeight };
  }, [items, meId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && typingUsers.length > 0 && previous.current.nearBottom) el.scrollTop = el.scrollHeight;
  }, [typingUsers.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    previous.current.nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    previous.current.scrollHeight = el.scrollHeight;
    if (el.scrollTop < 80 && list?.hasMore && !list.loading) loadOlderMessages(conversation.id);
  };

  const title = conversationTitle(conversation, meId);
  const other = otherMember(conversation, meId);
  const isGroup = conversation.type === "group";

  return (
    <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto pb-3">
      {list?.loaded && !list.hasMore && (
        // Conversation "hero", shown at the very start of the history.
        <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center">
          <Avatar
            name={title}
            color={conversationColor(conversation, meId)}
            url={other?.avatar_url}
            isGroup={isGroup}
            size={80}
          />
          <h2 className="mt-3 text-[20px] font-semibold">{title}</h2>
          <p className="mt-1 text-[13px] text-secondary">
            {isGroup
              ? `${conversation.members.length} members`
              : other?.username
                ? `@${other.username}`
                : other?.phone_number}
          </p>
          {other?.about && <p className="mt-1 text-[13px] text-secondary">{other.about}</p>}
          <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-hover px-3 py-1.5 text-[12px] text-secondary">
            <LockIcon size={14} /> Messages and calls are end-to-end encrypted (simulated).
          </div>
        </div>
      )}
      {list?.loading && <div className="py-3 text-center text-[12px] text-tertiary">Loading…</div>}

      {items.map((message, index) => {
        const prev = items[index - 1];
        const next = items[index + 1];
        const newDay = !prev || !isSameDay(prev.created_at, message.created_at);
        return (
          <Fragment key={message.client_message_id ?? message.id}>
            {newDay && (
              <div className="sticky top-1 z-10 my-3 flex justify-center">
                <span className="rounded-full bg-chat/90 px-3 py-0.5 text-[12px] font-medium text-secondary shadow-sm">
                  {formatDateSeparator(message.created_at)}
                </span>
              </div>
            )}
            {message.type === "system" ? (
              <SystemMessage message={message} />
            ) : (
              <MessageBubble
                message={message}
                isMine={message.sender_id === meId}
                isGroup={isGroup}
                sender={message.sender_id ? members.get(message.sender_id) : undefined}
                joinsPrevious={!newDay && clusters(prev, message)}
                joinsNext={clusters(message, next)}
                onRetry={() =>
                  message.client_message_id && retryMessage(conversation.id, message.client_message_id)
                }
              />
            )}
          </Fragment>
        );
      })}

      {typingUsers.length > 0 && (
        <div className="mt-2.5 flex items-end gap-2 px-4">
          {isGroup && (
            <Avatar
              name={typingUsers[0].display_name}
              color={typingUsers[0].avatar_color}
              url={typingUsers[0].avatar_url}
              size={28}
            />
          )}
          <div className="rounded-bubble bg-bubble-incoming px-4 py-3 text-secondary">
            <TypingDots />
          </div>
        </div>
      )}
    </div>
  );
}
