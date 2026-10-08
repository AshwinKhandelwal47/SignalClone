import { API_URL } from "./constants";
import type { ServerEvent } from "./types";

const UNAUTHORIZED_CLOSE_CODE = 4401;
const PING_INTERVAL_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

interface SocketHandlers {
  onEvent: (event: ServerEvent) => void;
  /** Called on every successful (re)connect; `isReconnect` is false the first time. */
  onOpen: (isReconnect: boolean) => void;
  onClose: () => void;
  onUnauthorized: () => void;
}

let socket: WebSocket | null = null;
let stopped = true;
let attempts = 0;
let hasConnectedBefore = false;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

/** Opens one WebSocket per tab and keeps it alive with exponential-backoff reconnects. */
export function connectSocket(token: string, handlers: SocketHandlers) {
  disconnectSocket();
  stopped = false;
  hasConnectedBefore = false;

  const open = () => {
    const url = `${API_URL.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    socket = ws;

    ws.onopen = () => {
      attempts = 0;
      handlers.onOpen(hasConnectedBefore);
      hasConnectedBefore = true;
      pingTimer = setInterval(() => sendSocket({ type: "ping" }), PING_INTERVAL_MS);
    };
    ws.onmessage = (message) => {
      try {
        handlers.onEvent(JSON.parse(message.data) as ServerEvent);
      } catch {
        // Ignore malformed frames.
      }
    };
    ws.onclose = (event) => {
      clearInterval(pingTimer);
      if (socket === ws) socket = null;
      if (stopped) return;
      handlers.onClose();
      if (event.code === UNAUTHORIZED_CLOSE_CODE) {
        handlers.onUnauthorized();
        return;
      }
      const delay = Math.min(1000 * 2 ** attempts, MAX_BACKOFF_MS);
      attempts += 1;
      retryTimer = setTimeout(open, delay);
    };
  };

  open();
}

export function sendSocket(event: { type: string; data?: unknown }) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}

export function disconnectSocket() {
  stopped = true;
  clearInterval(pingTimer);
  clearTimeout(retryTimer);
  socket?.close();
  socket = null;
}
