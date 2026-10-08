"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";

export default function Home() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (status === "authenticated") router.replace("/chats");
    if (status === "anonymous") router.replace("/onboarding");
  }, [status, router]);

  return <div className="h-full bg-chat" />;
}
