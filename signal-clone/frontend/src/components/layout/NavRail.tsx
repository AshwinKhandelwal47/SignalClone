"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { ChatIcon, PhoneIcon, SettingsIcon, StoriesIcon } from "@/components/ui/Icons";
import { useAuthStore } from "@/stores/auth";
import { useChatStore } from "@/stores/chat";
import { useUiStore } from "@/stores/ui";

const TABS = [
  { href: "/chats", label: "Chats", icon: ChatIcon },
  { href: "/calls", label: "Calls", icon: PhoneIcon },
  { href: "/stories", label: "Stories", icon: StoriesIcon },
];

/** Signal Desktop's narrow left column: Chats / Calls / Stories, settings and profile. */
export function NavRail() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user)!;
  const openSettings = useUiStore((s) => s.openSettings);
  const totalUnread = useChatStore((s) =>
    Object.values(s.conversations).reduce((sum, c) => sum + c.unread_count, 0),
  );
  // On phones the rail is hidden while a chat is open, to give the chat the full width.
  const inChat = /^\/chats\/\d+/.test(pathname);

  return (
    <nav
      className={`${inChat ? "hidden md:flex" : "flex"} w-[var(--spacing-nav-rail)] shrink-0 flex-col items-center border-r border-border bg-nav-rail py-3`}
    >
      <div className="flex flex-col gap-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                active ? "bg-selected text-primary" : "text-secondary hover:bg-hover"
              }`}
            >
              <Icon size={22} />
              {href === "/chats" && totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-badge-unread px-1 text-center text-[11px] leading-[18px] font-semibold text-white">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="mt-auto flex flex-col items-center gap-3">
        <button
          onClick={openSettings}
          className="icon-button h-11 w-11 rounded-xl"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon size={22} />
        </button>
        <button onClick={openSettings} title="Profile" aria-label="Profile" className="rounded-full">
          <Avatar name={user.display_name} color={user.avatar_color} url={user.avatar_url} size={32} />
        </button>
      </div>
    </nav>
  );
}
