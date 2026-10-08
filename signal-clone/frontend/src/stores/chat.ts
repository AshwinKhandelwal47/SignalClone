import { toast } from "sonner";
import { create } from "zustand";
import { api } from "@/lib/api";
import { conversationTitle } from "@/lib/conversation";
import type { Contact, Conversation, Message, MessageStatus, ServerEvent } from "@/lib/types";
import { useAuthStore } from "./auth";

const TYPING_TIMEOUT_MS = 6000;
const SERVER_STATUS_RANK: Partial<Record<MessageStatus, number>> = { sent: 1, delivered: 2, read: 3 };

interface MessageList {
  items: Message[];
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

interface Presence {
  is_online: boolean;
  last_seen_at: string | null;
}

interface ChatState {
  conversations: Record<number, Conversation>;
  conversationsLoaded: boolean;
  contacts: Contact[];
  messages: Record<number, MessageList>;
  /** conversationId → userId → typing expiry timestamp */
  typing: Record<number, Record<number, number>>;
  /** Live presence updates; overrides the values that came with the conversation list. */
  presence: Record<number, Presence>;
  activeId: number | null;
  socketConnected: boolean;
  navigate: ((path: string) => void) | null;

  loadConversations: () => Promise<void>;
  loadContacts: () => Promise<void>;
  addContact: (contact: Contact) => void;
  refreshConversation: (id: number) => Promise<void>;
  upsertConversation: (conversation: Conversation) => void;
  loadMessages: (id: number, force?: boolean) => Promise<void>;
  loadOlderMessages: (id: number) => Promise<void>;
  sendMessage: (conversationId: number, body: string) => Promise<void>;
  retryMessage: (conversationId: number, clientMessageId: string) => Promise<void>;
  markRead: (id: number) => void;
  setActive: (id: number | null) => void;
  setSocketConnected: (connected: boolean) => void;
  setNavigate: (navigate: (path: string) => void) => void;
  handleEvent: (event: ServerEvent) => void;
  reset: () => void;
}

const emptyList: MessageList = { items: [], hasMore: false, loading: false, loaded: false };
let nextTempId = -1;

function myId() {
  return useAuthStore.getState().user?.id ?? -1;
}

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Statuses only move forward (sent → delivered → read); client-only states are overwritten. */
function mergeStatus(previous: MessageStatus | null, next: MessageStatus | null) {
  const a = previous ? SERVER_STATUS_RANK[previous] : undefined;
  const b = next ? SERVER_STATUS_RANK[next] : undefined;
  if (a === undefined || b === undefined) return next ?? previous;
  return b >= a ? next : previous;
}

function isSameMessage(a: Message, b: Message) {
  if (a.id === b.id) return true;
  return (
    a.client_message_id !== null && a.client_message_id === b.client_message_id && a.sender_id === b.sender_id
  );
}

/** Inserts or replaces a message, keeping server messages sorted by id and pending ones last. */
function upsertMessage(items: Message[], message: Message): Message[] {
  const existing = items.find((m) => isSameMessage(m, message));
  const merged = existing ? { ...message, status: mergeStatus(existing.status, message.status) } : message;
  const rest = existing ? items.filter((m) => m !== existing) : items;

  const confirmed = rest.filter((m) => m.id > 0);
  const pending = rest.filter((m) => m.id < 0);
  if (merged.id < 0) return [...confirmed, ...pending, merged];
  const index = confirmed.findIndex((m) => m.id > merged.id);
  if (index === -1) confirmed.push(merged);
  else confirmed.splice(index, 0, merged);
  return [...confirmed, ...pending];
}

function isNewer(candidate: Message, current: Message | null) {
  if (!current) return true;
  if (isSameMessage(candidate, current)) return true;
  return Date.parse(candidate.created_at) >= Date.parse(current.created_at);
}

export const useChatStore = create<ChatState>((set, get) => {
  /** Applies a message to both the open message list and the chat-list preview. */
  const applyMessage = (message: Message) =>
    set((state) => {
      const conversation = state.conversations[message.conversation_id];
      const list = state.messages[message.conversation_id];
      return {
        conversations:
          conversation && isNewer(message, conversation.last_message)
            ? {
                ...state.conversations,
                [conversation.id]: {
                  ...conversation,
                  last_message: {
                    ...message,
                    status:
                      conversation.last_message && isSameMessage(conversation.last_message, message)
                        ? mergeStatus(conversation.last_message.status, message.status)
                        : message.status,
                  },
                },
              }
            : state.conversations,
        messages: list?.loaded
          ? {
              ...state.messages,
              [message.conversation_id]: { ...list, items: upsertMessage(list.items, message) },
            }
          : state.messages,
      };
    });

  const deliver = async (pending: Message) => {
    try {
      applyMessage(await api.sendMessage(pending.conversation_id, pending.body, pending.client_message_id!));
    } catch (error) {
      applyMessage({ ...pending, status: "failed" });
      if (error instanceof Error && "status" in error && error.status !== 0) toast.error(error.message);
    }
  };

  const setUnread = (id: number, unread: (current: number) => number) =>
    set((state) => {
      const conversation = state.conversations[id];
      if (!conversation) return state;
      return {
        conversations: {
          ...state.conversations,
          [id]: { ...conversation, unread_count: unread(conversation.unread_count) },
        },
      };
    });

  const clearTyping = (conversationId: number, userId: number) =>
    set((state) => {
      const current = { ...(state.typing[conversationId] ?? {}) };
      delete current[userId];
      return { typing: { ...state.typing, [conversationId]: current } };
    });

  const notifyIncoming = (message: Message) => {
    const conversation = get().conversations[message.conversation_id];
    if (!conversation) return;
    const title =
      conversation.type === "group"
        ? `${message.sender_name} · ${conversationTitle(conversation, myId())}`
        : (message.sender_name ?? "New message");
    toast(title, {
      description: message.body.length > 80 ? `${message.body.slice(0, 80)}…` : message.body,
      action: {
        label: "View",
        onClick: () => get().navigate?.(`/chats/${message.conversation_id}`),
      },
    });
  };

  return {
    conversations: {},
    conversationsLoaded: false,
    contacts: [],
    messages: {},
    typing: {},
    presence: {},
    activeId: null,
    socketConnected: false,
    navigate: null,

    loadConversations: async () => {
      const list = await api.listConversations();
      set({
        conversations: Object.fromEntries(list.map((c) => [c.id, c])),
        conversationsLoaded: true,
      });
    },

    loadContacts: async () => {
      set({ contacts: await api.listContacts() });
    },

    addContact: (contact) =>
      set((state) => ({
        contacts: [...state.contacts, contact].sort((a, b) =>
          a.user.display_name.localeCompare(b.user.display_name),
        ),
      })),

    refreshConversation: async (id) => {
      try {
        get().upsertConversation(await api.getConversation(id));
      } catch {
        // Not (or no longer) visible to us; ignore.
      }
    },

    upsertConversation: (conversation) =>
      set((state) => ({ conversations: { ...state.conversations, [conversation.id]: conversation } })),

    loadMessages: async (id, force = false) => {
      const current = get().messages[id] ?? emptyList;
      if (current.loading || (current.loaded && !force)) return;
      set((state) => ({ messages: { ...state.messages, [id]: { ...current, loading: true } } }));
      try {
        const page = await api.listMessages(id);
        set((state) => {
          // Keep messages that are still being sent so a refetch doesn't drop them.
          const pending = (state.messages[id]?.items ?? []).filter((m) => m.id < 0);
          return {
            messages: {
              ...state.messages,
              [id]: {
                items: [...page.items, ...pending],
                hasMore: page.has_more,
                loading: false,
                loaded: true,
              },
            },
          };
        });
      } catch {
        set((state) => ({ messages: { ...state.messages, [id]: { ...current, loading: false } } }));
      }
    },

    loadOlderMessages: async (id) => {
      const current = get().messages[id];
      const oldest = current?.items.find((m) => m.id > 0);
      if (!current || current.loading || !current.hasMore || !oldest) return;
      set((state) => ({ messages: { ...state.messages, [id]: { ...current, loading: true } } }));
      try {
        const page = await api.listMessages(id, oldest.id);
        set((state) => {
          const latest = state.messages[id] ?? current;
          return {
            messages: {
              ...state.messages,
              [id]: {
                ...latest,
                items: [...page.items, ...latest.items],
                hasMore: page.has_more,
                loading: false,
              },
            },
          };
        });
      } catch {
        set((state) => ({ messages: { ...state.messages, [id]: { ...current, loading: false } } }));
      }
    },

    sendMessage: async (conversationId, body) => {
      const me = useAuthStore.getState().user;
      if (!me) return;
      const pending: Message = {
        id: nextTempId--,
        conversation_id: conversationId,
        sender_id: me.id,
        sender_name: me.display_name,
        type: "text",
        body,
        client_message_id: newClientId(),
        created_at: new Date().toISOString(),
        status: "sending",
      };
      applyMessage(pending);
      await deliver(pending);
    },

    retryMessage: async (conversationId, clientMessageId) => {
      const failed = get().messages[conversationId]?.items.find(
        (m) => m.client_message_id === clientMessageId && m.status === "failed",
      );
      if (!failed) return;
      const pending = { ...failed, status: "sending" as const };
      applyMessage(pending);
      await deliver(pending);
    },

    markRead: (id) => {
      const conversation = get().conversations[id];
      if (!conversation || conversation.unread_count === 0) return;
      setUnread(id, () => 0);
      const lastId = conversation.last_message?.id;
      api.markRead(id, lastId && lastId > 0 ? lastId : undefined).catch(() => {});
    },

    setActive: (id) => set({ activeId: id }),
    setSocketConnected: (connected) => set({ socketConnected: connected }),
    setNavigate: (navigate) => set({ navigate }),

    handleEvent: (event) => {
      switch (event.type) {
        case "message.new": {
          const message = event.data;
          const state = get();
          if (!state.conversations[message.conversation_id]) {
            // A chat we haven't seen yet (e.g. someone messaged us first).
            state.refreshConversation(message.conversation_id);
            if (message.sender_id !== myId())
              toast(message.sender_name ?? "New message", { description: message.body });
            return;
          }
          applyMessage(message);
          if (message.sender_id === null || message.sender_id === myId()) return;

          if (message.sender_id) clearTyping(message.conversation_id, message.sender_id);
          const isViewing =
            state.activeId === message.conversation_id && document.visibilityState === "visible";
          if (isViewing) {
            api.markRead(message.conversation_id, message.id).catch(() => {});
          } else {
            setUnread(message.conversation_id, (n) => n + 1);
            notifyIncoming(message);
          }
          return;
        }

        case "message.status":
          for (const update of event.data.updates) {
            const state = get();
            const fromList = state.messages[update.conversation_id]?.items.find(
              (m) => m.id === update.message_id,
            );
            const fromPreview = state.conversations[update.conversation_id]?.last_message;
            const message = fromList ?? (fromPreview?.id === update.message_id ? fromPreview : undefined);
            if (message) applyMessage({ ...message, status: update.status });
          }
          return;

        case "conversation.updated":
          get().refreshConversation(event.data.conversation_id);
          return;

        case "conversation.read":
          setUnread(event.data.conversation_id, () => 0);
          return;

        case "typing": {
          const { conversation_id, user_id, is_typing } = event.data;
          if (!is_typing) {
            clearTyping(conversation_id, user_id);
            return;
          }
          const expiresAt = Date.now() + TYPING_TIMEOUT_MS;
          set((state) => ({
            typing: {
              ...state.typing,
              [conversation_id]: { ...(state.typing[conversation_id] ?? {}), [user_id]: expiresAt },
            },
          }));
          // If the "stopped typing" event never arrives (e.g. their tab closed), expire it.
          setTimeout(() => {
            if (get().typing[conversation_id]?.[user_id] === expiresAt) clearTyping(conversation_id, user_id);
          }, TYPING_TIMEOUT_MS);
          return;
        }

        case "presence":
          set((state) => ({
            presence: {
              ...state.presence,
              [event.data.user_id]: {
                is_online: event.data.is_online,
                last_seen_at: event.data.last_seen_at,
              },
            },
          }));
          return;
      }
    },

    reset: () =>
      set({
        conversations: {},
        conversationsLoaded: false,
        contacts: [],
        messages: {},
        typing: {},
        presence: {},
        activeId: null,
        socketConnected: false,
      }),
  };
});
