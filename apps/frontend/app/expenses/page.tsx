"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiFetch, apiUrl } from "@/lib/api";
import { t } from "@/lib/i18n";
import { COMMON_CURRENCIES } from "@/lib/currencies";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";

interface Expense {
  id: string;
  date: string;
  fournisseur: string | null;
  categorie: string;
  description: string | null;
  devise: string;
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  montant_ttc_eur: number | null;
  montant_ht_eur: number | null;
  taux_change: number | null;
  taux_change_date: string | null;
  fichier: string | null;
}

interface ExpensesResponse {
  data: Expense[];
  total: number;
  page: number;
  pages: number;
}

const LIMIT = 20;

export default function ExpensesPage() {
  const i18n = t();
  const [response, setResponse] = useState<ExpensesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState({ from: "", to: "", categorie: "", devise: "", q: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Expense>>({});

  const loadExpenses = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      sort,
      order,
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.categorie ? { categorie: filters.categorie } : {}),
      ...(filters.devise ? { devise: filters.devise } : {}),
      ...(filters.q ? { q: filters.q } : {}),
    });
    const result = await apiFetch<ExpensesResponse>(`/api/expenses?${params}`);
    setResponse(result);
  }, [page, sort, order, filters]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  function toggleSort(column: string) {
    if (sort === column) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(column);
      setOrder("asc");
    }
  }

  async function handleDelete(id: string) {
    await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    loadExpenses();
  }

  async function handleRecalculate(id: string) {
    await apiFetch(`/api/expenses/${id}/recalculate`, { method: "POST" });
    loadExpenses();
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setEditValues(expense);
  }

  async function saveEdit() {
    if (!editingId) return;
    await apiFetch(`/api/expenses/${editingId}`, {
      method: "PATCH",
      body: JSON.stringify(editValues),
    });
    setEditingId(null);
    loadExpenses();
  }

  function handleExport() {
    const params = new URLSearchParams({
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.categorie ? { categorie: filters.categorie } : {}),
      ...(filters.devise ? { devise: filters.devise } : {}),
      ...(filters.q ? { q: filters.q } : {}),
    });
    window.location.href = apiUrl(`/api/expenses/export?${params}`);
  }

  const columns: { key: string; label: string }[] = [
    { key: "date", label: i18n.expenses.date },
    { key: "fournisseur", label: i18n.expenses.fournisseur },
    { key: "categorie", label: i18n.expenses.categorie },
    { key: "description", label: i18n.expenses.description },
    { key: "montant_ttc", label: i18n.expenses.montantOriginal },
    { key: "devise", label: i18n.expenses.devise },
    { key: "montant_ttc_eur", label: i18n.expenses.montantEur },
    { key: "fichier", label: i18n.expenses.justificatif },
  ];

  return (
    <AppShell>
      <PageHeader title={i18n.expenses.title}>
        <Button onClick={handleExport}>
          <Download size={16} />
          {i18n.expenses.export}
        </Button>
      </PageHeader>

      <Card className="mb-5 grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500">
            {i18n.expenses.filters.from}
          </span>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => {
              setFilters({ ...filters, from: e.target.value });
              setPage(1);
            }}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500">
            {i18n.expenses.filters.to}
          </span>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => {
              setFilters({ ...filters, to: e.target.value });
              setPage(1);
            }}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500">
            {i18n.expenses.filters.categorie}
          </span>
          <Select
            value={filters.categorie}
            onChange={(e) => {
              setFilters({ ...filters, categorie: e.target.value });
              setPage(1);
            }}
          >
            <option value="">—</option>
            {i18n.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500">
            {i18n.expenses.filters.devise}
          </span>
          <Select
            value={filters.devise}
            onChange={(e) => {
              setFilters({ ...filters, devise: e.target.value });
              setPage(1);
            }}
          >
            <option value="">—</option>
            {COMMON_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>
        <div className="relative">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            {i18n.expenses.filters.search}
          </span>
          <Search
            className="pointer-events-none absolute left-2.5 top-[34px] text-slate-400"
            size={15}
          />
          <Input
            value={filters.q}
            onChange={(e) => {
              setFilters({ ...filters, q: e.target.value });
              setPage(1);
            }}
            placeholder={i18n.expenses.filters.search}
            className="pl-8"
          />
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.key !== "fichier" && toggleSort(col.key)}
                  className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900"
                >
                  {col.label}
                  {sort === col.key && (order === "asc" ? " ▲" : " ▼")}
                </th>
              ))}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {response?.data.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-slate-400">
                  {i18n.expenses.noResults}
                </td>
              </tr>
            )}
            {response?.data.map((expense) => {
              const isEditing = editingId === expense.id;
              return (
                <tr
                  key={expense.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editValues.date?.slice(0, 10) ?? ""}
                        onChange={(e) => setEditValues({ ...editValues, date: e.target.value })}
                        className="w-36"
                      />
                    ) : (
                      new Date(expense.date).toLocaleDateString("fr-FR")
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={() => !isEditing && startEdit(expense)}>
                    {isEditing ? (
                      <Input
                        value={editValues.fournisseur ?? ""}
                        onChange={(e) =>
                          setEditValues({ ...editValues, fournisseur: e.target.value })
                        }
                        className="w-32"
                      />
                    ) : (
                      (expense.fournisseur ?? "—")
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={() => !isEditing && startEdit(expense)}>
                    {isEditing ? (
                      <Select
                        value={editValues.categorie ?? expense.categorie}
                        onChange={(e) =>
                          setEditValues({ ...editValues, categorie: e.target.value })
                        }
                        className="w-32"
                      >
                        {i18n.categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone="slate">{expense.categorie}</Badge>
                    )}
                  </td>
                  <td
                    className="max-w-[16rem] truncate px-4 py-3"
                    onClick={() => !isEditing && startEdit(expense)}
                  >
                    {isEditing ? (
                      <Input
                        value={editValues.description ?? ""}
                        onChange={(e) =>
                          setEditValues({ ...editValues, description: e.target.value })
                        }
                        className="w-40"
                      />
                    ) : (
                      (expense.description ?? "—")
                    )}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3"
                    onClick={() => !isEditing && startEdit(expense)}
                  >
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editValues.montant_ttc ?? ""}
                        onChange={(e) =>
                          setEditValues({ ...editValues, montant_ttc: Number(e.target.value) })
                        }
                        className="w-24"
                      />
                    ) : (
                      (expense.montant_ttc?.toFixed(2) ?? "—")
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={expense.devise === "EUR" ? "brand" : "blue"}>
                      {expense.devise}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {expense.montant_ttc_eur !== null ? (
                      <span
                        title={
                          expense.taux_change && expense.taux_change_date
                            ? `1 ${expense.devise} = ${expense.taux_change.toFixed(4)} EUR — taux BCE du ${new Date(expense.taux_change_date).toLocaleDateString("fr-FR")}`
                            : undefined
                        }
                      >
                        {expense.montant_ttc_eur.toFixed(2)} €
                      </span>
                    ) : (
                      <span
                        className="flex items-center gap-1.5 text-amber-600"
                        title={i18n.expenses.conversionFailed}
                      >
                        <AlertTriangle size={14} />
                        <button
                          onClick={() => handleRecalculate(expense.id)}
                          className="flex items-center gap-1 underline"
                        >
                          <RotateCw size={12} />
                          {i18n.expenses.recalculate}
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {expense.fichier ? (
                      <img
                        src={apiUrl(`/uploads/${expense.fichier}`)}
                        alt="Justificatif"
                        onClick={() => setModalImage(apiUrl(`/uploads/${expense.fichier}`))}
                        className="h-10 w-10 cursor-pointer rounded-lg border border-slate-200 object-cover transition hover:opacity-80"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="primary" onClick={saveEdit}>
                          OK
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X size={14} />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(expense.id)}
                        className="text-slate-400 transition hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {response && response.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={14} />
          </Button>
          <span className="text-slate-600">
            {page} / {response.pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= response.pages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm p-6">
            <p className="mb-4 text-sm text-slate-700">{i18n.expenses.deleteConfirm}</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => handleDelete(confirmDeleteId)}
              >
                {i18n.expenses.delete}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setModalImage(null)}
        >
          <img
            src={modalImage}
            alt="Justificatif"
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
          />
        </div>
      )}
    </AppShell>
  );
}
