"use client";

import { useEffect, useMemo, useState } from "react";
import { GroupIcon } from "@/components/ui/Icons";
import { useOpenDirectChat } from "@/hooks/useOpenDirectChat";
import { contactMatches } from "@/lib/conversation";
import { useChatStore } from "@/stores/chat";
import { ContactRow, SectionLabel } from "./ContactRow";
import { FindContactRow } from "./FindContactRow";
import { PaneHeader, SearchInput } from "./PaneHeader";

interface ComposeViewProps {
  onBack: () => void;
  onNewGroup: () => void;
}

/** "New chat": pick a contact, or find a Signal user by phone number / username and add them. */
export function ComposeView({ onBack, onNewGroup }: ComposeViewProps) {
  const { contacts, loadContacts } = useChatStore();
  const openDirect = useOpenDirectChat();
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadContacts().catch(() => {});
  }, [loadContacts]);

  const filtered = useMemo(() => contacts.filter((c) => contactMatches(c.user, query)), [contacts, query]);

  return (
    <>
      <PaneHeader title="New chat" onBack={onBack} />
      <SearchInput value={query} onChange={setQuery} placeholder="Name, username or number" autoFocus />
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <button className="list-row mx-2 w-[calc(100%-16px)]" onClick={onNewGroup}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-hover text-primary">
            <GroupIcon />
          </span>
          <span className="font-medium">New group</span>
        </button>

        <FindContactRow query={query} onFound={(user) => openDirect(user.id).then((ok) => ok && onBack())} />

        <SectionLabel>Contacts</SectionLabel>
        {filtered.map((c) => (
          <ContactRow
            key={c.id}
            user={c.user}
            onClick={() => openDirect(c.user.id).then((ok) => ok && onBack())}
          />
        ))}
        {filtered.length === 0 && (
          <p className="px-5 py-4 text-[13px] text-secondary">
            {query.trim() ? "No contacts match. Use “Find” above to look someone up." : "No contacts yet."}
          </p>
        )}
      </div>
    </>
  );
}
