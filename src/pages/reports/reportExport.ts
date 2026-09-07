import type { CsvCell } from "../../lib/csv";
import { slugify } from "../../lib/csv";
import { formatDateTime, formatHours } from "../../lib/format";
import { OUTCOME_STYLES, WORK_STREAMS, completionRate, formatDelta, formatPercent, metricGroups, periodRangeLabel } from "./reportMetrics";
import type { TechnicianReport } from "../../types/api";

/**
 * The whole report as spreadsheet rows: the same numbers the sheet shows,
 * read from the same `metricGroups` builder so the file and the printout
 * can't drift apart. Sections are separated by blank rows rather than
 * emitted as separate files, so one download is the whole record.
 */
export function reportCsvRows(report: TechnicianReport): CsvCell[][] {
  const { technician, period, summary, breakdowns, trend, highlights, ranking } = report;
  const previousHeading = period.previousLabel ? `Previous (${period.previousLabel})` : "Previous";

  const rows: CsvCell[][] = [
    ["ICTD App: technician performance report"],
    ["Technician", technician.name],
    ["Role", technician.roleLabel ?? "—"],
    ["Departments", technician.departments.map((d) => d.label ?? d.code ?? "").filter(Boolean).join("; ") || "—"],
    ["Period", period.label],
    ["Date range", periodRangeLabel(report)],
    ["Generated", formatDateTime(report.generatedAt)],
    [],
  ];

  if (ranking) {
    rows.push(
      ["Standing"],
      ["Rank", ranking.rank, `of ${ranking.peerCount} technicians`],
      ["Percentile", ranking.percentile],
      ["Team total", ranking.teamTotal],
      ["Team average", Number(ranking.teamAverage.toFixed(1))],
      ["Top technician", ranking.leaderTotal],
      [],
    );
  }

  rows.push(
    ["Outcomes"],
    ["Accepted", summary.requestsAccepted],
    ["Completed", summary.requestsCompleted],
    ["Denied", summary.requestsDenied],
    ["Answered first", summary.firstResponses],
    ["Completion rate", formatPercent(completionRate(summary))],
    [],
  );

  rows.push(["Section", "Metric", period.label, previousHeading, "Change"]);
  for (const group of metricGroups(report)) {
    for (const row of group.rows) {
      rows.push([group.title, row.label, row.value, row.previous ?? "—", row.delta == null ? "—" : formatDelta(row.delta)]);
    }
  }
  rows.push([]);

  rows.push(["Request type", "Handled", "Completed", "Denied", "Avg. time to complete", `Avg. time in ${period.previousLabel ?? "previous period"}`]);
  if (breakdowns.requestTypes.length === 0) rows.push(["(none)", 0, 0, 0, "—", "—"]);
  for (const type of breakdowns.requestTypes) {
    const before = breakdowns.previousRequestTypes?.find((t) => t.label === type.label) ?? null;
    rows.push([
      type.label,
      type.handled,
      type.completed,
      type.denied,
      formatHours(type.avgResolutionHours),
      before ? formatHours(before.avgResolutionHours) : "—",
    ]);
  }
  rows.push([]);

  rows.push(["Repair stage", "Updates logged", "Distinct items"]);
  if (breakdowns.repairStages.length === 0) rows.push(["(none)", 0, 0]);
  for (const stage of breakdowns.repairStages) rows.push([stage.label, stage.updates, stage.items]);
  rows.push([]);

  rows.push(["Requests by department", "Count"]);
  if (breakdowns.requestsByDepartment.length === 0) rows.push(["(none)", 0]);
  for (const entry of breakdowns.requestsByDepartment) rows.push([entry.label, entry.count]);
  rows.push([]);

  rows.push(["Activity over time", ...WORK_STREAMS.map((stream) => stream.label), "Total"]);
  for (const point of trend) {
    rows.push([point.key, point.requests, point.repairs, point.announcements, point.total]);
  }
  rows.push([]);

  rows.push(["Recent work", "Detail", "Outcome", "Time in", "When"]);
  if (highlights.length === 0) rows.push(["(none)", "", "", "", ""]);
  for (const highlight of highlights) {
    rows.push([
      highlight.title,
      highlight.subtitle,
      OUTCOME_STYLES[highlight.outcome].label,
      highlight.elapsedHours == null ? "—" : formatHours(highlight.elapsedHours),
      formatDateTime(highlight.at),
    ]);
  }

  // A one-line reminder of the counting rule, so a spreadsheet that outlives
  // this app still explains its own headline number.
  rows.push(
    [],
    [
      "Note",
      `"Actions recorded" (${summary.totalActions}) counts request status updates, repair log entries, and announcements published. Items booked in and released are shown separately because each already writes a repair log entry. Inventory and custody bookkeeping is out of scope for this report.`,
    ],
  );

  return rows;
}

export function reportFilename(report: TechnicianReport): string {
  return `technician-report-${slugify(report.technician.name)}-${slugify(report.period.label)}.csv`;
}
