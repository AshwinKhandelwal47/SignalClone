"use client";

import { useState } from "react";
import { ChatListView } from "./ChatListView";
import { ComposeView } from "./ComposeView";
import { NewGroupView } from "./NewGroupView";

type Mode = "chats" | "compose" | "group";

/** Signal's left pane swaps between the chat list, "New chat" and "New group" in place. */
export function LeftPane({ hiddenOnMobile }: { hiddenOnMobile: boolean }) {
  const [mode, setMode] = useState<Mode>("chats");

  return (
    <aside
      className={`${hiddenOnMobile ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border bg-left-pane md:w-[var(--spacing-left-pane)] md:shrink-0`}
    >
      {mode === "chats" && <ChatListView onCompose={() => setMode("compose")} />}
      {mode === "compose" && (
        <ComposeView onBack={() => setMode("chats")} onNewGroup={() => setMode("group")} />
      )}
      {mode === "group" && <NewGroupView onBack={() => setMode("compose")} onDone={() => setMode("chats")} />}
    </aside>
  );
}
