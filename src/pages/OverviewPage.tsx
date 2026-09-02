import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { dashboardApi } from "../lib/resources";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/Card";
import { StatTile } from "../components/ui/StatTile";
import { Button } from "../components/ui/Button";
import { PageSpinner } from "../components/ui/Spinner";
import { ErrorState } from "../components/ui/EmptyState";
import { AlertTriangleIcon } from "../components/ui/icons";
import { TrendLineChart } from "../components/charts/TrendLineChart";
import { HorizontalBarChart } from "../components/charts/HorizontalBarChart";
import { ActivityFeed } from "../components/activity/ActivityFeed";
import { REQUEST_STATUS } from "../lib/constants";
import { formatDays, formatHours } from "../lib/format";

// This is a status field (not a nominal category), so — per the data-viz
// skill's collision rule — it wears the same reserved status/brand tokens
// as the per-item Badge elsewhere (see lib/statusStyles.ts's
// requestStatusTone: accent/good/critical/neutral), not arbitrary
// categorical slots. Keeps this chart and every request badge in sync.
const REQUEST_STATUS_COLOR: Record<number, string> = {
  [REQUEST_STATUS.PENDING]: "var(--text-muted)", // neutral — matches Badge "neutral"
  [REQUEST_STATUS.ACCEPTED]: "var(--series-1)", // brand green — matches Badge "accent"
  [REQUEST_STATUS.COMPLETED]: "var(--status-good)", // matches Badge "good"
  [REQUEST_STATUS.DENIED]: "var(--status-critical)", // matches Badge "critical"
};

const RANGE_OPTIONS = [7, 14, 30, 90];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Shared chart-card shell so every chart on the page keeps the exact same
 * header rhythm — title, one-line context, plot. */
function ChartCard({ title, sub, className, children }: { title: string; sub?: string; className?: string; children: ReactNode }) {
  return (
    <Card className={clsx("p-4", className)}>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mb-3 text-xs text-ink-muted">{sub ?? " "}</p>
      {children}
    </Card>
  );
}

/** One cell of the compact "vitals" strip — the quieter, second-tier
 * metrics that inform but don't demand a full KPI tile. Same gap-px
 * scorecard construction as DepartmentCard's stat grid. */
function VitalCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-4 py-3">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-ink">{value}</span>
      {hint ? <span className="truncate text-xs text-ink-muted">{hint}</span> : null}
    </div>
  );
}

