"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type Theme = "light" | "dark" | "system";

const COOKIE_NAME = "justif_theme";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function readThemeCookie(): Theme | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split("; ").find((r) => r.startsWith(`${COOKIE_NAME}=`));
  const val = entry?.split("=")[1];
  if (val === "light" || val === "dark" || val === "system") return val;
  return null;
}

function writeThemeCookie(theme: Theme) {
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    root.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
}

const ThemeContext = createContext<{
  theme: Theme;
  isDark: boolean;
  setTheme: (t: Theme) => Promise<void>;
}>({
  theme: "system",
  isDark: false,
  setTheme: async () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readThemeCookie() ?? "system");
  const [isDark, setIsDark] = useState(() => {
    const t = readThemeCookie() ?? "system";
    if (t === "dark") return true;
    if (t === "light") return false;
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Sync from DB on mount (handles cross-device: DB overrides cookie)
  useEffect(() => {
    apiFetch<{ theme: string }>("/api/auth/me")
      .then((me) => {
        const dbTheme = me.theme as Theme;
        if (dbTheme !== theme) {
          setThemeState(dbTheme);
          applyThemeClass(dbTheme);
          writeThemeCookie(dbTheme);
        }
      })
      .catch(() => {
        // Not authenticated (login/setup pages) — apply from cookie
        applyThemeClass(theme);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve isDark and manage system preference listener
  useEffect(() => {
    if (theme === "dark") { setIsDark(true); return; }
    if (theme === "light") { setIsDark(false); return; }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
      setIsDark(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  async function setTheme(t: Theme) {
    const prev = theme;
    setThemeState(t);
    applyThemeClass(t);
    writeThemeCookie(t);
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ theme: t }),
      });
    } catch {
      setThemeState(prev);
      applyThemeClass(prev);
      writeThemeCookie(prev);
    }
  }

  return <ThemeContext.Provider value={{ theme, isDark, setTheme }}>{children}</ThemeContext.Provider>;
}
