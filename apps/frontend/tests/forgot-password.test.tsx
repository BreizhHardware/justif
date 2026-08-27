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

import ForgotPasswordPage from "@/app/forgot-password/page";
import { apiFetch } from "@/lib/api";

const mockedApiFetch = vi.mocked(apiFetch);

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the email field and submit button", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText("forgotPassword.email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "forgotPassword.submit" })).toBeInTheDocument();
  });

  it("links back to /login", () => {
    render(<ForgotPasswordPage />);
    const link = screen.getByRole("link", { name: "forgotPassword.backToLogin" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("shows the generic success message after submitting", async () => {
    mockedApiFetch.mockResolvedValue(undefined);
    render(<ForgotPasswordPage />);

    await userEvent.type(screen.getByLabelText("forgotPassword.email"), "someone@example.com");
    await userEvent.click(screen.getByRole("button", { name: "forgotPassword.submit" }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/auth/forgot-password",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "someone@example.com" }),
        }),
      );
      expect(screen.getByText("forgotPassword.success")).toBeInTheDocument();
    });
  });

  it("shows the same generic success message even when the request fails", async () => {
    // The backend never reveals whether an account exists; the UI shouldn't either.
    mockedApiFetch.mockRejectedValue(new Error("network error"));
    render(<ForgotPasswordPage />);

    await userEvent.type(screen.getByLabelText("forgotPassword.email"), "nobody@example.com");
    await userEvent.click(screen.getByRole("button", { name: "forgotPassword.submit" }));

    await waitFor(() => {
      expect(screen.getByText("forgotPassword.success")).toBeInTheDocument();
    });
  });
});
