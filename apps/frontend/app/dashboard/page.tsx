"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, Input, Label, PageHeader } from "@/components/ui";
import { apiFetch, ApiError } from "@/lib/api";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveLine } from "@nivo/line";

type DashboardSummary = {
  total: number;
  count: number;
  average: number;
  byCategory: { categorie: string; sum: number; count: number }[];
  byMonth: { month: string; count: number; sum: number }[];
  recentReports: { id: string; name: string; createdAt: string; count: number }[];
};

const BRAND_COLORS = [
  "#2D6A4F",
  "#40916C",
  "#52B788",
  "#74C69D",
  "#95D5B2",
  "#B7E4C7",
  "#D8F3DC",
];

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await apiFetch<DashboardSummary>(`/api/dashboard/summary?${params}`);
      setSummary(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [from, to, router]);

  useEffect(() => {
    load();
  }, [load]);

  const pieData =
    summary?.byCategory.map((c, i) => ({
      id: c.categorie,
      label: c.categorie,
      value: c.sum,
      color: BRAND_COLORS[i % BRAND_COLORS.length],
    })) ?? [];

  const lineData =
    summary && summary.byMonth.length > 0
      ? [
          {
            id: "Dépenses",
            color: "#2D6A4F",
            data: summary.byMonth.map((m) => ({ x: m.month, y: m.sum })),
          },
        ]
      : [];

  const hasBar = pieData.length > 0;
  const hasLine = lineData.length > 0 && lineData[0].data.length > 1;

  return (
    <AppShell>
      <PageHeader title="Tableau de bord" />

      {/* Filtres */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="from">Du</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label htmlFor="to">Au</Label>
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
            onClick={() => { setFrom(""); setTo(""); }}
            className="text-sm text-slate-500 hover:text-slate-800 underline"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400 text-sm">
          Chargement…
        </div>
      ) : (
        <>
          {/* Cartes synthèse */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total TTC (€)"
              value={summary ? `${fmt(summary.total)} €` : "—"}
            />
            <StatCard
              label="Nombre de dépenses"
              value={summary ? String(summary.count) : "—"}
            />
            <StatCard
              label="Moyenne par dépense"
              value={summary && summary.count > 0 ? `${fmt(summary.average)} €` : "—"}
            />
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Répartition par catégorie */}
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">
                Répartition par catégorie
              </h2>
              {hasBar ? (
                <div style={{ height: 280 }}>
                  <ResponsivePie
                    data={pieData}
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    innerRadius={0.5}
                    padAngle={1.5}
                    cornerRadius={4}
                    colors={({ data }) => data.color}
                    borderWidth={0}
                    enableArcLabels={false}
                    enableArcLinkLabels={false}
                    tooltip={({ datum }) => (
                      <div className="rounded bg-white px-3 py-2 text-xs shadow-card border border-slate-100">
                        <span className="font-medium">{datum.label}</span>
                        {" — "}
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
                        itemTextColor: "#64748b",
                        symbolSize: 10,
                        symbolShape: "circle",
                      },
                    ]}
                  />
                </div>
              ) : (
                <p className="flex h-48 items-center justify-center text-sm text-slate-400">
                  Aucune donnée
                </p>
              )}
            </Card>

            {/* Évolution mensuelle */}
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">
                Évolution mensuelle
              </h2>
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
                    pointColor="#fff"
                    pointBorderWidth={2}
                    pointBorderColor="#2D6A4F"
                    enableArea
                    areaOpacity={0.08}
                    tooltip={({ point }) => (
                      <div className="rounded bg-white px-3 py-2 text-xs shadow-card border border-slate-100">
                        <span className="font-medium">{String(point.data.x)}</span>
                        {" — "}
                        {fmt(point.data.y as number)} €
                      </div>
                    )}
                    theme={{
                      axis: { ticks: { text: { fontSize: 11, fill: "#64748b" } } },
                      grid: { line: { stroke: "#f1f5f9" } },
                    }}
                    gridYValues={4}
                    useMesh
                  />
                </div>
              ) : (
                <p className="flex h-48 items-center justify-center text-sm text-slate-400">
                  {summary && summary.byMonth.length === 1
                    ? "Un seul mois — le graphique nécessite au moins 2 points"
                    : "Aucune donnée"}
                </p>
              )}
            </Card>
          </div>

          {/* Exports récents */}
          {summary && summary.recentReports.length > 0 && (
            <Card className="mt-6 p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Exports récents</h2>
              <ul className="divide-y divide-slate-100">
                {summary.recentReports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-slate-700">{r.name}</span>
                    <span className="text-xs text-slate-400">
                      {r.count} dépense{r.count > 1 ? "s" : ""} ·{" "}
                      {new Date(r.createdAt).toLocaleDateString("fr-FR")}
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
