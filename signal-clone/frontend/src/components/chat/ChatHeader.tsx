"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import { BackIcon, MoreIcon, PhoneIcon, VideoIcon } from "@/components/ui/Icons";
import { usePresence } from "@/hooks/usePresence";
import { conversationColor, conversationTitle, otherMember } from "@/lib/conversation";
import { formatLastSeen } from "@/lib/format";
import type { Conversation } from "@/lib/types";
import { useChatStore } from "@/stores/chat";

interface Props {
  conversation: Conversation;
  meId: number;
  onToggleDetails: () => void;
}

export function ChatHeader({ conversation, meId, onToggleDetails }: Props) {
  const other = otherMember(conversation, meId);
  const { isOnline, lastSeenAt } = usePresence(other);
  // Select the stored object (stable reference) and derive ids outside the selector.
  const typing = useChatStore((s) => s.typing[conversation.id]);
  const typingIds = typing ? Object.keys(typing).map(Number) : [];
  const title = conversationTitle(conversation, meId);

  let subtitle: string;
  if (typingIds.length > 0) {
    if (conversation.type === "direct") subtitle = "typing…";
    else {
      const names = typingIds
        .map((id) => conversation.members.find((m) => m.user.id === id)?.user.display_name.split(" ")[0])
        .filter(Boolean);
      subtitle = `${names.join(", ")} ${names.length > 1 ? "are" : "is"} typing…`;
    }
  } else if (conversation.type === "group") {
    subtitle = `${conversation.members.length} members`;
  } else {
    subtitle = formatLastSeen(isOnline, lastSeenAt);
  }

  const comingSoon = () => toast("Voice and video calls are coming soon");

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border px-3">
      <Link href="/chats" className="icon-button md:hidden" aria-label="Back to chats">
        <BackIcon />
      </Link>
      <button
        onClick={onToggleDetails}
        className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-1 text-left"
      >
        <Avatar
          name={title}
          color={conversationColor(conversation, meId)}
          url={other?.avatar_url}
          isGroup={conversation.type === "group"}
          size={32}
        />
        <div className="min-w-0">
          <div className="truncate font-semibold">{title}</div>
          {subtitle && (
            <div
              className={`truncate text-[12px] ${typingIds.length ? "text-ultramarine" : "text-secondary"}`}
            >
              {subtitle}
            </div>
          )}
        </div>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <button className="icon-button" onClick={comingSoon} aria-label="Video call" title="Video call">
          <VideoIcon />
        </button>
        <button className="icon-button" onClick={comingSoon} aria-label="Voice call" title="Voice call">
          <PhoneIcon />
        </button>
        <button
          className="icon-button"
          onClick={onToggleDetails}
          aria-label="Chat settings"
          title="Chat settings"
        >
          <MoreIcon />
        </button>
      </div>
    </header>
  );
}
