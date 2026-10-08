"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmojiIcon, MicIcon, PlusIcon, SendIcon } from "@/components/ui/Icons";
import { sendSocket } from "@/lib/socket";
import { useChatStore } from "@/stores/chat";

const MAX_LENGTH = 4000;
const TYPING_IDLE_MS = 3000;
const MAX_HEIGHT_PX = 160;

export function Composer({ conversationId }: { conversationId: number }) {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTyping = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const setTyping = (typing: boolean) => {
    if (isTyping.current === typing) return;
    isTyping.current = typing;
    sendSocket({ type: "typing", data: { conversation_id: conversationId, is_typing: typing } });
  };

  // Stop the typing indicator when leaving the chat.
  useEffect(
    () => () => {
      clearTimeout(idleTimer.current);
      if (isTyping.current) {
        sendSocket({ type: "typing", data: { conversation_id: conversationId, is_typing: false } });
      }
    },
    [conversationId],
  );

  // Auto-grow the textarea up to a max height, like Signal.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  const onChange = (value: string) => {
    setText(value);
    clearTimeout(idleTimer.current);
    if (value.trim()) {
      setTyping(true);
      idleTimer.current = setTimeout(() => setTyping(false), TYPING_IDLE_MS);
    } else {
      setTyping(false);
    }
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    if (body.length > MAX_LENGTH) {
      toast.error(`Messages can be at most ${MAX_LENGTH} characters`);
      return;
    }
    setText("");
    clearTimeout(idleTimer.current);
    setTyping(false);
    sendMessage(conversationId, body);
    textareaRef.current?.focus();
  };

  const comingSoon = (feature: string) => () => toast(`${feature} are coming soon`);
  const hasText = text.trim().length > 0;

  return (
    <div className="flex shrink-0 items-end gap-2 border-t border-border px-3 py-2.5">
      <button className="icon-button mb-0.5" onClick={comingSoon("Emoji and stickers")} aria-label="Emoji">
        <EmojiIcon />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          placeholder="Message"
          aria-label="Message"
          autoFocus
          className="max-h-40 w-full resize-none rounded-[18px] bg-input px-3.5 py-[7px] text-[14px] leading-5 text-primary outline-none placeholder:text-tertiary"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter inserts a newline (Signal Desktop behaviour).
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {text.length > MAX_LENGTH - 200 && (
          <span
            className={`mt-1 self-end text-[11px] ${text.length > MAX_LENGTH ? "text-accent-red" : "text-tertiary"}`}
          >
            {text.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
      <button className="icon-button mb-0.5" onClick={comingSoon("Attachments")} aria-label="Attach file">
        <PlusIcon />
      </button>
      {hasText ? (
        <button
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ultramarine text-white transition-colors hover:bg-ultramarine-dark"
          onClick={submit}
          aria-label="Send message"
        >
          <SendIcon size={16} />
        </button>
      ) : (
        <button
          className="icon-button mb-0.5"
          onClick={comingSoon("Voice messages")}
          aria-label="Voice message"
        >
          <MicIcon />
        </button>
      )}
    </div>
  );
}
