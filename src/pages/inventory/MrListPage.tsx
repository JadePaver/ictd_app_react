import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { mrApi, referenceApi, type MrSortBy, type SortDir } from "../../lib/resources";
import type { MemorandumReceipt } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Combobox } from "../../components/ui/Combobox";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { SortableTh } from "../../components/ui/SortableTh";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { SearchIcon, XIcon } from "../../components/ui/icons";
import { mrStatusTone, toneTextClass, type Tone } from "../../lib/statusStyles";
import { dueStatus, isDueSoon, isOverdue } from "../../lib/mrMetrics";
import { fullName, formatDate } from "../../lib/format";
import { IssueMrModal } from "./IssueMrModal";
import { MrDetailModal } from "./MrDetailModal";

/**
 * An MR is a formal custody document with a real deadline, not a decision
 * to triage (Requests) or a physical object with open-ended dwell
 * (Repairs) — so it stays a ledger/table, and the thing worth organizing by
 * is urgency against that deadline, the same way a library groups loans
 * into on-time / due soon / overdue rather than by an internal workflow
 * state. "On track"/"Due soon"/"Overdue" are a strict partition of the
 * active set; "All" and "Closed" are the bookends.
 */
type MrSegment = "all" | "onTrack" | "dueSoon" | "overdue" | "closed";

const SEGMENTS: { value: MrSegment; label: string }[] = [
  { value: "all", label: "All" },
  { value: "onTrack", label: "On track" },
  { value: "dueSoon", label: "Due soon" },
  { value: "overdue", label: "Overdue" },
  { value: "closed", label: "Closed" },
];

function dueBorderClass(tone: Tone): string {
  switch (tone) {
    case "critical":
      return "border-l-critical";
    case "warning":
      return "border-l-warning";
    case "good":
      return "border-l-good";
    default:
      return "border-l-transparent";
  }
}

function emptyCopy(segment: MrSegment, hasFilters: boolean): { title: string; hint: string } {
  if (hasFilters) return { title: "No MRs found", hint: "Try a different filter or search term." };
  switch (segment) {
    case "overdue":
      return { title: "Nothing overdue", hint: "Every active MR is on track." };
    case "dueSoon":
      return { title: "Nothing due soon", hint: "No active MRs are approaching their return date." };
    case "onTrack":
      return { title: "No MRs on track", hint: "Nothing active without a return-date concern right now." };
    case "closed":
      return { title: "No closed MRs yet", hint: "Returned and transferred MRs will show up here." };
    default:
      return { title: "No MRs yet", hint: "Issue the first MR to get started." };
  }
}

const byDueDateAsc = (a: MemorandumReceipt, b: MemorandumReceipt) => {
  if (!a.expected_return_at && !b.expected_return_at) return 0;
  if (!a.expected_return_at) return 1;
  if (!b.expected_return_at) return -1;
  return new Date(a.expected_return_at).getTime() - new Date(b.expected_return_at).getTime();
};

const PAGE_SIZE = 15;
const inputClass =
  "rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";

