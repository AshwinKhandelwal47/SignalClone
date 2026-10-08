import { API_URL } from "./constants";
import type { Contact, Conversation, Message, MessagePage, User } from "./types";

const TOKEN_KEY = "signal-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode); the session just won't survive a reload.
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Called on any 401 for an authenticated request (set by the auth store). */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection.");
  }

  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized?.();
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "UNKNOWN",
      payload?.error?.message ?? "Something went wrong",
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function mediaUrl(path: string | null): string | null {
  return path ? `${API_URL}${path}` : null;
}

export const api = {
  // Auth
  requestOtp: (identifier: string) =>
    request<{ identifier: string; is_registered: boolean; otp_hint: string | null }>("/auth/request-otp", {
      method: "POST",
      body: { identifier },
    }),
  verifyOtp: (identifier: string, otp: string) =>
    request<{ token: string; user: User; is_new_user: boolean }>("/auth/verify-otp", {
      method: "POST",
      body: { identifier, otp },
    }),
  me: () => request<User>("/auth/me"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),

  // Profile & users
  updateProfile: (data: { display_name?: string; about?: string }) =>
    request<User>("/users/me", { method: "PATCH", body: data }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<User>("/users/me/avatar", { method: "POST", form });
  },
  removeAvatar: () => request<User>("/users/me/avatar", { method: "DELETE" }),
  lookupUser: (identifier: string) =>
    request<User>(`/users/lookup?identifier=${encodeURIComponent(identifier)}`),

  // Contacts
  listContacts: () => request<Contact[]>("/contacts"),
  addContact: (identifier: string) => request<Contact>("/contacts", { method: "POST", body: { identifier } }),

  // Conversations
  listConversations: () => request<Conversation[]>("/conversations"),
  getConversation: (id: number) => request<Conversation>(`/conversations/${id}`),
  openDirect: (userId: number) =>
    request<Conversation>("/conversations", {
      method: "POST",
      body: { type: "direct", user_id: userId },
    }),
  createGroup: (name: string, memberIds: number[]) =>
    request<Conversation>("/conversations", {
      method: "POST",
      body: { type: "group", name, member_ids: memberIds },
    }),
  renameGroup: (id: number, name: string) =>
    request<Conversation>(`/conversations/${id}`, { method: "PATCH", body: { name } }),
  addMembers: (id: number, userIds: number[]) =>
    request<Conversation>(`/conversations/${id}/members`, {
      method: "POST",
      body: { user_ids: userIds },
    }),
  removeMember: (id: number, userId: number) =>
    request<Conversation>(`/conversations/${id}/members/${userId}`, { method: "DELETE" }),
  leaveGroup: (id: number) => request<void>(`/conversations/${id}/leave`, { method: "POST" }),
  markRead: (id: number, upToMessageId?: number) =>
    request<{ unread_count: number }>(`/conversations/${id}/read`, {
      method: "POST",
      body: { up_to_message_id: upToMessageId ?? null },
    }),

  // Messages
  listMessages: (id: number, beforeId?: number) =>
    request<MessagePage>(`/conversations/${id}/messages?limit=50${beforeId ? `&before_id=${beforeId}` : ""}`),
  sendMessage: (id: number, body: string, clientMessageId: string) =>
    request<Message>(`/conversations/${id}/messages`, {
      method: "POST",
      body: { body, client_message_id: clientMessageId },
    }),
};
