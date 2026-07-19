"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/AppShell";
import { Card, Input, Label, PageHeader } from "@/components/ui";
import { apiFetch, ApiError } from "@/lib/api";
import { getLocaleTag } from "@/lib/i18n";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveLine } from "@nivo/line";
import { useTheme } from "@/components/ThemeProvider";

type Granularity = "month" | "day";
type BreakdownBy = "category" | "vendor";

type DashboardSummary = {
  total: number;
  count: number;
  average: number;
  byCategory: { categorie: string; sum: number; count: number }[];
  byVendor: { fournisseur: string | null; sum: number; count: number }[];
  byMonth: { month: string; count: number; sum: number }[];
  granularity: Granularity;
  recentReports: { id: string; name: string; createdAt: string; count: number }[];
};

type MePrefs = {
  dashboardGranularity: Granularity;
  dashboardBreakdownBy: BreakdownBy;
};

const BRAND_COLORS = ["#2D6A4F", "#40916C", "#52B788", "#74C69D", "#95D5B2", "#B7E4C7", "#D8F3DC"];

function fmt(n: number) {
  return n.toLocaleString(getLocaleTag(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [breakdownBy, setBreakdownBy] = useState<BreakdownBy>("category");
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    apiFetch<MePrefs>("/api/auth/me")
      .then((me) => {
        setGranularity(me.dashboardGranularity ?? "month");
        setBreakdownBy(me.dashboardBreakdownBy ?? "category");
      })
      .catch(() => {})
      .finally(() => setPrefsLoaded(true));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("granularity", granularity);
      const data = await apiFetch<DashboardSummary>(`/api/dashboard/summary?${params}`);
      setSummary(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [from, to, granularity, router]);

  useEffect(() => {
    if (!prefsLoaded) return;
    load();
  }, [load, prefsLoaded]);

  async function updateGranularity(next: Granularity) {
    const prev = granularity;
    setGranularity(next);
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ dashboardGranularity: next }),
      });
    } catch {
      setGranularity(prev);
    }
  }

  async function updateBreakdownBy(next: BreakdownBy) {
    const prev = breakdownBy;
    setBreakdownBy(next);
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ dashboardBreakdownBy: next }),
      });
    } catch {
      setBreakdownBy(prev);
    }
  }

  const breakdownData =
    breakdownBy === "vendor"
      ? (summary?.byVendor.map((v, i) => ({
          id: v.fournisseur ?? t("dashboard.unknownVendor"),
          label: v.fournisseur ?? t("dashboard.unknownVendor"),
          value: v.sum,
          color: BRAND_COLORS[i % BRAND_COLORS.length],
        })) ?? [])
      : (summary?.byCategory.map((c, i) => ({
          id: c.categorie,
          label: t(`categories.${c.categorie}` as never),
          value: c.sum,
          color: BRAND_COLORS[i % BRAND_COLORS.length],
        })) ?? []);

  const lineData =
    summary && summary.byMonth.length > 0
      ? [
          {
            id: t("dashboard.expenseSeries"),
            color: "#2D6A4F",
            data: summary.byMonth.map((m) => ({ x: m.month, y: m.sum })),
          },
        ]
      : [];

  const hasBreakdown = breakdownData.length > 0;
  const hasLine = lineData.length > 0 && lineData[0].data.length > 1;

  return (
    <AppShell>
      <PageHeader title={t("nav.dashboard")} />

      {/* Date filters */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="from">{t("expenses.filters.from")}</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label htmlFor="to">{t("expenses.filters.to")}</Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
        {(from || to) && (
          <button
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="text-sm text-slate-500 hover:text-slate-800 underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t("dashboard.reset")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400 text-sm dark:text-slate-500">
          {t("dashboard.loading")}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label={t("dashboard.totalLabel")}
              value={summary ? `${fmt(summary.total)} €` : "-"}
            />
            <StatCard
              label={t("dashboard.countLabel")}
              value={summary ? String(summary.count) : "-"}
            />
            <StatCard
              label={t("dashboard.averageLabel")}
              value={summary && summary.count > 0 ? `${fmt(summary.average)} €` : "-"}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* By category / By vendor */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {breakdownBy === "vendor" ? t("dashboard.byVendor") : t("dashboard.byCategory")}
                </h2>
                <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
                  <button
                    onClick={() => updateBreakdownBy("category")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      breakdownBy === "category"
                        ? "bg-brand-500 text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {t("dashboard.byCategory")}
                  </button>
                  <button
                    onClick={() => updateBreakdownBy("vendor")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      breakdownBy === "vendor"
                        ? "bg-brand-500 text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {t("dashboard.byVendor")}
                  </button>
                </div>
              </div>
              {hasBreakdown ? (
                <div style={{ height: 280 }}>
                  <ResponsivePie
                    data={breakdownData}
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    innerRadius={0.5}
                    padAngle={1.5}
                    cornerRadius={4}
                    colors={({ data }) => data.color}
                    borderWidth={0}
                    enableArcLabels={false}
                    enableArcLinkLabels={false}
                    tooltip={({ datum }) => (
                      <div className="rounded bg-white px-3 py-2 text-xs shadow-card border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                        <span className="font-medium">{datum.label}</span>
                        {" - "}
                        {fmt(datum.value)} €
                      </div>
                    )}
                    legends={[
                      {
                        anchor: "right",
                        direction: "column",
                        justify: false,
                        translateX: 0,
                        translateY: 0,
                        itemWidth: 110,
                        itemHeight: 22,
                        itemTextColor: isDark ? "#94a3b8" : "#64748b",
                        symbolSize: 10,
                        symbolShape: "circle",
                      },
                    ]}
                  />
                </div>
              ) : (
                <p className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                  {t("dashboard.noData")}
                </p>
              )}
            </Card>

            {/* Monthly/daily trend */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {granularity === "day" ? t("dashboard.dailyTrend") : t("dashboard.monthlyTrend")}
                </h2>
                <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
                  <button
                    onClick={() => updateGranularity("month")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      granularity === "month"
                        ? "bg-brand-500 text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {t("dashboard.groupByMonth")}
                  </button>
                  <button
                    onClick={() => updateGranularity("day")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      granularity === "day"
                        ? "bg-brand-500 text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {t("dashboard.groupByDay")}
                  </button>
                </div>
              </div>
              {hasLine ? (
                <div style={{ height: 280 }}>
                  <ResponsiveLine
                    data={lineData}
                    margin={{ top: 10, right: 20, bottom: 60, left: 65 }}
                    xScale={{ type: "point" }}
                    yScale={{ type: "linear", min: 0, max: "auto" }}
                    axisBottom={{
                      tickSize: 0,
                      tickPadding: 8,
                      tickRotation: -30,
                    }}
                    axisLeft={{
                      tickSize: 0,
                      tickPadding: 8,
                      format: (v) => `${v} €`,
                    }}
                    colors={["#2D6A4F"]}
                    lineWidth={2}
                    pointSize={6}
                    pointColor={isDark ? "#0f172a" : "#fff"}
                    pointBorderWidth={2}
                    pointBorderColor="#2D6A4F"
                    enableArea
                    areaOpacity={0.08}
                    tooltip={({ point }) => (
                      <div className="rounded bg-white px-3 py-2 text-xs shadow-card border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                        <span className="font-medium">{String(point.data.x)}</span>
                        {" - "}
                        {fmt(point.data.y as number)} €
                      </div>
                    )}
                    theme={{
                      axis: {
                        ticks: { text: { fontSize: 11, fill: isDark ? "#94a3b8" : "#64748b" } },
                      },
                      grid: { line: { stroke: isDark ? "#1e293b" : "#f1f5f9" } },
                    }}
                    gridYValues={4}
                    useMesh
                  />
                </div>
              ) : (
                <p className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                  {summary && summary.byMonth.length === 1
                    ? t(granularity === "day" ? "dashboard.singleDay" : "dashboard.singleMonth")
                    : t("dashboard.noData")}
                </p>
              )}
            </Card>
          </div>

          {/* Recent exports */}
          {summary && summary.recentReports.length > 0 && (
            <Card className="mt-6 p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t("dashboard.recentExports")}
              </h2>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {summary.recentReports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{r.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {t("dashboard.expenseCount", { count: r.count })} ·{" "}
                      {new Date(r.createdAt).toLocaleDateString(getLocaleTag())}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
