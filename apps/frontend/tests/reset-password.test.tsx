import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/api", () => {
  class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    apiFetch: vi.fn(),
    apiUrl: (p: string) => p,
    ApiError: MockApiError,
  };
});

import ResetPasswordPage from "@/app/reset-password/page";
import { apiFetch, ApiError } from "@/lib/api";
import { mockPush } from "./__mocks__/next-navigation";
import { useSearchParams } from "next/navigation";

const mockedApiFetch = vi.mocked(apiFetch);
const mockedUseSearchParams = vi.mocked(useSearchParams);

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("token=raw-token-value"));
  });

  it("shows a missing-token message when there is no token in the URL", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());
    render(<ResetPasswordPage />);
    expect(screen.getByText("resetPassword.missingToken")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "resetPassword.requestNewLink" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("renders the password fields when a token is present", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByLabelText("resetPassword.password")).toBeInTheDocument();
    expect(screen.getByLabelText("resetPassword.confirmPassword")).toBeInTheDocument();
  });

  it("rejects mismatched passwords without calling the API", async () => {
    render(<ResetPasswordPage />);

    await userEvent.type(screen.getByLabelText("resetPassword.password"), "password-one");
    await userEvent.type(screen.getByLabelText("resetPassword.confirmPassword"), "password-two");
    await userEvent.click(screen.getByRole("button", { name: "resetPassword.submit" }));

    await waitFor(() => {
      expect(screen.getByText("resetPassword.mismatch")).toBeInTheDocument();
    });
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });

  it("submits the token and password, then redirects to /dashboard", async () => {
    mockedApiFetch.mockResolvedValue(undefined);
    render(<ResetPasswordPage />);

    await userEvent.type(screen.getByLabelText("resetPassword.password"), "brand-new-password");
    await userEvent.type(
      screen.getByLabelText("resetPassword.confirmPassword"),
      "brand-new-password",
    );
    await userEvent.click(screen.getByRole("button", { name: "resetPassword.submit" }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/auth/reset-password",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "raw-token-value", password: "brand-new-password" }),
        }),
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows an invalid-token error on a 400 response", async () => {
    mockedApiFetch.mockRejectedValue(
      new ApiError(400, "This reset link is invalid or has expired"),
    );
    render(<ResetPasswordPage />);

    await userEvent.type(screen.getByLabelText("resetPassword.password"), "brand-new-password");
    await userEvent.type(
      screen.getByLabelText("resetPassword.confirmPassword"),
      "brand-new-password",
    );
    await userEvent.click(screen.getByRole("button", { name: "resetPassword.submit" }));

    await waitFor(() => {
      expect(screen.getByText("resetPassword.invalidToken")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
