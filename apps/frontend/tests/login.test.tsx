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

import LoginPage from "@/app/login/page";
import { apiFetch } from "@/lib/api";
import { mockPush } from "./__mocks__/next-navigation";

const mockedApiFetch = vi.mocked(apiFetch);

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders email, password fields and submit button", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("login.email")).toBeInTheDocument();
    expect(screen.getByLabelText("login.password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "login.submit" })).toBeInTheDocument();
  });

  it("shows a privacy policy link pointing to /privacy", () => {
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: "login.privacy" });
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("redirects to /dashboard on successful login", async () => {
    mockedApiFetch.mockResolvedValue(undefined);
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText("login.email"), "admin@example.com");
    await userEvent.type(screen.getByLabelText("login.password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "login.submit" }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("sets justif_had_session in localStorage on successful login", async () => {
    mockedApiFetch.mockResolvedValue(undefined);
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText("login.email"), "admin@example.com");
    await userEvent.type(screen.getByLabelText("login.password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "login.submit" }));

    await waitFor(() => {
      expect(localStorage.getItem("justif_had_session")).toBe("1");
    });
  });

  it("shows an error message on invalid credentials", async () => {
    mockedApiFetch.mockRejectedValue(new Error("Unauthorized"));
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText("login.email"), "wrong@example.com");
    await userEvent.type(screen.getByLabelText("login.password"), "badpassword");
    await userEvent.click(screen.getByRole("button", { name: "login.submit" }));

    await waitFor(() => {
      expect(screen.getByText("login.error")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
