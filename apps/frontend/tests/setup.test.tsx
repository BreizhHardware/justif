import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => key + (opts ? JSON.stringify(opts) : ""),
  }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  apiUrl: (p: string) => p,
}));

import SetupPage from "@/app/setup/page";
import { apiFetch } from "@/lib/api";
import { mockPush, mockReplace } from "./__mocks__/next-navigation";

const mockedApiFetch = vi.mocked(apiFetch);

const BASE_SETTINGS = {
  ocr_provider: "cloud" as const,
  mistral_model: "pixtral-12b-2409",
  ollama_url: "http://localhost:11434",
  ollama_model: "llava",
  ocr_extract_reference_number: "false",
  require_validation: "false",
  mistral_api_key_set: "false",
  oidc_issuer_url: "",
  oidc_client_id: "",
  oidc_scopes: "openid email profile",
  oidc_groups_claim: "groups",
  oidc_client_secret_set: "false",
};

function mockApi(overrides: { oidcEnabled?: boolean; settings?: Partial<typeof BASE_SETTINGS> }) {
  mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
    const p = path as string;
    if (p === "/api/auth/status") {
      return Promise.resolve({ setupComplete: false, oidcEnabled: overrides.oidcEnabled ?? false });
    }
    if (p === "/api/auth/setup") {
      return Promise.resolve({ token: "t" });
    }
    if (p === "/api/settings" && (!init || (init as RequestInit).method === undefined)) {
      return Promise.resolve({ ...BASE_SETTINGS, ...overrides.settings });
    }
    if (p === "/api/settings") {
      // PATCH
      return Promise.resolve({});
    }
    return Promise.reject(new Error(`unexpected call: ${p}`));
  });
}

async function completeStep1() {
  await userEvent.type(screen.getByLabelText("login.email"), "admin@example.com");
  await userEvent.type(screen.getByLabelText("login.password"), "password123");
  await userEvent.click(screen.getByRole("button", { name: "setup.submit" }));
  await screen.findByText("setup.ocrTitle");
}

describe("SetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("redirects away if setup is already complete", async () => {
    mockedApiFetch.mockImplementation((path: unknown) => {
      if (path === "/api/auth/status") {
        return Promise.resolve({ setupComplete: true, oidcEnabled: false });
      }
      return Promise.reject(new Error("unexpected"));
    });
    render(<SetupPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });

  it("skips the SSO step and finishes after step 2 when SSO is already configured", async () => {
    mockApi({ oidcEnabled: true });
    render(<SetupPage />);
    await completeStep1();

    await userEvent.click(screen.getByRole("button", { name: "setup.finish" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/expenses"));
  });

  it("shows a 3rd SSO step when SSO isn't configured yet, and saves it on finish", async () => {
    mockApi({ oidcEnabled: false });
    render(<SetupPage />);
    await completeStep1();

    // Step 2's primary button reads "Next" rather than "Finish" when a 3rd step follows.
    await userEvent.click(screen.getByRole("button", { name: "setup.next" }));
    await screen.findByText("setup.ssoTitle");

    await userEvent.type(
      screen.getByLabelText("settings.oidcIssuerUrl"),
      "https://idp.example.com",
    );
    await userEvent.type(screen.getByLabelText("settings.oidcClientId"), "justif");
    await userEvent.type(screen.getByLabelText("settings.oidcClientSecret"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "setup.finish" }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("https://idp.example.com"),
        }),
      );
      expect(mockPush).toHaveBeenCalledWith("/expenses");
    });
  });

  it("skipping step 3 goes straight to /expenses without saving", async () => {
    mockApi({ oidcEnabled: false });
    render(<SetupPage />);
    await completeStep1();
    await userEvent.click(screen.getByRole("button", { name: "setup.next" }));
    await screen.findByText("setup.ssoTitle");

    await userEvent.click(screen.getByRole("button", { name: "setup.skip" }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/expenses"));
  });

  it("pre-fills step 2 and shows an already-configured hint for settings coming from the environment", async () => {
    mockApi({
      oidcEnabled: false,
      settings: { mistral_api_key_set: "true", mistral_model: "custom-model" },
    });
    render(<SetupPage />);
    await completeStep1();

    expect(screen.getByLabelText("setup.mistralKey")).toHaveValue("");
    expect(screen.getByLabelText("setup.mistralKey")).toHaveAttribute(
      "placeholder",
      "••••••••••••",
    );
    expect(screen.getByText("setup.configuredViaEnv")).toBeInTheDocument();
    expect(screen.getByLabelText("setup.model")).toHaveValue("custom-model");
  });

  it("shows an already-configured hint on step 3 when the issuer URL comes from the environment", async () => {
    mockApi({
      oidcEnabled: false,
      settings: { oidc_issuer_url: "https://idp.example.com", oidc_client_id: "justif" },
    });
    render(<SetupPage />);
    await completeStep1();
    await userEvent.click(screen.getByRole("button", { name: "setup.next" }));
    await screen.findByText("setup.ssoTitle");

    expect(screen.getByLabelText("settings.oidcIssuerUrl")).toHaveValue("https://idp.example.com");
    expect(screen.getAllByText("setup.configuredViaEnv")).toHaveLength(1);
  });
});
