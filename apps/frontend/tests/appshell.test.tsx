import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  apiUrl: (p: string) => p,
}));

import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { mockPush, usePathname } from "./__mocks__/next-navigation";
import { PERMISSIONS } from "@/lib/permissions";

const mockedApiFetch = vi.mocked(apiFetch);

function renderShell() {
  return render(<AppShell><div data-testid="child">Content</div></AppShell>);
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathname.mockReturnValue("/dashboard");
    localStorage.clear();
  });

  it("shows admin-only nav links when the user has all permissions", async () => {
    mockedApiFetch.mockResolvedValue({
      email: "admin@test.com",
      roles: ["Admin"],
      permissions: [...PERMISSIONS],
    });
    renderShell();

    await waitFor(() => {
      // Permission-gated links: users, roles, audit, settings
      expect(screen.getAllByRole("link", { name: "nav.users" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: "nav.roles" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: "nav.audit" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: "nav.settings" }).length).toBeGreaterThan(0);
    });
  });

  it("hides permission-gated nav links when the user has no permissions", async () => {
    mockedApiFetch.mockResolvedValue({ email: "user@test.com", roles: ["User"], permissions: [] });
    renderShell();

    await waitFor(() => {
      // Non-gated links should appear
      expect(screen.getAllByRole("link", { name: "nav.dashboard" }).length).toBeGreaterThan(0);
    });

    expect(screen.queryByRole("link", { name: "nav.users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "nav.roles" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "nav.audit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "nav.settings" })).not.toBeInTheDocument();
  });

  it("displays the user's email in the sidebar", async () => {
    mockedApiFetch.mockResolvedValue({ email: "hello@test.com", roles: ["User"], permissions: [] });
    renderShell();

    await waitFor(() => {
      expect(screen.getByText("hello@test.com")).toBeInTheDocument();
    });
  });

  it("calls logout API and redirects to / on sign-out", async () => {
    mockedApiFetch
      .mockResolvedValueOnce({ email: "admin@test.com", roles: ["Admin"], permissions: [...PERMISSIONS] })
      .mockResolvedValueOnce(undefined); // logout call
    localStorage.setItem("justif_had_session", "1");

    renderShell();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "nav.logout" }).length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getAllByRole("button", { name: "nav.logout" })[0]);

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
      expect(mockPush).toHaveBeenCalledWith("/");
      expect(localStorage.getItem("justif_had_session")).toBeNull();
    });
  });

  it("renders child content", async () => {
    mockedApiFetch.mockResolvedValue({ email: "u@t.com", roles: ["User"], permissions: [] });
    renderShell();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
