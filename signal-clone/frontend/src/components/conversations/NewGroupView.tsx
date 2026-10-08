"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import { CheckIcon, GroupIcon } from "@/components/ui/Icons";
import { api, ApiError } from "@/lib/api";
import { contactMatches } from "@/lib/conversation";
import type { User } from "@/lib/types";
import { useChatStore } from "@/stores/chat";
import { ContactRow } from "./ContactRow";
import { FindContactRow } from "./FindContactRow";
import { PaneHeader, SearchInput } from "./PaneHeader";

/** Two steps, like Signal: choose members, then name the group. */
export function NewGroupView({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const router = useRouter();
  const { contacts, loadContacts, upsertConversation } = useChatStore();
  const [step, setStep] = useState<"members" | "name">("members");
  const [selected, setSelected] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadContacts().catch(() => {});
  }, [loadContacts]);

  const filtered = useMemo(() => contacts.filter((c) => contactMatches(c.user, query)), [contacts, query]);

  const select = (user: User) => {
    setSelected((current) => (current.some((u) => u.id === user.id) ? current : [...current, user]));
    setQuery("");
  };

  const toggle = (user: User) =>
    setSelected((current) =>
      current.some((u) => u.id === user.id) ? current.filter((u) => u.id !== user.id) : [...current, user],
    );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const conversation = await api.createGroup(
        name.trim(),
        selected.map((u) => u.id),
      );
      upsertConversation(conversation);
      toast(`Group “${conversation.name}” created`);
      onDone();
      router.push(`/chats/${conversation.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't create group");
    } finally {
      setCreating(false);
    }
  };

  if (step === "name") {
    return (
      <form onSubmit={create} className="flex min-h-0 flex-1 flex-col">
        <PaneHeader title="Name this group" onBack={() => setStep("members")} />
        <div className="flex flex-col items-center px-4 pt-4">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-hover text-secondary">
            <GroupIcon size={40} />
          </span>
          <input
            className="form-field mt-5"
            placeholder="Group name (required)"
            value={name}
            maxLength={64}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mt-4 px-5 text-[13px] font-semibold text-secondary">
          Members · {selected.length + 1}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {selected.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-1.5">
              <Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={32} />
              <span className="truncate">{u.display_name}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <button className="btn-primary w-full" disabled={!name.trim() || creating}>
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <PaneHeader title="Add members" onBack={onBack} />
      <SearchInput value={query} onChange={setQuery} placeholder="Name, username or number" autoFocus />
      {selected.length > 0 && (
        <div className="mx-4 mb-2 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              className="flex items-center gap-1.5 rounded-full bg-hover py-0.5 pr-2.5 pl-0.5 text-[13px]"
            >
              <Avatar name={u.display_name} color={u.avatar_color} url={u.avatar_url} size={22} />
              {u.display_name.split(" ")[0]} ✕
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <FindContactRow query={query} onFound={select} />
        {filtered.length === 0 && (
          <p className="px-5 py-4 text-[13px] text-secondary">
            {contacts.length === 0
              ? "You have no contacts yet. Type a phone number or username above to find people."
              : "No contacts match. Use “Find” above to look someone up."}
          </p>
        )}
        {filtered.map((c) => {
          const isSelected = selected.some((u) => u.id === c.user.id);
          return (
            <ContactRow
              key={c.id}
              user={c.user}
              onClick={() => toggle(c.user)}
              trailing={
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    isSelected ? "border-ultramarine bg-ultramarine text-white" : "border-gray-25"
                  }`}
                >
                  {isSelected && <CheckIcon size={14} strokeWidth={2.5} />}
                </span>
              }
            />
          );
        })}
      </div>
      <div className="border-t border-border p-3">
        <button
          className="btn-primary w-full"
          disabled={selected.length === 0}
          onClick={() => setStep("name")}
        >
          Next
        </button>
      </div>
    </>
  );
}
