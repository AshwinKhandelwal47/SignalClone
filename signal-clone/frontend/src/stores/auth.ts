import { create } from "zustand";
import { api, getToken, setToken, setUnauthorizedHandler } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";
import type { User } from "@/lib/types";
import { useChatStore } from "./chat";

interface AuthState {
  status: "loading" | "authenticated" | "anonymous";
  token: string | null;
  user: User | null;
  /** Restores the session from localStorage on app load. */
  init: () => Promise<void>;
  signIn: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  token: null,
  user: null,

  init: async () => {
    if (get().status !== "loading") return;
    const token = getToken();
    if (!token) {
      set({ status: "anonymous" });
      return;
    }
    try {
      const user = await api.me();
      set({ status: "authenticated", token, user });
    } catch {
      get().clear();
    }
  },

  signIn: (token, user) => {
    setToken(token);
    set({ status: "authenticated", token, user });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    try {
      await api.logout();
    } finally {
      get().clear();
    }
  },

  clear: () => {
    setToken(null);
    disconnectSocket();
    useChatStore.getState().reset();
    set({ status: "anonymous", token: null, user: null });
  },
}));

setUnauthorizedHandler(() => useAuthStore.getState().clear());
