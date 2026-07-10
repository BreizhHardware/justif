"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FileImage, Loader2, UploadCloud, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { CATEGORY_VALUES } from "@/lib/i18n";
import { COMMON_CURRENCIES } from "@/lib/currencies";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";

interface OcrResult {
  date: string | null;
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  devise: string | null;
  fournisseur: string | null;
  numero_reference: string | null;
  pays: string | null;
  categorie: string;
  description: string | null;
  langue_detectee: string | null;
}

export default function UploadPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [form, setForm] = useState<OcrResult | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleFile(selected: File) {
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setOcrError(null);
    setAnalyzing(true);
    setForm({
      date: null,
      montant_ttc: null,
      montant_ht: null,
      tva: null,
      devise: "EUR",
      fournisseur: null,
      numero_reference: null,
      pays: null,
      categorie: "Autre",
      description: null,
      langue_detectee: null,
    });

    try {
      const formData = new FormData();
      formData.append("fichier", selected);
      const result = await apiFetch<OcrResult>("/api/ocr/analyze", {
        method: "POST",
        body: formData,
      });
      setForm(result);
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : t("upload.ocrError"));
    } finally {
      setAnalyzing(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function reset() {
    setForm(null);
    setFile(null);
    setPreviewUrl(null);
    setOcrError(null);
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const formData = new FormData();
      if (file) formData.append("fichier", file);
      formData.append("date", form.date ?? new Date().toISOString().slice(0, 10));
      if (form.fournisseur) formData.append("fournisseur", form.fournisseur);
      if (form.numero_reference) formData.append("numero_reference", form.numero_reference);
      formData.append("categorie", form.categorie);
      if (form.description) formData.append("description", form.description);
      formData.append("devise", form.devise ?? "EUR");
      if (form.montant_ttc !== null) formData.append("montant_ttc", String(form.montant_ttc));
      if (form.montant_ht !== null) formData.append("montant_ht", String(form.montant_ht));
      if (form.tva !== null) formData.append("tva", String(form.tva));
      if (form.pays) formData.append("pays", form.pays);
      if (form.langue_detectee) formData.append("langue_detectee", form.langue_detectee);

      await apiFetch("/api/expenses", { method: "POST", body: formData });
      router.push("/expenses");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title={t("upload.title")} />

      <div className="max-w-2xl">
        {!form && (
          <Card
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={`flex h-56 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed text-sm transition ${
              dragOver ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-brand-300"
            }`}
          >
            <UploadCloud className={dragOver ? "text-brand-600" : "text-slate-400"} size={32} />
            <span className="text-slate-500">{t("upload.dropzone")}</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleFile(selected);
              }}
            />
          </Card>
        )}

        {analyzing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="animate-spin" size={16} />
            {t("upload.analyzing")}
          </div>
        )}
        {ocrError && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle size={16} />
            {ocrError}
          </div>
        )}

        {form && (
          <Card className="mt-6 p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSave();
              }}
              className="space-y-5"
            >
              {previewUrl && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <img
                    src={previewUrl}
                    alt={t("expenses.previewAlt")}
                    className="h-20 w-20 rounded-lg border object-cover"
                  />
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <FileImage size={16} />
                    {file?.name}
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    className="ml-auto text-slate-400 hover:text-slate-700"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">{t("expenses.date")}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.date ?? ""}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="categorie">{t("expenses.categorie")}</Label>
                  <Select
                    id="categorie"
                    value={form.categorie}
                    onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                  >
                    {CATEGORY_VALUES.map((c) => (
                      <option key={c} value={c}>
                        {t(`categories.${c}` as never)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fournisseur">{t("expenses.fournisseur")}</Label>
                  <Input
                    id="fournisseur"
                    value={form.fournisseur ?? ""}
                    onChange={(e) => setForm({ ...form, fournisseur: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="numeroReference">{t("expenses.numero_reference")}</Label>
                  <Input
                    id="numeroReference"
                    value={form.numero_reference ?? ""}
                    onChange={(e) => setForm({ ...form, numero_reference: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="devise">{t("expenses.devise")}</Label>
                  <Select
                    id="devise"
                    value={form.devise ?? "EUR"}
                    onChange={(e) => setForm({ ...form, devise: e.target.value })}
                  >
                    {COMMON_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="montantTtc">{t("expenses.montantTtc")}</Label>
                  <Input
                    id="montantTtc"
                    type="number"
                    step="0.01"
                    value={form.montant_ttc ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        montant_ttc: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="montantHt">{t("expenses.montantHt")}</Label>
                  <Input
                    id="montantHt"
                    type="number"
                    step="0.01"
                    value={form.montant_ht ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        montant_ht: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">{t("expenses.description")}</Label>
                  <Input
                    id="description"
                    value={form.description ?? ""}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-100 pt-5">
                <Button type="submit" disabled={saving}>
                  {t("upload.save")}
                </Button>
                <Button type="button" variant="secondary" onClick={reset}>
                  {t("expenses.cancel")}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
