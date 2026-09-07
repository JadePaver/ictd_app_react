import type { ComponentType } from "react";
import type { StackSeries } from "../../components/charts/StackedBarChart";
import {
  AppWindowIcon,
  CheckCircleIcon,
  KeyIcon,
  LifebuoyIcon,
  MegaphoneIcon,
  MonitorIcon,
  PlayCircleIcon,
  PrintIcon,
  TicketIcon,
  WifiIcon,
  WrenchIcon,
  XCircleIcon,
} from "../../components/ui/icons";
import { formatDate, formatDays, formatHours } from "../../lib/format";
import type { ReportOutcome, TechnicianReport, TechnicianSummary } from "../../types/api";

type Icon = ComponentType<{ size?: number; className?: string }>;

/**
 * The three work streams, in the order they stack.
 *
 * Repair items wear **orange**, not the teal they used to. Teal against the
 * brand green fails the data-viz normal-vision separation check (ΔE 13.3,
 * below the floor of 15), and unlike the earlier four-stream version there
 * is no third hue left to sit between them: with three series, one of which
 * is often zero, green and teal end up touching whatever the stack order.
 * That check is a hard fail the skill says secondary encoding does not
 * excuse, so the hue was re-stepped rather than worked around. Orange clears
 * every check in both modes with room to spare (worst normal-vision ΔE 26.0,
 * worst CVD ΔE 8.6). ActivityFeed and OverviewPage moved with it, so repair
 * items read orange everywhere in the dashboard, not just here.
 */
export const WORK_STREAMS: StackSeries[] = [
  { key: "requests", label: "Technical requests", color: "var(--series-1)" },
  { key: "repairs", label: "Repair items", color: "var(--series-3)" },
  { key: "announcements", label: "Announcements", color: "var(--series-5)" },
];

export const STREAM_ICONS: Record<string, Icon> = {
  requests: TicketIcon,
  repairs: WrenchIcon,
  announcements: MegaphoneIcon,
};

/**
 * Icon for a `request_types.label`, matched on keyword rather than id.
 *
 * The table holds two rows today (Software, Hardware) but it is ordinary
 * reference data an administrator can add to, and ids are DB-generated. A
 * keyword match means a new "Network access" row picks up a sensible mark on
 * its own, and anything unrecognized still renders something deliberate
 * instead of a blank column.
 */
const REQUEST_TYPE_ICON_RULES: { match: RegExp; icon: Icon }[] = [
  { match: /hardware|device|computer|laptop|desktop|monitor|peripheral/i, icon: MonitorIcon },
  { match: /software|application|app|system|program|install/i, icon: AppWindowIcon },
  { match: /network|internet|wifi|wi-fi|connection|lan|connectivity/i, icon: WifiIcon },
  { match: /account|access|password|login|credential|permission/i, icon: KeyIcon },
  { match: /print|scanner|copier/i, icon: PrintIcon },
];

export function requestTypeIcon(label: string): Icon {
  return REQUEST_TYPE_ICON_RULES.find((rule) => rule.match.test(label))?.icon ?? LifebuoyIcon;
}

/**
 * Outcome vocabulary shared by the recent-work list and the outcome tiles.
 * Every use pairs the icon with its label, so the mark reinforces the state
 * rather than being the only thing carrying it.
 */
export const OUTCOME_STYLES: Record<ReportOutcome, { icon: Icon; label: string; tone: string }> = {
  completed: { icon: CheckCircleIcon, label: "Completed", tone: "text-good" },
  accepted: { icon: PlayCircleIcon, label: "Accepted", tone: "text-series-1" },
  denied: { icon: XCircleIcon, label: "Denied", tone: "text-critical" },
  released: { icon: CheckCircleIcon, label: "Released", tone: "text-good" },
  received: { icon: WrenchIcon, label: "Booked in", tone: "text-series-3" },
  published: { icon: MegaphoneIcon, label: "Published", tone: "text-series-5" },
  updated: { icon: TicketIcon, label: "Updated", tone: "text-ink-muted" },
};

export interface MetricRow {
  label: string;
  value: string;
  /** Same metric over the previous period; null on the all-time report. */
  previous: string | null;
  /** Signed change, for count metrics only. Null where a delta is meaningless. */
  delta: number | null;
  hint?: string;
}

