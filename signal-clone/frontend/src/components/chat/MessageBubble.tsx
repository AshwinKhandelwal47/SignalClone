import { Avatar } from "@/components/ui/Avatar";
import { AlertIcon } from "@/components/ui/Icons";
import { AVATAR_COLORS, type AvatarColor } from "@/lib/constants";
import { formatMessageTimestamp } from "@/lib/format";
import type { Message, User } from "@/lib/types";
import { StatusIcon } from "./StatusIcon";

interface Props {
  message: Message;
  isMine: boolean;
  /** Group chats show sender names and avatars on incoming messages. */
  isGroup: boolean;
  sender?: User;
  /** Consecutive messages from the same sender are visually grouped ("clustered"). */
  joinsPrevious: boolean;
  joinsNext: boolean;
  onRetry: () => void;
}

export function MessageBubble({
  message,
  isMine,
  isGroup,
  sender,
  joinsPrevious,
  joinsNext,
  onRetry,
}: Props) {
  const failed = message.status === "failed";
  // Like Signal, metadata is only shown at the end of a cluster (or while not yet sent).
  const showMeta = !joinsNext || message.status === "sending" || failed;
  const showSenderName = isGroup && !isMine && !joinsPrevious;
  const showAvatar = isGroup && !isMine && !joinsNext;
  const nameColor = AVATAR_COLORS[(sender?.avatar_color ?? "A210") as AvatarColor]?.fg;

  const corners = isMine
    ? `${joinsPrevious ? "rounded-tr-[var(--radius-bubble-clustered)]" : ""} ${joinsNext ? "rounded-br-[var(--radius-bubble-clustered)]" : ""}`
    : `${joinsPrevious ? "rounded-tl-[var(--radius-bubble-clustered)]" : ""} ${joinsNext ? "rounded-bl-[var(--radius-bubble-clustered)]" : ""}`;

  return (
    <div
      className={`flex items-end gap-2 px-4 ${isMine ? "justify-end" : "justify-start"} ${joinsPrevious ? "mt-0.5" : "mt-2.5"}`}
    >
      {isGroup && !isMine && (
        <div className="w-7 shrink-0">
          {showAvatar && (
            <Avatar
              name={message.sender_name ?? "?"}
              color={sender?.avatar_color ?? "A210"}
              url={sender?.avatar_url}
              size={28}
            />
          )}
        </div>
      )}
      <div className={`flex max-w-[min(75%,560px)] flex-col ${isMine ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-bubble px-3 py-[7px] ${corners} ${
            isMine
              ? "bg-bubble-outgoing text-bubble-outgoing-text"
              : "bg-bubble-incoming text-bubble-incoming-text"
          } ${message.status === "sending" ? "opacity-80" : ""}`}
        >
          {showSenderName && (
            <div className="mb-0.5 text-[13px] font-semibold" style={{ color: nameColor }}>
              {message.sender_name}
            </div>
          )}
          <p className="text-[14px] leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
            {message.body}
          </p>
          {showMeta && !failed && (
            <div
              className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${
                isMine ? "text-white/80" : "text-secondary"
              }`}
            >
              <time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>
                {formatMessageTimestamp(message.created_at)}
              </time>
              {isMine && <StatusIcon status={message.status} cutoutColor="var(--ultramarine)" />}
            </div>
          )}
        </div>
        {failed && (
          <button
            onClick={onRetry}
            className="mt-1 flex items-center gap-1 text-[12px] text-accent-red hover:underline"
          >
            <AlertIcon size={14} /> Failed to send. Click to retry.
          </button>
        )}
      </div>
    </div>
  );
}

export function SystemMessage({ message }: { message: Message }) {
  return (
    <div className="my-3 flex justify-center px-4">
      <span className="text-center text-[13px] text-secondary">{message.body}</span>
    </div>
  );
}
