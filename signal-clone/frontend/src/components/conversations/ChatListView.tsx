"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ComposeIcon } from "@/components/ui/Icons";
import { SEARCH_INPUT_ID } from "@/hooks/useKeyboardShortcuts";
import { useOpenDirectChat } from "@/hooks/useOpenDirectChat";
import { matchesSearch, sortByActivity } from "@/lib/conversation";
import { useAuthStore } from "@/stores/auth";
import { useChatStore } from "@/stores/chat";
import { ContactRow, SectionLabel } from "./ContactRow";
import { ConversationListItem } from "./ConversationListItem";
import { PaneHeader, SearchInput } from "./PaneHeader";

type Filter = "all" | "unread" | "groups";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "groups", label: "Groups" },
];

export function ChatListView({ onCompose }: { onCompose: () => void }) {
  const meId = useAuthStore((s) => s.user!.id);
  const { conversations, conversationsLoaded, contacts, socketConnected, loadContacts } = useChatStore();
  const params = useParams<{ conversationId?: string }>();
  const activeId = Number(params.conversationId) || null;
  const openDirect = useOpenDirectChat();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (query && contacts.length === 0) loadContacts().catch(() => {});
  }, [query, contacts.length, loadContacts]);

  const visible = useMemo(() => {
    return sortByActivity(Object.values(conversations)).filter((c) => {
      if (filter === "unread" && c.unread_count === 0) return false;
      if (filter === "groups" && c.type !== "group") return false;
      return matchesSearch(c, query, meId);
    });
  }, [conversations, filter, query, meId]);

  // While searching, also offer contacts we don't have a chat with yet.
  const matchingContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const withChat = new Set(
      Object.values(conversations)
        .filter((c) => c.type === "direct")
        .flatMap((c) => c.members.map((m) => m.user.id)),
    );
    return contacts.filter(
      (c) =>
        !withChat.has(c.user.id) &&
        (c.user.display_name.toLowerCase().includes(q) ||
          c.user.username?.includes(q) ||
          c.user.phone_number?.includes(q)),
    );
  }, [contacts, conversations, query]);

  return (
    <>
      <PaneHeader
        title="Chats"
        actions={
          <button className="icon-button" onClick={onCompose} title="New chat" aria-label="New chat">
            <ComposeIcon />
          </button>
        }
      />
      <SearchInput id={SEARCH_INPUT_ID} value={query} onChange={setQuery} />
      <div className="mx-4 mb-2 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
              filter === f.value ? "bg-ultramarine text-white" : "bg-hover text-secondary hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {!socketConnected && conversationsLoaded && (
        <div className="mx-4 mb-2 rounded-lg bg-hover px-3 py-2 text-[12px] text-secondary">Connecting…</div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {query && visible.length > 0 && <SectionLabel>Chats</SectionLabel>}
        {visible.map((c) => (
          <ConversationListItem key={c.id} conversation={c} meId={meId} active={c.id === activeId} />
        ))}

        {matchingContacts.length > 0 && (
          <>
            <SectionLabel>Contacts</SectionLabel>
            {matchingContacts.map((c) => (
              <ContactRow
                key={c.id}
                user={c.user}
                onClick={() => openDirect(c.user.id).then(() => setQuery(""))}
              />
            ))}
          </>
        )}

        {conversationsLoaded && visible.length === 0 && matchingContacts.length === 0 && (
          <p className="px-6 pt-10 text-center text-secondary">
            {query
              ? `No results for “${query}”`
              : filter === "unread"
                ? "No unread chats"
                : filter === "groups"
                  ? "No groups yet"
                  : "No chats yet. Start one with the compose button."}
          </p>
        )}
      </div>
    </>
  );
}
