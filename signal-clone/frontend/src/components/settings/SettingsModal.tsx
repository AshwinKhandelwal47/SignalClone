"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import {
  BellIcon,
  ChatIcon,
  CloseIcon,
  DevicesIcon,
  LogoutIcon,
  PaletteIcon,
  PersonIcon,
  PhoneIcon,
  ShieldIcon,
} from "@/components/ui/Icons";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { type Theme, useUiStore } from "@/stores/ui";

type Section = "profile" | "appearance" | "chats" | "calls" | "notifications" | "privacy" | "devices";

const SECTIONS: { id: Section; label: string; icon: typeof PersonIcon }[] = [
  { id: "profile", label: "Profile", icon: PersonIcon },
  { id: "appearance", label: "Appearance", icon: PaletteIcon },
  { id: "chats", label: "Chats", icon: ChatIcon },
  { id: "calls", label: "Calls", icon: PhoneIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
  { id: "privacy", label: "Privacy", icon: ShieldIcon },
  { id: "devices", label: "Linked devices", icon: DevicesIcon },
];

// Placeholder settings shown (disabled) to mirror Signal's settings screens.
const PLACEHOLDERS: Record<Exclude<Section, "profile" | "appearance">, string[]> = {
  chats: [
    "Generate link previews",
    "Use system emoji",
    "Spell check text entered in message composition box",
  ],
  calls: ["Enable incoming calls", "Always relay calls", "Notifications for calls"],
  notifications: [
    "Notification content: Name and message",
    "Play notification sounds",
    "Show notifications for calls",
  ],
  privacy: ["Read receipts", "Typing indicators", "Show online status", "Screen security"],
  devices: ["Link a new device"],
};

export function SettingsModal() {
  const close = useUiStore((s) => s.closeSettings);
  const [section, setSection] = useState<Section>("profile");
  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <Modal onClose={close} width={760}>
      <div className="flex h-[min(560px,85vh)] flex-col sm:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-nav-rail p-2 sm:w-[200px] sm:flex-col sm:border-r sm:border-b-0">
          <h2 className="hidden px-3 pt-2 pb-3 text-[17px] font-semibold sm:block">Settings</h2>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                section === id ? "bg-selected" : "hover:bg-hover"
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h3 className="text-[17px] font-semibold">{current.label}</h3>
            <button className="icon-button" onClick={close} aria-label="Close settings">
              <CloseIcon />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {section === "profile" && <ProfileSection />}
            {section === "appearance" && <AppearanceSection />}
            {section !== "profile" && section !== "appearance" && (
              <PlaceholderSection items={PLACEHOLDERS[section]} />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ProfileSection() {
  const { user, setUser, logout } = useAuthStore();
  const [name, setName] = useState(user!.display_name);
  const [about, setAbout] = useState(user!.about);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!user) return null;

  const run = async (action: () => Promise<void>, success: string) => {
    try {
      await action();
      toast(success);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Something went wrong");
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => setUser(await api.updateProfile({ display_name: name, about })), "Profile updated");
  };

  const dirty = name.trim() !== user.display_name || about.trim() !== user.about;

  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar name={user.display_name} color={user.avatar_color} url={user.avatar_url} size={72} />
        <div className="flex flex-col items-start gap-1">
          <button className="text-ultramarine" onClick={() => fileInput.current?.click()}>
            {user.avatar_url ? "Change photo" : "Add photo"}
          </button>
          {user.avatar_url && (
            <button
              className="text-[13px] text-secondary hover:text-primary"
              onClick={() => run(async () => setUser(await api.removeAvatar()), "Photo removed")}
            >
              Remove photo
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) run(async () => setUser(await api.uploadAvatar(file)), "Profile photo updated");
            e.target.value = "";
          }}
        />
      </div>

      <form onSubmit={save} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-secondary">Name</span>
          <input
            className="form-field"
            value={name}
            maxLength={64}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-secondary">About</span>
          <input
            className="form-field"
            value={about}
            maxLength={140}
            placeholder="Write a few words about yourself"
            onChange={(e) => setAbout(e.target.value)}
          />
        </label>
        <div className="text-[13px] text-secondary">
          {user.phone_number && <p>Phone: {user.phone_number}</p>}
          {user.username && <p>Username: @{user.username}</p>}
        </div>
        <button className="btn-primary self-start" disabled={!dirty || !name.trim()}>
          Save
        </button>
      </form>

      <div className="mt-8 border-t border-border pt-4">
        <p className="mb-2 text-[13px] font-semibold text-secondary">Keyboard shortcuts</p>
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex justify-between py-1 text-[13px]">
            <span>{s.description}</span>
            <kbd className="rounded bg-hover px-1.5 font-mono text-[12px]">{s.keys}</kbd>
          </div>
        ))}
      </div>

      <button className="mt-6 flex items-center gap-2 text-accent-red" onClick={() => setConfirmLogout(true)}>
        <LogoutIcon size={18} /> Log out
      </button>
      {confirmLogout && (
        <ConfirmDialog
          title="Log out?"
          body="You'll need to verify your number again to log back in."
          confirmLabel="Log out"
          destructive
          onConfirm={() => {
            useUiStore.getState().closeSettings();
            logout();
          }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useUiStore();
  const options: { value: Theme; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];
  return (
    <div>
      <p className="mb-3 text-[13px] text-secondary">Theme</p>
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover"
          >
            <input
              type="radio"
              name="theme"
              checked={theme === o.value}
              onChange={() => setTheme(o.value)}
              className="h-4 w-4 accent-[var(--ultramarine)]"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function PlaceholderSection({ items }: { items: string[] }) {
  return (
    <div>
      <div className="mb-4 rounded-lg bg-hover px-3 py-2 text-[13px] text-secondary">
        Coming soon. These settings are placeholders in this Signal clone.
      </div>
      {items.map((item) => (
        <div key={item} className="flex items-center justify-between gap-4 py-2.5 opacity-60">
          <span>{item}</span>
          <span className="relative h-5 w-9 shrink-0 rounded-full bg-gray-25" aria-hidden="true">
            <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white" />
          </span>
        </div>
      ))}
    </div>
  );
}
