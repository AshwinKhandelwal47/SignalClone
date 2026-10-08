"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ContactRow } from "@/components/conversations/ContactRow";
import { FindContactRow } from "@/components/conversations/FindContactRow";
import { SearchInput } from "@/components/conversations/PaneHeader";
import { Avatar } from "@/components/ui/Avatar";
import { CheckIcon, CloseIcon, LockIcon, LogoutIcon, PlusIcon, ShieldIcon } from "@/components/ui/Icons";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useOpenDirectChat } from "@/hooks/useOpenDirectChat";
import { api, ApiError } from "@/lib/api";
import { contactMatches, conversationColor, conversationTitle, otherMember } from "@/lib/conversation";
import type { Conversation, User } from "@/lib/types";
import { useChatStore } from "@/stores/chat";

interface Props {
  conversation: Conversation;
  meId: number;
  onClose: () => void;
}

type Confirm = { kind: "remove"; user: User } | { kind: "leave" } | null;

/** Right-hand "Chat settings" panel: profile/group info, members and admin controls. */
export function ConversationDetails({ conversation, meId, onClose }: Props) {
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const refreshConversation = useChatStore((s) => s.refreshConversation);
  const openDirect = useOpenDirectChat();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [addingMembers, setAddingMembers] = useState(false);
  const [showSafetyNumber, setShowSafetyNumber] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(conversation.name ?? "");

  const isGroup = conversation.type === "group";
  const isAdmin = isGroup && conversation.is_active_member && conversation.my_role === "admin";
  const other = otherMember(conversation, meId);
  const title = conversationTitle(conversation, meId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !confirm && !addingMembers && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirm, addingMembers]);

  const run = async (action: () => Promise<void>, success?: string) => {
    try {
      await action();
      if (success) toast(success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong");
    }
  };

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      upsertConversation(await api.renameGroup(conversation.id, name.trim()));
      setEditingName(false);
    }, "Group name updated");
  };

  const onConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "remove") {
      run(async () => {
        upsertConversation(await api.removeMember(conversation.id, confirm.user.id));
      }, `${confirm.user.display_name} removed from group`);
    } else {
      run(async () => {
        await api.leaveGroup(conversation.id);
        await refreshConversation(conversation.id);
      }, "You left the group");
    }
    setConfirm(null);
  };

  return (
    <aside className="absolute inset-0 z-20 flex flex-col border-l border-border bg-left-pane md:static md:w-[320px] md:shrink-0">
      <div className="flex h-[52px] shrink-0 items-center justify-between px-4">
        <h2 className="text-[15px] font-semibold">{isGroup ? "Group settings" : "Chat settings"}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="flex flex-col items-center px-4 pt-2 pb-5 text-center">
          <Avatar
            name={title}
            color={conversationColor(conversation, meId)}
            url={other?.avatar_url}
            isGroup={isGroup}
            size={80}
          />
          {editingName ? (
            <form onSubmit={saveName} className="mt-3 flex w-full gap-2">
              <input
                className="form-field"
                value={name}
                maxLength={64}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <button className="icon-button" disabled={!name.trim()} aria-label="Save name">
                <CheckIcon />
              </button>
            </form>
          ) : (
            <h3 className="mt-3 text-[18px] font-semibold">{title}</h3>
          )}
          <p className="mt-0.5 text-[13px] text-secondary">
            {isGroup ? `Group · ${conversation.members.length} members` : other?.phone_number}
          </p>
          {other?.username && <p className="text-[13px] text-secondary">@{other.username}</p>}
          {other?.about && <p className="mt-2 text-[13px]">{other.about}</p>}
          {isAdmin && !editingName && (
            <button className="mt-2 text-[13px] text-ultramarine" onClick={() => setEditingName(true)}>
              Edit group name
            </button>
          )}
        </div>

        <div className="border-t border-border pt-2">
          {!isGroup && (
            <button className="list-row mx-2 w-[calc(100%-16px)]" onClick={() => setShowSafetyNumber(true)}>
              <ShieldIcon className="text-secondary" />
              <span>View safety number</span>
            </button>
          )}
          <button
            className="list-row mx-2 w-[calc(100%-16px)]"
            onClick={() => toast("Disappearing messages are coming soon")}
          >
            <LockIcon className="text-secondary" />
            <div className="min-w-0">
              <div>Disappearing messages</div>
              <div className="text-[12px] text-secondary">Off</div>
            </div>
          </button>
        </div>

        {isGroup && (
          <div className="mt-2 border-t border-border pt-2">
            <div className="px-5 py-2 text-[13px] font-semibold text-secondary">
              {conversation.members.length} members
            </div>
            {isAdmin && (
              <button className="list-row mx-2 w-[calc(100%-16px)]" onClick={() => setAddingMembers(true)}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-hover">
                  <PlusIcon />
                </span>
                <span>Add members</span>
              </button>
            )}
            {conversation.members.map(({ user, role }) => (
              <div key={user.id} className="group flex items-center">
                <ContactRow
                  user={user}
                  subtitle={user.id === meId ? "You" : user.about || undefined}
                  onClick={() => user.id !== meId && openDirect(user.id)}
                  trailing={role === "admin" && <span className="text-[12px] text-secondary">Admin</span>}
                />
                {isAdmin && user.id !== meId && (
                  <button
                    className="icon-button mr-3 -ml-10 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={() => setConfirm({ kind: "remove", user })}
                    aria-label={`Remove ${user.display_name}`}
                    title="Remove from group"
                  >
                    <CloseIcon size={16} />
                  </button>
                )}
              </div>
            ))}
            {conversation.is_active_member && (
              <button
                className="list-row mx-2 mt-2 w-[calc(100%-16px)] text-accent-red"
                onClick={() => setConfirm({ kind: "leave" })}
              >
                <LogoutIcon />
                <span>Leave group</span>
              </button>
            )}
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === "leave" ? "Leave group?" : `Remove ${confirm.user.display_name}?`}
          body={
            confirm.kind === "leave"
              ? "You will no longer be able to send or receive messages in this group."
              : `${confirm.user.display_name} will be removed from “${conversation.name}”.`
          }
          confirmLabel={confirm.kind === "leave" ? "Leave" : "Remove"}
          destructive
          onConfirm={onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {addingMembers && (
        <AddMembersModal conversation={conversation} onClose={() => setAddingMembers(false)} />
      )}
      {showSafetyNumber && other && (
        <SafetyNumberModal meId={meId} other={other} onClose={() => setShowSafetyNumber(false)} />
      )}
    </aside>
  );
}

function AddMembersModal({ conversation, onClose }: { conversation: Conversation; onClose: () => void }) {
  const { contacts, loadContacts, upsertConversation } = useChatStore();
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadContacts().catch(() => {});
  }, [loadContacts]);

  const memberIds = useMemo(
    () => new Set(conversation.members.map((m) => m.user.id)),
    [conversation.members],
  );
  const candidates = useMemo(
    () => contacts.filter((c) => !memberIds.has(c.user.id) && contactMatches(c.user, query)),
    [contacts, memberIds, query],
  );

  // Someone found by phone/username is saved as a contact, so they show up in the list, pre-selected.
  const onFound = (user: User) => {
    if (memberIds.has(user.id)) {
      toast(`${user.display_name} is already in this group`);
      return;
    }
    setSelected((s) => (s.includes(user.id) ? s : [...s, user.id]));
    setQuery("");
  };

  const save = async () => {
    setSaving(true);
    try {
      upsertConversation(await api.addMembers(conversation.id, selected));
      toast(`Added ${selected.length} member${selected.length > 1 ? "s" : ""}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't add members");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add members" onClose={onClose}>
      <div className="pt-1">
        <SearchInput value={query} onChange={setQuery} placeholder="Name, username or number" autoFocus />
      </div>
      <div className="pb-1">
        <FindContactRow query={query} onFound={onFound} />
        {candidates.length === 0 && (
          <p className="px-5 py-4 text-[13px] text-secondary">
            {query.trim()
              ? "No contacts match. Use “Find” above to look someone up."
              : "No contacts to add. Type a phone number or username above to find people."}
          </p>
        )}
        {candidates.map((c) => {
          const checked = selected.includes(c.user.id);
          return (
            <ContactRow
              key={c.id}
              user={c.user}
              onClick={() =>
                setSelected((s) => (checked ? s.filter((id) => id !== c.user.id) : [...s, c.user.id]))
              }
              trailing={
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    checked ? "border-ultramarine bg-ultramarine text-white" : "border-gray-25"
                  }`}
                >
                  {checked && <CheckIcon size={14} strokeWidth={2.5} />}
                </span>
              }
            />
          );
        })}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-left-pane p-3">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={selected.length === 0 || saving} onClick={save}>
          {selected.length > 0 ? `Add ${selected.length}` : "Add"}
        </button>
      </div>
    </Modal>
  );
}

/** Mock safety number: deterministic digits derived from both user ids (no real crypto). */
function SafetyNumberModal({ meId, other, onClose }: { meId: number; other: User; onClose: () => void }) {
  const groups = useMemo(() => {
    let seed = (Math.min(meId, other.id) * 7919 + Math.max(meId, other.id) * 104729) % 2147483647;
    return Array.from({ length: 12 }, () => {
      seed = (seed * 48271) % 2147483647;
      return String(seed % 100000).padStart(5, "0");
    });
  }, [meId, other.id]);

  return (
    <Modal title="Safety number" onClose={onClose} width={380}>
      <div className="px-5 pb-5">
        <p className="text-[13px] text-secondary">
          If you wish to verify the security of your end-to-end encryption with {other.display_name}, compare
          the numbers below with their device. (Simulated in this demo.)
        </p>
        <div className="mt-4 grid grid-cols-4 gap-x-4 gap-y-2 rounded-lg bg-hover p-4 text-center font-mono text-[15px] tracking-wider">
          {groups.map((g, i) => (
            <span key={i}>{g}</span>
          ))}
        </div>
      </div>
    </Modal>
  );
}
