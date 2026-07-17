import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  apiUrl: (p: string) => p,
}));

import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { apiFetch } from "@/lib/api";

const mockedApiFetch = vi.mocked(apiFetch);

// Helper component to expose ThemeProvider context values
function ThemeDisplay() {
  const { theme, isDark, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="isDark">{String(isDark)}</span>
      <button onClick={() => setTheme("dark")}>set-dark</button>
      <button onClick={() => setTheme("light")}>set-light</button>
      <button onClick={() => setTheme("system")}>set-system</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <ThemeDisplay />
    </ThemeProvider>,
  );
}

// matchMedia mock
function mockMatchMedia(prefersDark: boolean) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
  const mq = {
    matches: prefersDark,
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    dispatchChange: (matches: boolean) => {
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
    },
  };
  window.matchMedia = vi.fn().mockReturnValue(mq);
  return mq;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cookies
    document.cookie = "justif_theme=; max-age=0; path=/";
    // Reset html class
    document.documentElement.classList.remove("dark");
    // Default matchMedia (light preference)
    mockMatchMedia(false);
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  describe("initial theme", () => {
    it("defaults to 'system' when no cookie is present", async () => {
      mockedApiFetch.mockResolvedValue({ theme: "system" });
      renderProvider();
      expect(screen.getByTestId("theme").textContent).toBe("system");
    });

    it("reads 'dark' from the cookie on init", async () => {
      document.cookie = "justif_theme=dark; path=/";
      mockedApiFetch.mockResolvedValue({ theme: "dark" });
      renderProvider();
      expect(screen.getByTestId("theme").textContent).toBe("dark");
    });

    it("reads 'light' from the cookie on init", async () => {
      document.cookie = "justif_theme=light; path=/";
      mockedApiFetch.mockResolvedValue({ theme: "light" });
      renderProvider();
      expect(screen.getByTestId("theme").textContent).toBe("light");
    });
  });

  describe("DB sync on mount (cross-device)", () => {
    it("overrides cookie with DB theme and updates class", async () => {
      // Cookie says "light" but DB says "dark" → DB wins
      document.cookie = "justif_theme=light; path=/";
      mockedApiFetch.mockResolvedValue({ theme: "dark" });

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("theme").textContent).toBe("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
    });

    it("keeps cookie theme when DB matches", async () => {
      document.cookie = "justif_theme=light; path=/";
      mockedApiFetch.mockResolvedValue({ theme: "light" });

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("theme").textContent).toBe("light");
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      });
    });

    it("applies cookie theme when API returns 401 (unauthenticated page)", async () => {
      document.cookie = "justif_theme=dark; path=/";
      mockedApiFetch.mockRejectedValue(new Error("Unauthorized"));

      renderProvider();

      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
      // Theme state keeps the cookie value
      expect(screen.getByTestId("theme").textContent).toBe("dark");
    });
  });

  describe("applyThemeClass", () => {
    it("adds .dark class when theme is set to 'dark'", async () => {
      mockedApiFetch.mockResolvedValue({ theme: "dark" });
      renderProvider();

      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
    });

    it("removes .dark class when theme is set to 'light'", async () => {
      document.documentElement.classList.add("dark");
      mockedApiFetch.mockResolvedValue({ theme: "light" });
      renderProvider();

      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      });
    });

    it("applies .dark when theme is 'system' and OS prefers dark", async () => {
      mockMatchMedia(true); // OS prefers dark
      // Cookie says "light" but API is unavailable (unauthenticated page) →
      // catch path calls applyThemeClass("light") — not what we want here.
      // Instead: cookie="light", DB="system" → mismatch, applyThemeClass("system") called
      document.cookie = "justif_theme=light; path=/";
      mockedApiFetch.mockResolvedValue({ theme: "system" });
      renderProvider();

      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
    });

    it("does not apply .dark when theme is 'system' and OS prefers light", async () => {
      mockMatchMedia(false); // OS prefers light
      // Same mismatch trick: cookie="dark", DB="system" → applyThemeClass("system") called
      document.cookie = "justif_theme=dark; path=/";
      document.documentElement.classList.add("dark"); // simulate previous dark
      mockedApiFetch.mockResolvedValue({ theme: "system" });
      renderProvider();

      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      });
    });
  });

  describe("isDark context value", () => {
    it("exposes isDark=true when theme is 'dark'", async () => {
      document.cookie = "justif_theme=dark; path=/";
      mockedApiFetch.mockResolvedValue({ theme: "dark" });
      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isDark").textContent).toBe("true");
      });
    });

    it("exposes isDark=false when theme is 'light'", async () => {
      document.cookie = "justif_theme=light; path=/";
      mockedApiFetch.mockResolvedValue({ theme: "light" });
      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isDark").textContent).toBe("false");
      });
    });

    it("exposes isDark=true when theme is 'system' and OS prefers dark", async () => {
      mockMatchMedia(true);
      document.cookie = "justif_theme=light; path=/"; // mismatch triggers applyThemeClass
      mockedApiFetch.mockResolvedValue({ theme: "system" });
      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isDark").textContent).toBe("true");
      });
    });

    it("updates isDark in context when OS preference changes while on 'system'", async () => {
      const mq = mockMatchMedia(false);
      mockedApiFetch.mockResolvedValue({ theme: "system" });
      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("isDark").textContent).toBe("false");
      });

      act(() => { mq.dispatchChange(true); });
      expect(screen.getByTestId("isDark").textContent).toBe("true");

      act(() => { mq.dispatchChange(false); });
      expect(screen.getByTestId("isDark").textContent).toBe("false");
    });
  });

  describe("system matchMedia listener", () => {
    it("toggles .dark class when OS preference changes while on 'system'", async () => {
      const mq = mockMatchMedia(false);
      mockedApiFetch.mockResolvedValue({ theme: "system" });
      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("theme").textContent).toBe("system");
      });

      // Simulate OS switching to dark
      act(() => {
        mq.dispatchChange(true);
      });
      expect(document.documentElement.classList.contains("dark")).toBe(true);

      // Simulate OS switching back to light
      act(() => {
        mq.dispatchChange(false);
      });
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("does not register a matchMedia listener when theme is 'dark'", async () => {
      // Pre-set cookie so initial state is "dark" from the first render,
      // preventing the matchMedia effect from ever running with theme="system"
      document.cookie = "justif_theme=dark; path=/";
      const mq = mockMatchMedia(false);
      mockedApiFetch.mockResolvedValue({ theme: "dark" });
      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId("theme").textContent).toBe("dark");
      });

      expect(mq.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe("setTheme", () => {
    it("calls PATCH /api/auth/me with the new theme", async () => {
      mockedApiFetch
        .mockResolvedValueOnce({ theme: "system" }) // initial GET /me
        .mockResolvedValueOnce(undefined); // PATCH /me

      renderProvider();
      await waitFor(() => {
        expect(screen.getByTestId("theme").textContent).toBe("system");
      });

      await userEvent.click(screen.getByRole("button", { name: "set-dark" }));

      expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ theme: "dark" }),
      });
    });

    it("adds .dark class and writes cookie when setTheme('dark') is called", async () => {
      mockedApiFetch.mockResolvedValueOnce({ theme: "system" }).mockResolvedValueOnce(undefined);

      renderProvider();
      await waitFor(() => {
        expect(screen.getByTestId("theme").textContent).toBe("system");
      });

      await userEvent.click(screen.getByRole("button", { name: "set-dark" }));

      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.cookie).toContain("justif_theme=dark");
      expect(screen.getByTestId("theme").textContent).toBe("dark");
    });

    it("removes .dark class when setTheme('light') is called", async () => {
      document.documentElement.classList.add("dark");
      mockedApiFetch.mockResolvedValueOnce({ theme: "dark" }).mockResolvedValueOnce(undefined);

      renderProvider();
      await waitFor(() => {
        expect(screen.getByTestId("theme").textContent).toBe("dark");
      });

      await userEvent.click(screen.getByRole("button", { name: "set-light" }));

      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.cookie).toContain("justif_theme=light");
      expect(screen.getByTestId("theme").textContent).toBe("light");
    });

    it("updates the context theme state on setTheme('system')", async () => {
      mockedApiFetch.mockResolvedValueOnce({ theme: "dark" }).mockResolvedValueOnce(undefined);

      renderProvider();
      await waitFor(() => {
        expect(screen.getByTestId("theme").textContent).toBe("dark");
      });

      await userEvent.click(screen.getByRole("button", { name: "set-system" }));

      expect(screen.getByTestId("theme").textContent).toBe("system");
      expect(document.cookie).toContain("justif_theme=system");
    });

    it("rolls back state, class, and cookie when PATCH fails", async () => {
      document.cookie = "justif_theme=light; path=/";
      mockedApiFetch
        .mockResolvedValueOnce({ theme: "light" }) // initial GET /me
        .mockRejectedValueOnce(new Error("Network error")); // PATCH fails

      renderProvider();
      await waitFor(() => {
        expect(screen.getByTestId("theme").textContent).toBe("light");
      });

      await userEvent.click(screen.getByRole("button", { name: "set-dark" }));

      // After rollback, should revert to "light"
      await waitFor(() => {
        expect(screen.getByTestId("theme").textContent).toBe("light");
      });
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.cookie).toContain("justif_theme=light");
    });
  });
});
