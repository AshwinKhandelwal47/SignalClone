"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SearchIcon } from "@/components/ui/Icons";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { useChatStore } from "@/stores/chat";

interface FindContactRowProps {
  /** What the user typed: a phone number or username. Hidden until it's long enough. */
  query: string;
  /** Called with the found user (already saved to contacts). */
  onFound: (user: User) => void;
}

/** "Find “…”" row: looks up a Signal user by phone/username and saves them as a contact. */
export function FindContactRow({ query, onFound }: FindContactRowProps) {
  const [finding, setFinding] = useState(false);
  const identifier = query.trim();
  if (identifier.length < 3) return null;

  const find = async () => {
    setFinding(true);
    try {
      const user = await api.lookupUser(identifier);
      const { contacts, addContact } = useChatStore.getState();
      if (!contacts.some((c) => c.user.id === user.id)) {
        try {
          addContact(await api.addContact(identifier));
          toast(`${user.display_name} added to contacts`);
        } catch (e) {
          // Adding yourself isn't allowed; anything else (e.g. already added) is fine.
          if (e instanceof ApiError && e.status === 400) throw e;
        }
      }
      onFound(user);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't find that user");
    } finally {
      setFinding(false);
    }
  };

  return (
    <button className="list-row mx-2 w-[calc(100%-16px)]" onClick={find} disabled={finding}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ultramarine text-white">
        <SearchIcon size={18} />
      </span>
      <div className="min-w-0">
        <div className="truncate font-medium">{finding ? "Searching…" : `Find “${identifier}”`}</div>
        <div className="text-[13px] text-secondary">Find a Signal user by phone number or username</div>
      </div>
    </button>
  );
}