export function MrListPage() {
  const [segment, setSegment] = useState<MrSegment>("all");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<MrSortBy>("issuedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showIssue, setShowIssue] = useState(false);

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });

  const isPaginatedSegment = segment === "all" || segment === "closed";

  const listQuery = useQuery({
    queryKey: ["mr", "ledger", segment, { search, departmentId, sortBy, sortDir, page }],
    queryFn: () =>
      mrApi.list({
        status: segment === "closed" ? "closed" : "all",
        search: search || undefined,
        departmentId,
        sortBy,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: isPaginatedSegment,
  });

  // Bounded (active MRs shouldn't realistically exceed this for a single
  // division — same reasoning as RepairsListPage's workbench fetch) and
  // always running regardless of which segment is selected, so the urgency
  // tabs can show live counts without a dedicated aggregate endpoint.
  const activeQuery = useQuery({
    queryKey: ["mr", "active-ledger", { search, departmentId }],
    queryFn: () =>
      mrApi.list({ status: "active", search: search || undefined, departmentId, sortBy: "issuedAt", sortDir: "desc", pageSize: 200 }),
  });

  const buckets = useMemo(() => {
    const onTrack: MemorandumReceipt[] = [];
    const dueSoon: MemorandumReceipt[] = [];
    const overdue: MemorandumReceipt[] = [];
    for (const mr of activeQuery.data?.data ?? []) {
      if (isOverdue(mr)) overdue.push(mr);
      else if (isDueSoon(mr)) dueSoon.push(mr);
      else onTrack.push(mr);
    }
    onTrack.sort(byDueDateAsc);
    dueSoon.sort(byDueDateAsc);
    overdue.sort(byDueDateAsc);
    return { onTrack, dueSoon, overdue };
  }, [activeQuery.data]);

  function countFor(value: MrSegment): number | undefined {
    switch (value) {
      case "onTrack":
        return buckets.onTrack.length;
      case "dueSoon":
        return buckets.dueSoon.length;
      case "overdue":
        return buckets.overdue.length;
      default:
        return undefined;
    }
  }

  const displayRows: MemorandumReceipt[] =
    segment === "onTrack"
      ? buckets.onTrack
      : segment === "dueSoon"
        ? buckets.dueSoon
        : segment === "overdue"
          ? buckets.overdue
          : (listQuery.data?.data ?? []);

  const isLoading = isPaginatedSegment ? listQuery.isLoading : activeQuery.isLoading;
  const isError = isPaginatedSegment ? listQuery.isError : activeQuery.isError;
  const errorMessage = ((isPaginatedSegment ? listQuery.error : activeQuery.error) as Error | null)?.message;

  const hasFilters = segment !== "all" || search !== "" || departmentId != null;

  function clearFilters() {
    setSegment("all");
    setSearch("");
    setDepartmentId(undefined);
    setPage(0);
  }

  function toggleSort(field: MrSortBy) {
    if (field === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "issuedAt" ? "desc" : "asc");
    }
    setPage(0);
  }

  const empty = emptyCopy(segment, hasFilters);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Memorandum Receipts</h1>
          <p className="text-sm text-ink-muted">Custody records for issued computers and computer parts.</p>
        </div>
        <Button onClick={() => setShowIssue(true)}>Issue MR</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SEGMENTS.map((s) => {
          const count = countFor(s.value);
          return (
            <button
              key={s.value}
              onClick={() => {
                setSegment(s.value);
                setPage(0);
              }}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                segment === s.value
                  ? "bg-series-1 text-white"
                  : "border border-[color:var(--border-hairline)] text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
              )}
            >
              {s.label}
              {count != null ? (
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    segment === s.value ? "bg-white/25" : "bg-black/[0.06] dark:bg-white/[0.1]",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search MR number, custodian…"
            className={`${inputClass} w-full pl-8`}
          />
        </div>
        <Combobox
          value={departmentId}
          onChange={(v) => {
            setDepartmentId(v);
            setPage(0);
          }}
          options={(departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: d.label }))}
          placeholder="All departments"
          className="w-44"
        />
        {hasFilters ? (
          <Button variant="ghost" onClick={clearFilters} className="gap-1.5">
            <XIcon size={14} />
            Clear filters
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : isError ? (
          <ErrorState message={errorMessage ?? "Something went wrong"} />
        ) : displayRows.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--gridline)] text-xs text-ink-muted">
                    {isPaginatedSegment ? (
                      <SortableTh field="mrNumber" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                        MR #
                      </SortableTh>
                    ) : (
                      <th className="px-4 py-3 font-medium">MR #</th>
                    )}
                    <th className="px-4 py-3 font-medium">Custodian</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    {isPaginatedSegment ? (
                      <SortableTh field="status" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                        Status
                      </SortableTh>
                    ) : (
                      <th className="px-4 py-3 font-medium">Status</th>
                    )}
                    {isPaginatedSegment ? (
                      <SortableTh field="issuedAt" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                        Issued
                      </SortableTh>
                    ) : (
                      <th className="px-4 py-3 font-medium">Issued</th>
                    )}
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((mr) => {
                    const due = dueStatus(mr);
                    return (
                      <tr
                        key={mr.id}
                        className="cursor-pointer border-b border-[color:var(--gridline)] last:border-0 hover:bg-black/[0.02] focus-visible:bg-black/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-series-1 dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.04]"
                        onClick={() => setSelectedId(mr.id)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(mr.id);
                          }
                        }}
                      >
                        <td className={clsx("border-l-4 px-4 py-3 font-mono text-xs text-ink", dueBorderClass(due.tone))}>
                          {mr.mr_number}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar person={mr.custodian} size={24} className="text-[10px]" />
                            <span className="text-ink-secondary">{fullName(mr.custodian)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-secondary">{mr.departments?.label ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={mrStatusTone(mr.status)}>{mr.status}</Badge>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-ink-muted">{formatDate(mr.issued_at)}</td>
                        <td className={clsx("px-4 py-3 text-xs font-medium", toneTextClass(due.tone))}>{due.label}</td>
                        <td className="px-4 py-3 text-right text-ink-muted">→</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[color:var(--gridline)] sm:hidden">
              {displayRows.map((mr) => {
                const due = dueStatus(mr);
                return (
                  <li key={mr.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(mr.id)}
                      className={clsx(
                        "flex w-full flex-col gap-2 border-l-4 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                        dueBorderClass(due.tone),
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-mono text-sm font-medium text-ink">{mr.mr_number}</p>
                        <Badge tone={mrStatusTone(mr.status)}>{mr.status}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                        <span>{fullName(mr.custodian)}</span>
                        <span>·</span>
                        <span>{mr.departments?.label ?? "No department"}</span>
                        <span>·</span>
                        <span className="tabular-nums">{formatDate(mr.issued_at)}</span>
                      </div>
                      <p className={clsx("text-xs font-medium", toneTextClass(due.tone))}>{due.label}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <EmptyState
            title={empty.title}
            hint={empty.hint}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>

      {isPaginatedSegment && listQuery.data ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={listQuery.data.total} onPageChange={setPage} itemLabel="MRs" />
      ) : null}

      {selectedId != null ? <MrDetailModal id={selectedId} onClose={() => setSelectedId(null)} /> : null}
      {showIssue ? <IssueMrModal onClose={() => setShowIssue(false)} /> : null}
    </div>
  );
}
