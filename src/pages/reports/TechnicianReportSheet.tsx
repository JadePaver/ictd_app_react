import type { ComponentType, ReactNode } from "react";
import clsx from "clsx";
import { Card } from "../../components/ui/Card";
import { StatTile } from "../../components/ui/StatTile";
import { Avatar } from "../../components/ui/Avatar";
import { EmptyState } from "../../components/ui/EmptyState";
import { HorizontalBarChart } from "../../components/charts/HorizontalBarChart";
import { StackedBarChart, StackLegend, type StackDatum } from "../../components/charts/StackedBarChart";
import { CompositionBar } from "../../components/charts/CompositionBar";
import {
  AwardIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  InboxIcon,
  PlayCircleIcon,
  TimerIcon,
  TrendDownIcon,
  TrendUpIcon,
  XCircleIcon,
} from "../../components/ui/icons";
import { formatDate, formatDateTime, formatDays, formatHours, formatRelativeDateTime } from "../../lib/format";
import {
  OUTCOME_STYLES,
  STREAM_ICONS,
  WORK_STREAMS,
  completionRate,
  formatDelta,
  formatPercent,
  metricGroups,
  ordinal,
  periodRangeLabel,
  requestTypeIcon,
} from "./reportMetrics";
import ictdSeal from "../../assets/ictd-seal.png";
import type { RequestTypeBreakdown, TechnicianRanking, TechnicianReport } from "../../types/api";

/* ---------------------------------------------------------------------
   Print geometry for the charts, in CSS pixels.

   Recharts sizes its SVG in JavaScript, measuring the box the chart sits in
   on screen. The print layout is never visible to that measurement: the
   browser swaps to it inside its own print render, `beforeprint` still
   reports screen geometry, and a ResizeObserver gets no frame to fire in
   before the page is snapshotted. A responsive chart therefore goes to
   paper at whatever width the window happened to be: a 718px-wide plot
   drawn into a 430px column, painting straight over the cards beside it.

   So the two real charts are rendered twice: the responsive one for screen,
   and a `print-only` copy pinned to the width its column actually has on
   A4. The numbers below are that width, derived from index.css's print
   block rather than eyeballed, so the two files move together.

   A4 is 210mm wide; the `@page` margin is 14mm a side, leaving 182mm, or
   688px at 96dpi. Print root font-size is 12.5px, so `print:gap-2` is
   6.25px and a card's `px-4` is 12.5px a side.
   --------------------------------------------------------------------- */
const PRINT_SHEET_WIDTH = 688;
const PRINT_GAP = 6.25;
/** A card's 1px border plus its body padding, both sides. */
const PRINT_CARD_INSET = 2 + 2 * 12.5;

/** Two columns of `print:grid-cols-3`: the trend plot. */
const PRINT_TREND_WIDTH = Math.round(
  ((PRINT_SHEET_WIDTH - 2 * PRINT_GAP) / 3) * 2 + PRINT_GAP - PRINT_CARD_INSET,
);
/** Tall enough to match the mix-and-pace stack beside it, so neither column
 *  strands whitespace. */
const PRINT_TREND_HEIGHT = 250;

/** One column of `print:grid-cols-2`: the department bars. */
const PRINT_HALF_WIDTH = Math.round((PRINT_SHEET_WIDTH - PRINT_GAP) / 2 - PRINT_CARD_INSET);

