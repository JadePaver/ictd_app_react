import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { reportsApi } from "../../lib/resources";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { PageSpinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { DownloadIcon, PrintIcon, UsersIcon } from "../../components/ui/icons";
import { downloadCsv, toCsv } from "../../lib/csv";
import { TechnicianReportSheet, ReportPlaceholder } from "./TechnicianReportSheet";
import { reportCsvRows, reportFilename } from "./reportExport";
import type { ReportPeriodKey } from "../../types/api";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Labelled the way a technician would ask for it, not the way the API spells it. */
const PERIOD_OPTIONS: { key: ReportPeriodKey; label: string }[] = [
  { key: "month", label: "Monthly" },
  { key: "year", label: "Annual" },
  { key: "all", label: "Overall" },
];

/** How far back the year picker offers, when the technician's start date isn't known yet. */
const MAX_YEARS_BACK = 9;

function SegmentedPeriod({ value, onChange }: { value: ReportPeriodKey; onChange: (next: ReportPeriodKey) => void }) {
  return (
    <div
      role="group"
      aria-label="Reporting period"
      className="flex items-center gap-1 rounded-full border border-[color:var(--border-hairline)] bg-surface p-1"
    >
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={clsx(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
            value === option.key
              ? "bg-series-1 text-white"
              : "text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Technician performance reports: the one screen in this dashboard about a
 * *person* rather than a queue. A technician picks themselves and a period,
 * and gets a document they can print, sign, and take into a review; a
 * manager can pull the same thing for anyone on the roster.
 *
 * The page owns the controls and the export actions; everything inside
 * `TechnicianReportSheet` is the document, so what's on screen below the
 * filter row is exactly what comes out of the printer.
 */
export function TechnicianReportPage() {
  const { profile } = useAuth();
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [technicianId, setTechnicianId] = useState<number | undefined>(undefined);
  const [period, setPeriod] = useState<ReportPeriodKey>("month");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  // The roster is a full scan of the attribution tables server-side, and it
  // only changes when someone joins or is given an operator role, so it does
  // not need re-fetching every half minute like the queue screens do.
  const rosterQuery = useQuery({
    queryKey: ["reports", "technicians"],
    queryFn: reportsApi.technicians,
    staleTime: 10 * 60_000,
  });

  /** Whoever is signed in, for the printed sheet's provenance line. */
  const operatorName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.email || null;
  const roster = rosterQuery.data?.data;

  // Default to the signed-in operator, since the common case is "show me
  // mine", and fall back to whoever has the most on record.
  useEffect(() => {
    if (technicianId != null || !roster || roster.length === 0) return;
    const self = roster.find((entry) => entry.id === profile?.publicUserId);
    setTechnicianId(self?.id ?? roster[0].id);
  }, [roster, profile?.publicUserId, technicianId]);

  const selected = roster?.find((entry) => entry.id === technicianId);

  const reportParams = useMemo(
    () => ({
      period,
      year: period === "all" ? undefined : year,
      month: period === "month" ? month : undefined,
    }),
    [period, year, month],
  );

  const reportQuery = useQuery({
    // Keyed on the exact request, so changing a month while on "Overall"
    // can't spawn a second cache entry for an identical fetch.
    queryKey: ["reports", "technician", technicianId, reportParams],
    queryFn: () => reportsApi.technician(technicianId!, reportParams),
    enabled: technicianId != null,
    // Hold the previous report on screen while the next one loads. A
    // spinner between two near-identical documents reads as a page flash.
    placeholderData: keepPreviousData,
  });

  const report = reportQuery.data?.data;

  const yearOptions = useMemo(() => {
    const joinedYear = selected ? new Date(selected.joinedAt).getFullYear() : currentYear;
    const earliest = Math.max(
      Math.min(Number.isFinite(joinedYear) ? joinedYear : currentYear, currentYear),
      currentYear - MAX_YEARS_BACK,
    );
    const years: { value: number; label: string }[] = [];
    for (let y = currentYear; y >= earliest; y--) years.push({ value: y, label: String(y) });
    return years;
  }, [selected, currentYear]);

  // Future months in the current year would only ever render an empty report
  // that looks like a bug, so they're not offered.
  const monthOptions = useMemo(() => {
    const limit = year === currentYear ? currentMonth : 12;
    return MONTH_NAMES.slice(0, limit).map((label, index) => ({ value: index + 1, label }));
  }, [year, currentYear, currentMonth]);

  // Switching to the current year while a later month is selected would ask
  // for a period that hasn't happened yet.
  useEffect(() => {
    if (year === currentYear && month > currentMonth) setMonth(currentMonth);
  }, [year, month, currentYear, currentMonth]);

  // Switching to a technician who joined more recently can strand the
  // selected year outside the offered range, leaving the picker blank while
  // the report kept loading a year that isn't on the list.
  useEffect(() => {
    if (yearOptions.length === 0) return;
    if (!yearOptions.some((option) => option.value === year)) setYear(yearOptions[0].value);
  }, [yearOptions, year]);

  function handleExport() {
    if (!report) return;
    downloadCsv(reportFilename(report), toCsv(reportCsvRows(report)));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Technician report</h1>
          <p className="text-sm text-ink-muted">
            A printable record of one technician&rsquo;s work: monthly, annual, or their whole time on record.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={!report} className="gap-2">
            <DownloadIcon size={14} />
            Export CSV
          </Button>
          <Button onClick={() => window.print()} disabled={!report} className="gap-2">
            <PrintIcon size={14} />
            Print
          </Button>
        </div>
      </div>

      {/* One filter row scoping everything below it. */}
      <Card className="no-print flex flex-wrap items-center gap-3 p-3">
        <div className="flex min-w-[15rem] flex-1 items-center gap-2">
          <label htmlFor="report-technician" className="shrink-0 text-xs font-medium text-ink-muted">
            Technician
          </label>
          <Combobox
            id="report-technician"
            value={technicianId}
            onChange={(value) => setTechnicianId(value)}
            clearable={false}
            options={(roster ?? []).map((entry) => ({
              value: entry.id,
              label: `${entry.name}${entry.isOperator ? "" : " (former operator)"} · ${entry.totalActions} on record`,
            }))}
            placeholder={rosterQuery.isLoading ? "Loading…" : "Select a technician…"}
            className="min-w-0 flex-1"
          />
        </div>

        <SegmentedPeriod value={period} onChange={setPeriod} />

        {period === "month" ? (
          <Combobox
            value={month}
            onChange={(value) => value != null && setMonth(value)}
            clearable={false}
            options={monthOptions}
            placeholder="Month"
            className="w-36"
          />
        ) : null}
        {period !== "all" ? (
          <Combobox
            value={year}
            onChange={(value) => value != null && setYear(value)}
            clearable={false}
            options={yearOptions}
            placeholder="Year"
            className="w-28"
          />
        ) : null}
      </Card>

      {rosterQuery.isError ? (
        <ErrorState message={(rosterQuery.error as Error).message} />
      ) : rosterQuery.isLoading ? (
        <PageSpinner />
      ) : (roster?.length ?? 0) === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={UsersIcon}
            title="No technicians to report on"
            hint="Nobody has an operator role or any recorded activity yet."
          />
        </Card>
      ) : technicianId == null ? (
        <ReportPlaceholder />
      ) : reportQuery.isError ? (
        <ErrorState message={(reportQuery.error as Error).message} />
      ) : !report ? (
        <PageSpinner />
      ) : (
        // Held at reduced opacity while a new period loads, rather than
        // swapped for a skeleton. No layout jump, and the numbers on screen
        // stay readable until the replacements arrive.
        <div className={clsx("transition-opacity duration-150", reportQuery.isFetching && "opacity-60")}>
          <TechnicianReportSheet report={report} generatedBy={operatorName} />
        </div>
      )}
    </div>
  );
}
