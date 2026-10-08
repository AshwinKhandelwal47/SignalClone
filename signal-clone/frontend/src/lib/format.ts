// Signal-style relative timestamps.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysAgo(date: Date, now = new Date()) {
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY);
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Chat list: "Now", "5m", "2:30 PM", "Tue", "Oct 1". */
export function formatListTimestamp(iso: string) {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return "Now";
  if (diff < 60 * MINUTE) return `${Math.floor(diff / MINUTE)}m`;
  const days = daysAgo(date);
  if (days === 0) return formatTime(date);
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Message bubble footer: "Now", "5m", then the clock time. */
export function formatMessageTimestamp(iso: string) {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return "Now";
  if (diff < 60 * MINUTE) return `${Math.floor(diff / MINUTE)}m`;
  return formatTime(date);
}

/** Date separator between message groups: "Today", "Yesterday", "Monday", "Mon, Oct 1". */
export function formatDateSeparator(iso: string) {
  const date = new Date(iso);
  const days = daysAgo(date);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function isSameDay(a: string, b: string) {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

export function formatLastSeen(isOnline: boolean, lastSeenAt: string | null) {
  if (isOnline) return "Online";
  if (!lastSeenAt) return "";
  const date = new Date(lastSeenAt);
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return "Last seen just now";
  if (diff < 60 * MINUTE) return `Last seen ${Math.floor(diff / MINUTE)}m ago`;
  const days = daysAgo(date);
  if (days === 0) return `Last seen today at ${formatTime(date)}`;
  if (days === 1) return `Last seen yesterday at ${formatTime(date)}`;
  return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}