/** Shared card shell: title, one line of context, then the content. */
function Panel({
  title,
  icon: Icon,
  sub,
  aside,
  className,
  bodyClassName,
  keepTogether = true,
  children,
}: {
  title: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  sub?: string;
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Panels avoid splitting across printed pages by default. Opt out for a
   *  plain list, where a split reads fine and keeping it whole only strands
   *  whitespace. */
  keepTogether?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className={clsx(keepTogether && "print-block", "flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 pt-4 pb-3 print:pt-2.5 print:pb-1.5">
        <div className="flex min-w-0 items-start gap-2">
          {Icon ? <Icon size={15} className="mt-0.5 shrink-0 text-ink-muted" /> : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {sub ? <p className="text-xs text-ink-muted">{sub}</p> : null}
          </div>
        </div>
        {aside}
      </div>
      <div className={clsx("flex flex-1 flex-col px-4 pb-4 print:pb-2.5", bodyClassName)}>{children}</div>
    </Card>
  );
}

/**
 * Where this technician's volume sits against the team, drawn as the
 * "emphasis" form: their bar in the brand hue, the two context bars in the
 * de-emphasis gray, so the eye lands on the one row that is the point.
 */
function StandingBars({ ranking, mine }: { ranking: TechnicianRanking; mine: number }) {
  const rows = [
    { label: "This technician", value: mine, emphasis: true },
    { label: "Team average", value: Math.round(ranking.teamAverage * 10) / 10, emphasis: false },
    { label: "Top technician", value: ranking.leaderTotal, emphasis: false },
  ];
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className={clsx("w-28 shrink-0 text-xs", row.emphasis ? "font-medium text-ink" : "text-ink-muted")}>
            {row.label}
          </span>
          <div className="h-2 min-w-0 flex-1 rounded-full bg-black/[0.05] dark:bg-white/[0.07]">
            <div
              className="h-full rounded-full"
              style={{
                // Zero stays zero-width: a minimum stub would draw a value
                // that isn't there.
                width: `${(row.value / max) * 100}%`,
                backgroundColor: row.emphasis ? "var(--series-1)" : "var(--baseline)",
              }}
            />
          </div>
          <span
            className={clsx("w-10 shrink-0 text-right text-xs tabular-nums", row.emphasis ? "text-ink" : "text-ink-muted")}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** One line of a timing panel: this period's figure with last period's beside it. */
function PaceRow({
  icon: Icon,
  label,
  hint,
  value,
  previous,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  hint: string;
  value: string;
  previous: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[color:var(--gridline)] py-2.5 first:pt-0 last:border-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon size={15} className="mt-0.5 shrink-0 text-ink-muted" />
        <div className="min-w-0">
          <p className="text-sm text-ink">{label}</p>
          <p className="text-xs text-ink-muted">{hint}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-ink">{value}</p>
        {previous ? <p className="text-xs whitespace-nowrap text-ink-muted">was {previous}</p> : null}
      </div>
    </div>
  );
}

/** One outcome tile: icon, count, label. Never colour alone. */
function OutcomeTile({
  icon: Icon,
  tone,
  count,
  label,
  hint,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  tone: string;
  count: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-surface px-4 py-3 print:py-2">
      <Icon size={20} className={clsx("shrink-0", tone)} />
      <div className="min-w-0">
        <p className="text-xl leading-tight font-semibold text-ink">{count}</p>
        <p className="truncate text-xs text-ink-secondary">{label}</p>
        {hint ? <p className="truncate text-xs text-ink-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

/**
 * Per request type: what came in, how much of it they closed, and how long
 * each type took them. This is the table that answers "what kind of work is
 * this person actually doing", which a bare count of requests cannot.
 */
function RequestTypeTable({
  types,
  previousTypes,
}: {
  types: RequestTypeBreakdown[];
  previousTypes: RequestTypeBreakdown[] | null;
}) {
  const maxHandled = Math.max(...types.map((t) => t.handled), 1);
  const totals = types.reduce(
    (acc, type) => ({
      handled: acc.handled + type.handled,
      completed: acc.completed + type.completed,
      denied: acc.denied + type.denied,
    }),
    { handled: 0, completed: 0, denied: 0 },
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <caption className="sr-only">
          Technical requests by type: how many were handled, completed and denied, and the average time to complete
          each type.
        </caption>
        <thead>
          <tr className="border-b border-[color:var(--gridline)] text-xs text-ink-muted">
            <th scope="col" className="py-2 pr-3 font-medium">
              Type
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Handled
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Completed
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Denied
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">
              Avg. time
            </th>
          </tr>
        </thead>
        <tbody>
          {types.map((type) => {
            const Icon = requestTypeIcon(type.label);
            const before = previousTypes?.find((t) => t.label === type.label) ?? null;
            return (
              <tr key={type.label} className="border-b border-[color:var(--gridline)] last:border-0">
                <th scope="row" className="py-2.5 pr-3 font-normal">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-series-1/10 text-series-1">
                      <Icon size={15} />
                    </span>
                    <span className="truncate text-ink">{type.label}</span>
                  </div>
                </th>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-medium tabular-nums text-ink">{type.handled}</span>
                  {/* The share bar rides under the number it belongs to, not
                      under the type name, where it read as an underline. */}
                  <span className="mt-1 ml-auto block h-1 w-14 rounded-full bg-black/[0.05] dark:bg-white/[0.07]">
                    <span
                      className="block h-full rounded-full bg-series-1"
                      style={{ width: `${(type.handled / maxHandled) * 100}%` }}
                    />
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right align-top">
                  <span className="tabular-nums text-ink">{type.completed}</span>
                  <span className="block text-xs tabular-nums text-ink-muted">
                    {type.handled > 0 ? `${Math.round((type.completed / type.handled) * 100)}%` : "—"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right align-top tabular-nums text-ink-secondary">{type.denied}</td>
                <td className="py-2.5 pl-3 text-right align-top">
                  <span className="tabular-nums text-ink">{formatHours(type.avgResolutionHours)}</span>
                  {before ? (
                    <span className="block text-xs whitespace-nowrap text-ink-muted">
                      was {formatHours(before.avgResolutionHours)}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
        {/* Totals so a reader can check this table against the headline tiles
            rather than taking it on faith. They reconcile by construction:
            both sides count the same window-scoped activity. */}
        <tfoot>
          <tr className="border-t border-[color:var(--baseline)] text-sm">
            <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
              Total
            </th>
            <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{totals.handled}</td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{totals.completed}</td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{totals.denied}</td>
            <td className="py-2 pl-3 text-right text-xs text-ink-muted">across all types</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Signed change against the previous period. Volume going up is good here. */
function DeltaChip({ delta, previousLabel }: { delta: number; previousLabel: string }) {
  if (delta === 0) {
    return <span className="text-sm text-ink-muted">No change vs {previousLabel}</span>;
  }
  const up = delta > 0;
  const Icon = up ? TrendUpIcon : TrendDownIcon;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-sm", up ? "text-good" : "text-ink-secondary")}>
      <Icon size={14} />
      <span className="font-medium">{formatDelta(delta)}</span>
      <span className="text-ink-muted">vs {previousLabel}</span>
    </span>
  );
}

/**
 * The report itself: everything from the letterhead down to the signature
 * lines. Deliberately free of controls, because the page around it owns the
 * pickers and the export buttons, so what's on screen here is exactly what
 * comes out of the printer.
 */
export function TechnicianReportSheet({ report, generatedBy }: { report: TechnicianReport; generatedBy?: string | null }) {
  const { technician, period, summary, previous, ranking, breakdowns, trend, highlights } = report;
  const departmentLabel = technician.departments.map((d) => d.code ?? d.label).filter(Boolean).join(", ");
  const groups = metricGroups(report);
  const showComparison = previous != null && period.previousLabel != null;
  const rate = completionRate(summary);

  const trendData: StackDatum[] = trend.map((point) => ({
    key: point.key,
    label: point.label,
    requests: point.requests,
    repairs: point.repairs,
    announcements: point.announcements,
    total: point.total,
  }));

  const mixSegments = WORK_STREAMS.map((stream) => ({
    ...stream,
    count: breakdowns.workMix.find((entry) => entry.key === stream.key)?.count ?? 0,
  }));

  const trendTooltipLabel = (datum: StackDatum) =>
    period.granularity === "day"
      ? formatDate(datum.key)
      : new Date(`${datum.key}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="print-sheet flex flex-col gap-4 print:gap-2">
      {/* Letterhead, only on paper. On screen the app chrome already says
          where you are, and a second masthead would just be noise. */}
      <header className="print-only mb-1 border-b-2 border-[color:var(--text-primary)] pb-2">
        <div className="flex items-center gap-3">
          <img src={ictdSeal} alt="" className="h-10 w-10" />
          <div className="flex-1">
            <p className="text-[12px] font-semibold tracking-[0.08em] text-ink uppercase">
              Information &amp; Communications Technology Division
            </p>
            {/* The document's own h1. The page's heading is `no-print`, so
                without this the printed sheet has no top-level heading at
                all, and the panels below start the outline at h2. */}
            <h1 className="text-[10px] tracking-[0.06em] text-ink-secondary uppercase">Technician Performance Report</h1>
          </div>
          <p className="text-[10px] text-ink-muted">{period.label}</p>
        </div>
      </header>

      {/* Identity, period, headline number, and standing in one block, so
          the first page always carries the whole summary even if the charts
          break across pages. */}
      <Card className="print-block overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--gridline)] p-5 print:p-3.5">
          <div className="flex min-w-0 items-center gap-3.5">
            {/* Avatar reads the DB's snake_case person shape; the report API
                returns camelCase, so map rather than pass it straight in
                (which silently renders a "?" initial). */}
            <Avatar person={{ first_name: technician.firstName, last_name: technician.lastName }} size={52} />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink">{technician.name}</p>
              <p className="truncate text-sm text-ink-secondary">
                {[technician.roleLabel, departmentLabel].filter(Boolean).join(" · ") || "No role on record"}
              </p>
              {technician.username ? <p className="truncate text-xs text-ink-muted">{technician.username}</p> : null}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-semibold tracking-wider text-ink-muted uppercase">Reporting period</p>
            <p className="text-lg font-semibold text-ink">{period.label}</p>
            <p className="text-xs text-ink-muted">{periodRangeLabel(report)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px bg-[color:var(--gridline)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] print:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col justify-center gap-1 bg-surface p-5 print:p-3.5">
            {/* The one hero figure on this view. Proportional figures, not
                tabular: equal-width digits read loose at display size. */}
            <span className="text-5xl leading-none font-semibold text-ink">{summary.totalActions}</span>
            <span className="text-sm text-ink-secondary">
              action{summary.totalActions === 1 ? "" : "s"} recorded
              {period.key === "all" ? " in total" : ` in ${period.label}`}
            </span>
            {showComparison ? (
              <div className="mt-1">
                <DeltaChip delta={summary.totalActions - previous!.totalActions} previousLabel={period.previousLabel!} />
              </div>
            ) : null}
            <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
              <CalendarIcon size={14} className="shrink-0" />
              Across {summary.activeDays} active day{summary.activeDays === 1 ? "" : "s"}
              {summary.busiestDay ? `, busiest ${formatDate(summary.busiestDay.date)}` : ""}
            </span>
          </div>

          <div className="flex flex-col justify-center gap-3 bg-surface p-5 print:p-3.5">
            {ranking ? (
              <>
                <div className="flex items-center gap-2">
                  <AwardIcon size={15} className="shrink-0 text-ink-muted" />
                  <p className="text-sm text-ink">
                    <span className="font-semibold">{ordinal(ranking.rank)}</span>
                    <span className="text-ink-secondary">
                      {" "}
                      of {ranking.peerCount} technician{ranking.peerCount === 1 ? "" : "s"} · {ordinal(ranking.percentile)}{" "}
                      percentile
                    </span>
                  </p>
                </div>
                <StandingBars ranking={ranking} mine={summary.totalActions} />
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <AwardIcon size={15} className="shrink-0" />
                <span>No team activity recorded in this period, so there is nothing to rank against.</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
        <StatTile
          label="Requests handled"
          value={summary.requestsHandled}
          hint={`${summary.requestUpdates} status update${summary.requestUpdates === 1 ? "" : "s"} logged`}
          trend={trend.map((point) => point.requests)}
        />
        <StatTile
          label="Requests completed"
          value={summary.requestsCompleted}
          hint={rate != null ? `${formatPercent(rate)} of what they handled` : "Nothing handled yet"}
        />
        <StatTile
          label="Avg. time to complete"
          value={0}
          displayValue={formatHours(summary.avgResolutionHours)}
          hint={
            summary.fastestResolutionHours != null && summary.slowestResolutionHours != null
              ? `${formatHours(summary.fastestResolutionHours)} to ${formatHours(summary.slowestResolutionHours)}`
              : "No completions in this period"
          }
        />
        <StatTile
          label="Repair items worked on"
          value={summary.repairItemsTouched}
          hint={`${summary.repairsReceived} booked in · ${summary.repairsReleased} released`}
          trend={trend.map((point) => point.repairs)}
          trendColor="var(--series-3)"
        />
      </div>

      {/* Outcomes: what happened to the requests, stated with an icon and a
          word rather than a colour alone. */}
      <Card className="print-block overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-[color:var(--gridline)] lg:grid-cols-4 print:grid-cols-4">
          <OutcomeTile
            icon={PlayCircleIcon}
            tone="text-series-1"
            count={summary.requestsAccepted}
            label="Accepted"
            hint="Picked up and started"
          />
          <OutcomeTile
            icon={CheckCircleIcon}
            tone="text-good"
            count={summary.requestsCompleted}
            label="Completed"
            hint={rate != null ? `${formatPercent(rate)} completion rate` : undefined}
          />
          <OutcomeTile
            icon={XCircleIcon}
            tone="text-critical"
            count={summary.requestsDenied}
            label="Denied"
            hint="Closed without work"
          />
          <OutcomeTile
            icon={ClockIcon}
            tone="text-ink-secondary"
            count={summary.firstResponses}
            label="Answered first"
            hint="Before any colleague"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 print:grid-cols-3 print:gap-2">
        <Panel
          title="Work over time"
          sub={period.granularity === "day" ? "By day, across the month" : "By month"}
          aside={<StackLegend series={WORK_STREAMS} />}
          className="xl:col-span-2 print:col-span-2"
        >
          {summary.totalActions > 0 ? (
            // On screen: grows to whatever height the row settles at (the
            // mix and pace stack next door is taller), with a floor so the
            // plot never collapses below a readable size. On paper: a fixed
            // box, for the reason set out at the top of this file.
            // `role="img"` with a spoken summary: the plot itself is an
            // unlabelled SVG, and the per-bucket values live in the CSV
            // export rather than on the sheet.
            <>
              <div
                role="img"
                aria-label={`Activity over ${period.label}, ${
                  period.granularity === "day" ? "by day" : "by month"
                }. ${summary.totalActions} actions in total: ${summary.requestUpdates} request updates, ${
                  summary.repairUpdates
                } repair updates, ${summary.announcementsPosted} announcements, across ${summary.activeDays} active days.`}
                className="no-print min-h-[220px] flex-1"
              >
                <StackedBarChart data={trendData} series={WORK_STREAMS} height="100%" labelFor={trendTooltipLabel} />
              </div>
              {/* The same plot at the width this column has on paper. The
                  screen copy carries the spoken summary; this one is a
                  duplicate, so it stays out of the accessibility tree. */}
              <div aria-hidden="true" className="print-only">
                <StackedBarChart
                  data={trendData}
                  series={WORK_STREAMS}
                  width={PRINT_TREND_WIDTH}
                  height={PRINT_TREND_HEIGHT}
                  labelFor={trendTooltipLabel}
                />
              </div>
            </>
          ) : (
            <EmptyState title="Nothing recorded in this period" hint="Try a wider period, or check another technician." />
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title="Work mix"
            sub={`How ${summary.totalActions} action${summary.totalActions === 1 ? "" : "s"} split across the modules`}
          >
            <CompositionBar segments={mixSegments} icons={STREAM_ICONS} />
          </Panel>

          {/* Volume alone doesn't describe a technician. These are the speed
              measures, scoped to this person, with last period beside them. */}
          <Panel title="Time per task" icon={TimerIcon} sub="How fast the work moved, not just how much">
            <div className="flex flex-col">
              <PaceRow
                icon={ClockIcon}
                label="Avg. first response"
                hint="Raised to first reply"
                value={formatHours(summary.avgFirstResponseHours)}
                previous={previous ? formatHours(previous.avgFirstResponseHours) : null}
              />
              <PaceRow
                icon={TimerIcon}
                label="Avg. time to complete"
                hint="Raised to completion"
                value={formatHours(summary.avgResolutionHours)}
                previous={previous ? formatHours(previous.avgResolutionHours) : null}
              />
              <PaceRow
                icon={STREAM_ICONS.repairs}
                label="Avg. repair turnaround"
                hint="Received to released"
                value={formatDays(summary.avgRepairTurnaroundDays)}
                previous={previous ? formatDays(previous.avgRepairTurnaroundDays) : null}
              />
            </div>
          </Panel>
        </div>
      </div>

      {breakdowns.requestTypes.length > 0 ? (
        <Panel
          title="Requests by type"
          sub="What kind of work came in, how much of it they closed, and how long each kind took"
        >
          <RequestTypeTable types={breakdowns.requestTypes} previousTypes={breakdowns.previousRequestTypes} />
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-2">
        {breakdowns.requestsByDepartment.length > 0 ? (
          <Panel title="Requests by department" sub="Where the work came from">
            <div
              role="img"
              aria-label={`Requests by department: ${breakdowns.requestsByDepartment
                .map((entry) => `${entry.label}, ${entry.count}`)
                .join("; ")}.`}
              className="no-print"
            >
              <HorizontalBarChart data={breakdowns.requestsByDepartment} />
            </div>
            <div aria-hidden="true" className="print-only">
              <HorizontalBarChart data={breakdowns.requestsByDepartment} width={PRINT_HALF_WIDTH} />
            </div>
          </Panel>
        ) : null}

        {breakdowns.repairStages.length > 0 ? (
          <Panel title="Repair stages" sub="Every stage they moved an item through, in pipeline order">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Repair stages this technician moved items through, with the number of updates logged and distinct items
                that reached each stage.
              </caption>
              <thead>
                <tr className="border-b border-[color:var(--gridline)] text-xs text-ink-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Stage
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Updates
                  </th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">
                    Items
                  </th>
                </tr>
              </thead>
              <tbody>
                {breakdowns.repairStages.map((stage) => (
                  <tr key={stage.statusId} className="border-b border-[color:var(--gridline)] last:border-0">
                    <th scope="row" className="py-2 pr-3 font-normal">
                      <span className="flex items-center gap-2">
                        {/* The stage's own colour from `repair_statuses`, as a
                            dot beside the name rather than colouring the text. */}
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                        <span className="truncate text-ink">{stage.label}</span>
                      </span>
                    </th>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">{stage.updates}</td>
                    <td className="py-2 pl-3 text-right tabular-nums text-ink-secondary">{stage.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ) : null}
      </div>

      {/* Not kept together: it is a plain list, so letting it flow across a
          page boundary fills the sheet properly instead of stranding the
          signature block alone on a page of its own. Individual rows still
          stay whole (see the `li` rule in index.css). */}
      <Panel title="Recent work" sub={`The newest recorded actions in ${period.label}`} keepTogether={false}>
        {highlights.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">No recorded actions in this period.</p>
        ) : (
          <ul className="flex flex-col">
            {highlights.map((highlight, index) => {
              const outcome = OUTCOME_STYLES[highlight.outcome];
              const Icon = outcome.icon;
              const StreamIcon = STREAM_ICONS[highlight.kind === "request" ? "requests" : highlight.kind === "repair" ? "repairs" : "announcements"];
              return (
                <li
                  key={`${highlight.kind}-${highlight.at}-${index}`}
                  className="flex items-center gap-3 border-b border-[color:var(--gridline)] py-2.5 last:border-0"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
                    <StreamIcon size={15} className="text-ink-secondary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{highlight.title}</span>
                    <span className="block truncate text-xs text-ink-muted">{highlight.subtitle}</span>
                  </span>
                  {/* Outcome as icon plus word: the mark speeds up scanning,
                      the word is what actually carries the meaning. */}
                  <span className={clsx("hidden shrink-0 items-center gap-1.5 text-xs sm:flex", outcome.tone)}>
                    <Icon size={14} />
                    {outcome.label}
                  </span>
                  <span className="min-w-[6rem] shrink-0 text-right text-xs whitespace-nowrap text-ink-muted">
                    {formatRelativeDateTime(highlight.at)}
                    {highlight.elapsedHours != null ? (
                      <span className="block">after {formatHours(highlight.elapsedHours)}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* The table twin: every number above, reachable without reading a
          chart, and the part that survives a black-and-white printer.

          Deliberately NOT `print-block`. At around 950px it is just under a
          full page, so keeping it whole made the printer skip to a fresh
          sheet and leave 400px of the previous one blank. It is built to
          split instead: the header repeats on the next page and each metric
          group is kept together on its own. */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[color:var(--gridline)] px-4 py-3 print:py-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">Full metric breakdown</h2>
            <p className="text-xs text-ink-muted">Every figure behind the charts above</p>
          </div>
          {showComparison ? <p className="text-xs text-ink-muted">Compared against {period.previousLabel}</p> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">
              Every figure in this report{showComparison ? `, alongside ${period.previousLabel} and the change` : ""}.
            </caption>
            <thead>
              <tr className="border-b border-[color:var(--gridline)] text-xs text-ink-muted">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Metric
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  {period.label}
                </th>
                {showComparison ? (
                  <>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      {period.previousLabel}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      Change
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            {/* One <tbody> per group: the valid way to band a table into
                sections, and it keeps a group from splitting across pages. */}
            {groups.map((group) => (
              <tbody key={group.title} className="print-block">
                <tr className="bg-black/[0.02] dark:bg-white/[0.03]">
                  <th
                    scope="colgroup"
                    colSpan={showComparison ? 4 : 2}
                    className="px-4 py-1.5 text-left text-[10px] font-semibold tracking-wider text-ink-muted uppercase"
                  >
                    {group.title}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="border-b border-[color:var(--gridline)] last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <span className="text-ink">{row.label}</span>
                      {row.hint ? <span className="block text-xs text-ink-muted">{row.hint}</span> : null}
                    </th>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-ink">{row.value}</td>
                    {showComparison ? (
                      <>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink-muted">{row.previous ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink-secondary">
                          {row.delta == null ? "—" : formatDelta(row.delta)}
                        </td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="border-t border-[color:var(--gridline)] px-4 py-2.5 text-xs text-ink-muted">
          “Actions recorded” counts request status updates, repair log entries, and announcements published. Items booked
          in and released are listed separately because each already writes a repair log entry, and counting both would
          double-count one piece of work. Inventory and custody bookkeeping is reported under Inventory, not here.
        </p>
      </Card>

      {/* Signature lines and provenance. A printed record is only worth
          something if it can be signed and dated. */}
      <div className="print-only print-block pt-4 print:pt-2">
        <div className="flex justify-between gap-16 pt-8 print:pt-5">
          <div className="flex-1 text-center">
            <p className="border-t border-[color:var(--text-primary)] pt-1.5 text-xs font-semibold text-ink">
              {technician.name}
            </p>
            <p className="text-[10px] tracking-wider text-ink-muted uppercase">Technician</p>
          </div>
          <div className="flex-1 text-center">
            <p className="border-t border-[color:var(--text-primary)] pt-1.5 text-xs font-semibold text-ink">&nbsp;</p>
            <p className="text-[10px] tracking-wider text-ink-muted uppercase">Immediate supervisor</p>
          </div>
        </div>
        <p className="mt-6 text-center text-[10px] text-ink-muted print:mt-4">
          Generated {formatDateTime(report.generatedAt)}
          {generatedBy ? ` by ${generatedBy}` : ""} from the ICTD App admin dashboard. Figures are derived from recorded
          system activity.
        </p>
      </div>
    </div>
  );
}

/** Compact "no technician selected yet" placeholder for the page shell. */
export function ReportPlaceholder() {
  return (
    <Card className="p-0">
      <EmptyState
        icon={InboxIcon}
        title="Choose a technician to build a report"
        hint="Pick someone from the list above, then set the period you want to cover."
      />
    </Card>
  );
}