export function OverviewPage() {
  const [days, setDays] = useState(14);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const statsQuery = useQuery({ queryKey: ["dashboard", "stats", days], queryFn: () => dashboardApi.stats(days) });
  const activityQuery = useQuery({ queryKey: ["dashboard", "activity"], queryFn: () => dashboardApi.activity(20) });
  const workloadQuery = useQuery({ queryKey: ["dashboard", "workload"], queryFn: () => dashboardApi.workload(8) });

  if (statsQuery.isLoading) return <PageSpinner />;
  if (statsQuery.isError) return <ErrorState message={(statsQuery.error as Error).message} />;

  const stats = statsQuery.data!.data;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {greeting()}
            {profile?.firstName ? `, ${profile.firstName}` : ""}
          </h1>
          <p className="text-sm text-ink-muted">{today} · Live status of requests, repairs, and custody.</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[color:var(--border-hairline)] bg-surface p-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setDays(option)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                days === option
                  ? "bg-series-1 text-white"
                  : "text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
              }`}
            >
              {option}d
            </button>
          ))}
        </div>
      </div>

      {stats.inventory.overdueMrCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-critical/30 bg-critical/10 p-3">
          <AlertTriangleIcon size={16} className="shrink-0 text-critical" />
          <p className="min-w-0 flex-1 text-sm text-critical">
            <span className="font-semibold">
              {stats.inventory.overdueMrCount} memorandum receipt{stats.inventory.overdueMrCount === 1 ? "" : "s"}
            </span>{" "}
            <span className="text-ink-secondary">overdue for return — worth a follow-up.</span>
          </p>
          <Button variant="danger" onClick={() => navigate("/inventory/mr")}>
            Review
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Open technical requests"
          value={stats.technicalRequests.byStatus.find((s) => s.statusId === REQUEST_STATUS.PENDING)?.count ?? 0}
          hint={`${stats.technicalRequests.total} total`}
          trend={stats.technicalRequests.trend.map((t) => t.count)}
          to="/requests"
        />
        <StatTile
          label="Active repair items"
          value={stats.repairItems.active}
          hint={`${stats.repairItems.total} total`}
          trend={stats.repairItems.trend.map((t) => t.count)}
          trendColor="var(--series-6)"
          to="/repairs"
        />
        <StatTile
          label="Active MRs"
          value={stats.inventory.activeMrCount}
          hint={
            stats.inventory.overdueMrCount > 0
              ? `${stats.inventory.overdueMrCount} overdue for return`
              : "None overdue for return"
          }
          to="/inventory/mr"
        />
        <StatTile
          label="Announcements"
          value={stats.announcements.total}
          hint={`${stats.announcements.broadcastCount} broadcast, ${stats.announcements.targetedCount} targeted`}
          trend={stats.announcements.trend.map((t) => t.count)}
          trendColor="var(--series-5)"
          to="/announcements"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-[color:var(--gridline)] sm:grid-cols-4">
          <VitalCell
            label="Avg. response time"
            value={formatHours(stats.technicalRequests.avgResponseHours)}
            hint={stats.technicalRequests.avgResponseHours != null ? "Created → first response" : "No responses yet"}
          />
          <VitalCell
            label="Avg. repair turnaround"
            value={formatDays(stats.repairItems.avgTurnaroundDays)}
            hint={stats.repairItems.avgTurnaroundDays != null ? "Received → released" : "No releases yet"}
          />
          <VitalCell label="Inventory items" value={String(stats.inventory.total)} hint="Computers and parts on record" />
          <VitalCell
            label="Operators / staff"
            value={String(stats.users.operators)}
            hint={`${stats.users.total} total · ${stats.users.clients} clients`}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ChartCard title={`New requests — last ${days} days`}>
              <TrendLineChart data={stats.technicalRequests.trend} />
            </ChartCard>
            <ChartCard title={`Items booked in — last ${days} days`}>
              <TrendLineChart data={stats.repairItems.trend} color="var(--series-6)" />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ChartCard title="Technical requests by status" sub="Latest status per request, all-time">
              <HorizontalBarChart
                data={stats.technicalRequests.byStatus.map((s) => ({
                  label: s.label,
                  count: s.count,
                  color: REQUEST_STATUS_COLOR[s.statusId],
                }))}
                height={140}
              />
            </ChartCard>
            <ChartCard title="Repair items by status" sub="Current status, all items">
              <HorizontalBarChart
                data={stats.repairItems.byStatus.map((s) => ({ label: s.label, count: s.count }))}
                defaultColor="var(--series-6)"
              />
            </ChartCard>
          </div>

          {stats.inventory.byStatus.length > 0 || stats.inventory.byCategory.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {stats.inventory.byStatus.length > 0 ? (
                <ChartCard title="Inventory items by status" sub="Current status, all items">
                  <HorizontalBarChart
                    data={stats.inventory.byStatus.map((s) => ({ label: s.label, count: s.count, color: s.color }))}
                  />
                </ChartCard>
              ) : null}
              {stats.inventory.byCategory.length > 0 ? (
                <ChartCard title="Inventory items by category" sub="Current breakdown, all items">
                  <HorizontalBarChart data={stats.inventory.byCategory} defaultColor="var(--series-3)" />
                </ChartCard>
              ) : null}
            </div>
          ) : null}

          {stats.technicalRequests.byDepartment.length > 0 || stats.repairItems.byOwnerDepartment.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {stats.technicalRequests.byDepartment.length > 0 ? (
                <ChartCard title="Requests by department" sub="Top departments, all-time">
                  <HorizontalBarChart data={stats.technicalRequests.byDepartment} />
                </ChartCard>
              ) : null}
              {stats.repairItems.byOwnerDepartment.length > 0 ? (
                <ChartCard title="Repair items by owner's department" sub="By the owner's assigned office, all-time">
                  <HorizontalBarChart data={stats.repairItems.byOwnerDepartment} defaultColor="var(--series-6)" />
                </ChartCard>
              ) : null}
            </div>
          ) : null}

          {workloadQuery.data && workloadQuery.data.data.length > 0 ? (
            <ChartCard title="Staff workload" sub="Requests responded to + repair items received, per operator, all-time">
              <HorizontalBarChart
                data={workloadQuery.data.data.map((w) => ({ label: w.name, count: w.total }))}
                defaultColor="var(--series-3)"
              />
            </ChartCard>
          ) : null}
        </div>

        {/* Sticky right rail on wide screens — activity stays in view while
            the charts scroll, instead of being buried at the very bottom. */}
        <div>
          <Card className="p-4 xl:sticky xl:top-0">
            <h2 className="text-sm font-semibold text-ink">Recent activity</h2>
            <p className="mb-2 text-xs text-ink-muted">Latest requests, repair items, and announcements</p>
            <div className="xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto">
              {activityQuery.isLoading ? (
                <PageSpinner />
              ) : activityQuery.isError ? (
                <ErrorState message={(activityQuery.error as Error).message} />
              ) : (
                <ActivityFeed events={activityQuery.data?.data ?? []} />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
