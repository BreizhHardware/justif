import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) };
});

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  apiUrl: (p: string) => p,
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import UploadPage from "@/app/upload/page";
import { apiFetch } from "@/lib/api";
import { mockPush } from "./__mocks__/next-navigation";

const mockedApiFetch = vi.mocked(apiFetch);

const OCR_RESULT = {
  date: "2024-03-15",
  montant_ttc: 42.5,
  montant_ht: 35.42,
  tva: 7.08,
  devise: "EUR",
  fournisseur: "Acme Corp",
  numero_reference: "INV-001",
  pays: "FR",
  categorie: "Repas",
  description: "Business lunch",
  langue_detectee: "fr",
};

function makeFile(name = "receipt.jpg") {
  return new File(["(binary)"], name, { type: "image/jpeg" });
}

describe("UploadPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the file dropzone initially", () => {
    render(<UploadPage />);
    expect(screen.getByText("upload.dropzone")).toBeInTheDocument();
  });

  it("shows analyzing state then populates form after OCR success", async () => {
    let resolveOcr!: (v: unknown) => void;
    mockedApiFetch.mockReturnValue(new Promise((r) => (resolveOcr = r)));

    render(<UploadPage />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    await userEvent.upload(input, makeFile());

    expect(await screen.findByText("upload.analyzing")).toBeInTheDocument();

    resolveOcr(OCR_RESULT);

    await waitFor(() => {
      expect(screen.queryByText("upload.analyzing")).not.toBeInTheDocument();
    });

    // Form should be visible with OCR-populated values
    const vendorInput = screen.getByDisplayValue("Acme Corp");
    expect(vendorInput).toBeInTheDocument();
    expect(screen.getByDisplayValue("INV-001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42.5")).toBeInTheDocument();
  });

  it("shows OCR error banner when analysis fails", async () => {
    mockedApiFetch.mockRejectedValue(new Error("OCR service unavailable"));

    render(<UploadPage />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    await userEvent.upload(input, makeFile());

    await waitFor(() => {
      expect(screen.getByText("OCR service unavailable")).toBeInTheDocument();
    });
  });

  it("shows empty form (no error banner) when OCR succeeds with null fields", async () => {
    const emptyResult = {
      ...OCR_RESULT,
      fournisseur: null,
      numero_reference: null,
      montant_ttc: null,
    };
    mockedApiFetch.mockResolvedValue(emptyResult);

    render(<UploadPage />);
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    await userEvent.upload(input, makeFile());

    await waitFor(() => {
      expect(screen.queryByText("upload.analyzing")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("upload.ocrError")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "upload.save" })).toBeInTheDocument();
  });

  it("saves expense and redirects to /expenses on submit", async () => {
    mockedApiFetch
      .mockResolvedValueOnce(OCR_RESULT)   // OCR call
      .mockResolvedValueOnce(undefined);    // save call

    render(<UploadPage />);
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    await userEvent.upload(input, makeFile());

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "upload.save" })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "upload.save" }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/expenses",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mockPush).toHaveBeenCalledWith("/expenses");
    });
  });
});
