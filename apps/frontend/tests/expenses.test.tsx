import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) };
});

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  apiUrl: (p: string) => `http://localhost:3001${p}`,
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import ExpensesPage from "@/app/expenses/page";
import { apiFetch } from "@/lib/api";

const mockedApiFetch = vi.mocked(apiFetch);

const EMPTY_RESPONSE = { data: [], total: 0, page: 1, pages: 1 };

const EXPENSE = {
  id: "exp-1",
  date: "2024-03-15T00:00:00.000Z",
  fournisseur: "Acme Corp",
  numero_reference: "INV-001",
  categorie: "Repas",
  description: "Business lunch",
  devise: "EUR",
  montant_ttc: 42.5,
  montant_ht: 35.42,
  tva: 7.08,
  montant_ttc_eur: 42.5,
  montant_ht_eur: 35.42,
  taux_change: 1,
  taux_change_date: "2024-03-14T00:00:00.000Z",
  fichier: null,
};

const ONE_EXPENSE_RESPONSE = { data: [EXPENSE], total: 1, page: 1, pages: 1 };

function setupApiMock(response = ONE_EXPENSE_RESPONSE) {
  mockedApiFetch.mockImplementation(async (url: string) => {
    if (String(url).includes("/api/auth/me"))
      return { email: "u@t.com", roles: ["User"], permissions: [] };
    if (String(url).includes("/api/settings")) return { require_validation: "false" };
    if (String(url).includes("/api/expenses?")) return response;
    if (String(url).includes("export-overlap"))
      return { total: 0, freshCount: 0, previousReports: [] };
    return undefined;
  });
}

describe("ExpensesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub window.location so href assignments don't throw in jsdom
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });
  });

  it("shows 'no results' empty state when there are no expenses", async () => {
    setupApiMock(EMPTY_RESPONSE);
    render(<ExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText("expenses.noResults")).toBeInTheDocument();
    });
  });

  it("renders expense rows from the API response", async () => {
    setupApiMock();
    render(<ExpensesPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("42.50 €")).toBeInTheDocument();
    });
  });

  it("opens delete confirmation dialog when trash icon is clicked", async () => {
    setupApiMock();
    render(<ExpensesPage />);

    await waitFor(() => screen.getByText("Acme Corp"));

    const trashBtn = document.querySelector('button[class*="text-slate-400"]') as HTMLElement;
    await userEvent.click(trashBtn);

    expect(screen.getByText("expenses.deleteConfirm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "expenses.cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "expenses.delete" })).toBeInTheDocument();
  });

  it("closes delete dialog when cancel is clicked", async () => {
    setupApiMock();
    render(<ExpensesPage />);

    await waitFor(() => screen.getByText("Acme Corp"));

    const trashBtn = document.querySelector('button[class*="text-slate-400"]') as HTMLElement;
    await userEvent.click(trashBtn);
    await userEvent.click(screen.getByRole("button", { name: "expenses.cancel" }));

    expect(screen.queryByText("expenses.deleteConfirm")).not.toBeInTheDocument();
  });

  it("calls delete API and reloads on confirm", async () => {
    let expensesCallCount = 0;
    mockedApiFetch.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/auth/me"))
        return { email: "u@t.com", roles: ["User"], permissions: [] };
      if (String(url).includes("/api/settings")) return { require_validation: "false" };
      if (String(url).includes("/api/expenses/exp-1") && !String(url).includes("?"))
        return undefined;
      if (String(url).includes("/api/expenses?")) {
        expensesCallCount++;
        return expensesCallCount === 1 ? ONE_EXPENSE_RESPONSE : EMPTY_RESPONSE;
      }
      return undefined;
    });

    render(<ExpensesPage />);
    await waitFor(() => screen.getByText("Acme Corp"));

    const trashBtn = document.querySelector('button[class*="text-slate-400"]') as HTMLElement;
    await userEvent.click(trashBtn);
    await userEvent.click(screen.getByRole("button", { name: "expenses.delete" }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/expenses/exp-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("triggers direct export when there is no overlap", async () => {
    setupApiMock();
    render(<ExpensesPage />);

    await waitFor(() => screen.getByText("Acme Corp"));

    await userEvent.click(screen.getByRole("button", { name: /expenses.export$/ }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(expect.stringContaining("export-overlap"));
      // location.href is set by runExport — no dialog shown
      expect(screen.queryByText("expenses.exportDialog.title")).not.toBeInTheDocument();
    });
  });

  it("shows export overlap dialog when previous reports exist", async () => {
    mockedApiFetch.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/auth/me"))
        return { email: "u@t.com", roles: ["User"], permissions: [] };
      if (String(url).includes("/api/settings")) return { require_validation: "false" };
      if (String(url).includes("/api/expenses?")) return ONE_EXPENSE_RESPONSE;
      if (String(url).includes("export-overlap")) {
        return {
          total: 1,
          freshCount: 0,
          previousReports: [{ id: "rpt-1", name: "March 2024", createdAt: "2024-03-01", count: 3 }],
        };
      }
      return undefined;
    });

    render(<ExpensesPage />);
    await waitFor(() => screen.getByText("Acme Corp"));

    await userEvent.click(screen.getByRole("button", { name: /expenses.export$/ }));

    await waitFor(() => {
      expect(screen.getByText("expenses.exportDialog.title")).toBeInTheDocument();
      expect(screen.getByText("March 2024")).toBeInTheDocument();
    });
  });

  it("closes export dialog when cancel is clicked", async () => {
    mockedApiFetch.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/auth/me"))
        return { email: "u@t.com", roles: ["User"], permissions: [] };
      if (String(url).includes("/api/settings")) return { require_validation: "false" };
      if (String(url).includes("/api/expenses?")) return ONE_EXPENSE_RESPONSE;
      if (String(url).includes("export-overlap")) {
        return {
          total: 1,
          freshCount: 0,
          previousReports: [{ id: "rpt-1", name: "March 2024", createdAt: "2024-03-01", count: 3 }],
        };
      }
      return undefined;
    });

    render(<ExpensesPage />);
    await waitFor(() => screen.getByText("Acme Corp"));

    await userEvent.click(screen.getByRole("button", { name: /expenses.export$/ }));
    await waitFor(() => screen.getByText("expenses.exportDialog.title"));

    await userEvent.click(screen.getByRole("button", { name: "expenses.exportDialog.cancel" }));
    expect(screen.queryByText("expenses.exportDialog.title")).not.toBeInTheDocument();
  });
});
