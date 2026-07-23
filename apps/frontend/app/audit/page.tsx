"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { getLocaleTag } from "@/lib/i18n";

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  targetUserId: string | null;
  metadata: string | null;
  ip: string | null;
  userId: string | null;
  user: { email: string } | null;
}

interface AuditResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pages: number;
}

interface UserSummary {
  id: string;
  email: string;
}

const ACTION_VALUES = [
  "auth.login",
  "auth.login_failed",
  "user.create",
  "user.update",
  "expense.create",
  "expense.update",
  "expense.delete",
  "expense.recalculate",
  "export.xlsx",
  "export.zip",
  "settings.update",
] as const;

type ActionTone = "slate" | "brand" | "blue" | "amber" | "red";

function actionTone(action: string): ActionTone {
  if (action === "expense.delete") return "red";
  if (action === "auth.login_failed" || action === "settings.update") return "amber";
  if (action === "expense.create" || action.startsWith("export.")) return "brand";
  return "blue";
}

function formatMetadata(metadata: string | null): string {
  if (!metadata) return "—";
  try {
    return JSON.stringify(JSON.parse(metadata), null, 0)
      .replace(/[{}"]/g, "")
      .replace(/,/g, ", ")
      .slice(0, 120);
  } catch {
    return metadata.slice(0, 120);
  }
}

const LIMIT = 25;

export default function AuditPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [response, setResponse] = useState<AuditResponse | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ from: "", to: "", action: "", userId: "" });

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.action) params.set("action", filters.action);
    if (filters.userId) params.set("userId", filters.userId);
    const data = await apiFetch<AuditResponse>(`/api/audit?${params}`);
    setResponse(data);
  }, [page, filters]);

  useEffect(() => {
    load().catch(() => router.replace("/expenses"));
  }, [load, router]);

  useEffect(() => {
    apiFetch<UserSummary[]>("/api/users")
      .then(setUsers)
      .catch(() => {});
  }, []);

  function handleFilterChange(key: keyof typeof filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  return (
    <AppShell>
      <PageHeader title={t("audit.title")} />

      <Card className="mb-4 flex flex-wrap gap-4 p-4">
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("audit.filters.from")}
          </span>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => handleFilterChange("from", e.target.value)}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("audit.filters.to")}
          </span>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => handleFilterChange("to", e.target.value)}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("audit.filters.action")}
          </span>
          <Select
            value={filters.action}
            onChange={(e) => handleFilterChange("action", e.target.value)}
          >
            <option value="">{t("audit.filters.allActions")}</option>
            {ACTION_VALUES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("audit.filters.user")}
          </span>
          <Select
            value={filters.userId}
            onChange={(e) => handleFilterChange("userId", e.target.value)}
          >
            <option value="">{t("audit.filters.allUsers")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left dark:border-slate-800">
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t("audit.columns.timestamp")}
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t("audit.columns.actor")}
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t("audit.columns.action")}
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t("audit.columns.entity")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t("audit.columns.details")}
              </th>
            </tr>
          </thead>
          <tbody>
            {response?.data.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-400 dark:text-slate-500"
                >
                  {t("audit.noResults")}
                </td>
              </tr>
            )}
            {response?.data.map((log) => (
              <tr
                key={log.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {new Date(log.timestamp).toLocaleString(getLocaleTag())}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {log.user?.email ?? (
                    <span className="italic text-slate-400 dark:text-slate-500">
                      {t("audit.deletedUser")}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {log.entityType ? (
                    <>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {log.entityType}
                      </span>
                      {log.entityId && (
                        <span className="ml-1 text-slate-400 dark:text-slate-500">
                          {log.entityId.slice(0, 8)}…
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {formatMetadata(log.metadata)}
                </td>
              </tr>
            ))}
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
          <span className="text-slate-600 dark:text-slate-400">
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
    </AppShell>
  );
}