export interface MetricGroup {
  title: string;
  rows: MetricRow[];
}

type CountKey = {
  [K in keyof TechnicianSummary]: TechnicianSummary[K] extends number ? K : never;
}[keyof TechnicianSummary];

/**
 * The report's full metric table: the accessible, printable twin of every
 * chart on the page, and the single source the CSV export reads so a
 * downloaded file can never disagree with the sheet it came from.
 */
export function metricGroups(report: TechnicianReport): MetricGroup[] {
  const { summary, previous } = report;

  const count = (label: string, key: CountKey, hint?: string): MetricRow => {
    const value = summary[key];
    const before = previous ? previous[key] : null;
    return {
      label,
      value: String(value),
      previous: before == null ? null : String(before),
      delta: before == null ? null : value - before,
      hint,
    };
  };

  const duration = (
    label: string,
    key: "avgFirstResponseHours" | "avgResolutionHours" | "slowestResolutionHours" | "fastestResolutionHours" | "avgRepairTurnaroundDays",
    format: (value: number | null) => string,
    hint?: string,
  ): MetricRow => ({
    label,
    value: format(summary[key]),
    previous: previous ? format(previous[key]) : null,
    // Deliberately no delta: an average over 2 samples against one over 40
    // is not a change worth signing.
    delta: null,
    hint,
  });

  return [
    {
      title: "Overall",
      rows: [
        count("Actions recorded", "totalActions", "Request updates, repair log entries, and announcements"),
        count("Active days", "activeDays", "Days with at least one recorded action"),
        {
          label: "Busiest day",
          value: summary.busiestDay ? `${formatDate(summary.busiestDay.date)} (${summary.busiestDay.count})` : "—",
          previous: previous?.busiestDay ? `${formatDate(previous.busiestDay.date)} (${previous.busiestDay.count})` : null,
          delta: null,
        },
      ],
    },
    {
      title: "Technical requests",
      rows: [
        count("Status updates logged", "requestUpdates"),
        count("Requests handled", "requestsHandled", "Distinct requests touched"),
        count("Accepted", "requestsAccepted"),
        count("Completed", "requestsCompleted"),
        count("Denied", "requestsDenied"),
        count("First responses", "firstResponses", "Requests this technician was first to answer"),
      ],
    },
    {
      title: "Time per task",
      rows: [
        duration("Avg. first response", "avgFirstResponseHours", formatHours, "Request raised to their first reply"),
        duration("Avg. time to complete", "avgResolutionHours", formatHours, "Request raised to their completion of it"),
        duration("Fastest completion", "fastestResolutionHours", formatHours),
        duration("Slowest completion", "slowestResolutionHours", formatHours),
        duration("Avg. repair turnaround", "avgRepairTurnaroundDays", formatDays, "Received to released, on jobs they booked in"),
      ],
    },
    {
      title: "Repair items",
      rows: [
        count("Status updates logged", "repairUpdates"),
        count("Items worked on", "repairItemsTouched", "Distinct repair items touched"),
        count("Items booked in", "repairsReceived"),
        count("Items released", "repairsReleased"),
      ],
    },
    {
      title: "Announcements",
      rows: [count("Published", "announcementsPosted")],
    },
  ];
}

/** Share of handled requests this technician actually closed. Null with nothing handled. */
export function completionRate(summary: TechnicianSummary): number | null {
  if (summary.requestsHandled === 0) return null;
  return summary.requestsCompleted / summary.requestsHandled;
}

export function formatPercent(ratio: number | null): string {
  return ratio == null ? "—" : `${Math.round(ratio * 100)}%`;
}

/** "1st", "2nd", "23rd", for the peer-rank readout. */
export function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

/** "+12" / "−3" / "no change". The minus is U+2212, which lines up with digits. */
export function formatDelta(delta: number): string {
  if (delta === 0) return "no change";
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

/** Human date range under the period heading. All-time has no start bound. */
export function periodRangeLabel(report: TechnicianReport): string {
  const { from, to } = report.period;
  if (!from || !to) {
    return `Everything on record through ${formatDate(report.generatedAt)}`;
  }
  // `to` is the exclusive upper bound, so show the last day actually covered.
  const lastDay = new Date(new Date(to).getTime() - 1);
  return `${formatDate(from)} to ${formatDate(lastDay.toISOString())}`;
}
