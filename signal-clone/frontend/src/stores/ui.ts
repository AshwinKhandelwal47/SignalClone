import { create } from "zustand";

export type Theme = "system" | "light" | "dark";
const THEME_KEY = "signal-theme";

export function applyTheme(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

/** Runs before hydration (inlined in <head>) so the saved theme applies without a flash. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

interface UiState {
  settingsOpen: boolean;
  theme: Theme;
  openSettings: () => void;
  closeSettings: () => void;
  loadTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  theme: "system",
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  loadTheme: () => set({ theme: readTheme() }),
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Not persisted; still applied for this session.
    }
    applyTheme(theme);
    set({ theme });
  },
}));
