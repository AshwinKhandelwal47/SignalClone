// Mirrors backend/app/schemas.py.

export interface User {
  id: number;
  display_name: string;
  username: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  avatar_color: string;
  about: string;
  last_seen_at: string | null;
  is_online: boolean;
}

/** `sending` and `failed` only exist on the client, before the server has the message. */
export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  sender_name: string | null;
  type: "text" | "system";
  body: string;
  client_message_id: string | null;
  created_at: string;
  status: MessageStatus | null;
}

export interface Member {
  user: User;
  role: "admin" | "member";
}

export interface Conversation {
  id: number;
  type: "direct" | "group";
  name: string | null;
  created_by: number | null;
  created_at: string;
  members: Member[];
  last_message: Message | null;
  unread_count: number;
  is_active_member: boolean;
  my_role: "admin" | "member";
}

export interface Contact {
  id: number;
  user: User;
  created_at: string;
}

export interface MessagePage {
  items: Message[];
  has_more: boolean;
}

export type ServerEvent =
  | { type: "message.new"; data: Message }
  | {
      type: "message.status";
      data: { updates: { message_id: number; conversation_id: number; status: MessageStatus }[] };
    }
  | { type: "conversation.updated"; data: { conversation_id: number } }
  | { type: "conversation.read"; data: { conversation_id: number } }
  | { type: "typing"; data: { conversation_id: number; user_id: number; is_typing: boolean } }
  | { type: "presence"; data: { user_id: number; is_online: boolean; last_seen_at: string | null } }
  | { type: "pong"; data: Record<string, never> };
