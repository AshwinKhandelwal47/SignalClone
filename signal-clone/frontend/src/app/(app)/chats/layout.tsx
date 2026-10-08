"use client";

import { useParams } from "next/navigation";
import { LeftPane } from "@/components/conversations/LeftPane";

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ conversationId?: string }>();
  const inChat = Boolean(params.conversationId);

  return (
    <>
      {/* Phones show either the list or the open chat; wider screens show both. */}
      <LeftPane hiddenOnMobile={inChat} />
      <section className={`${inChat ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-chat`}>
        {children}
      </section>
    </>
  );
}
