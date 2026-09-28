import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { mrApi, referenceApi, type MrSortBy, type SortDir } from "../../lib/resources";
import type { MemorandumReceipt, MrSegment } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Combobox } from "../../components/ui/Combobox";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { SortableTh } from "../../components/ui/SortableTh";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { PageHeader } from "../../components/ui/PageHeader";
import { SearchInput } from "../../components/ui/SearchInput";
import { FilterTabs, type FilterTab } from "../../components/ui/FilterTabs";
import { CheckCircleIcon, ChevronRightIcon, FileTextIcon, PlusIcon, XIcon } from "../../components/ui/icons";
import { dueInfo, type DueInfo } from "../../lib/mrMetrics";
import { formatDateMedium } from "../../lib/format";
import { officeName } from "../../lib/inventory";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { IssueMrModal } from "./IssueMrModal";
import { MrDetailModal } from "./MrDetailModal";
import { DueLabel, MrStamp, Office, PersonLine } from "./InventoryAtoms";

/**
 * An MR is a custody document with a real deadline, so the ledger is
 * organised by urgency against that deadline, the way a library sorts loans
 * into on time, due soon and overdue. Those three partition the active MRs;
 * All and Closed bracket them.
 */
const SEGMENTS: MrSegment[] = ["all", "onTrack", "dueSoon", "overdue", "closed"];
const SEGMENT_LABEL: Record<MrSegment, string> = {
  all: "All MRs",
  active: "Active",
  onTrack: "On track",
  dueSoon: "Due soon",
  overdue: "Overdue",
  closed: "Closed",
};

function edgeClass(due: DueInfo): string {
  switch (due.tone) {
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

function emptyCopy(segment: MrSegment, hasFilters: boolean): { title: string; hint: string; good?: boolean } {
  if (hasFilters) return { title: "No MRs match", hint: "Try a different search or office." };
  switch (segment) {
    case "overdue":
      return { title: "Nothing overdue", hint: "Every active MR is on track.", good: true };
    case "dueSoon":
      return { title: "Nothing due soon", hint: "No active MR is due in the next three days.", good: true };
    case "onTrack":
      return { title: "No MRs on track", hint: "Every active MR is either due soon or overdue." };
    case "closed":
      return { title: "No closed MRs yet", hint: "Returned and transferred MRs will show up here." };
    default:
      return { title: "No MRs yet", hint: "Issue the first memorandum receipt to start tracking custody." };
  }
}

/** "3 items", or "2 of 3 out" once some have been split off. */
function itemsText(mr: MemorandumReceipt): { main: string; sub?: string } {
  const total = mr.itemCount ?? 0;
  const out = mr.activeItemCount ?? 0;
  if (mr.status === "active" && out !== total) return { main: `${out} of ${total}`, sub: "still out" };
  return { main: `${total} item${total === 1 ? "" : "s"}` };
}

const PAGE_SIZE = 15;

export function MrListPage() {
  const [params, setParams] = useSearchParams();
  const segmentParam = params.get("segment") as MrSegment | null;
  const segment: MrSegment = segmentParam && SEGMENTS.includes(segmentParam) ? segmentParam : "all";

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  // Undefined lets the API choose: soonest due first for the urgency
  // segments, newest issued first otherwise.
  const [sortBy, setSortBy] = useState<MrSortBy | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDir | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showIssue, setShowIssue] = useState(false);

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const debouncedSearch = useDebouncedValue(search.trim());
  const scope = { search: debouncedSearch || undefined, departmentId };

  const summaryQuery = useQuery({
    queryKey: ["mr", "summary", scope],
    queryFn: () => mrApi.summary(scope),
    placeholderData: keepPreviousData,
  });
  const overallQuery = useQuery({ queryKey: ["mr", "summary", {}], queryFn: () => mrApi.summary() });

  const listQuery = useQuery({
    queryKey: ["mr", "ledger", { ...scope, segment, sortBy, sortDir, page }],
    queryFn: () => mrApi.list({ ...scope, segment, sortBy, sortDir, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const counts = summaryQuery.data?.data;
  const overall = overallQuery.data?.data;
  const activeSort = listQuery.data?.sortBy ?? "issuedAt";
  const activeDir = listQuery.data?.sortDir ?? "desc";

  const tabs: FilterTab<MrSegment>[] = SEGMENTS.map((value) => ({
    value,
    label: SEGMENT_LABEL[value],
    count: counts?.[value as keyof typeof counts] as number | undefined,
    dot:
      value === "overdue"
        ? "var(--status-critical)"
        : value === "dueSoon"
          ? "var(--status-warning)"
          : value === "onTrack"
            ? "var(--status-good)"
            : undefined,
    alert: value === "overdue" ? "critical" : value === "dueSoon" ? "warning" : undefined,
  }));

  function setSegment(next: MrSegment) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "all") p.delete("segment");
        else p.set("segment", next);
        return p;
      },
      { replace: true },
    );
    setSortBy(undefined);
    setSortDir(undefined);
    setPage(0);
  }

  const hasFilters = !!scope.search || departmentId != null;
  function clearFilters() {
    setSearch("");
    setDepartmentId(undefined);
    setPage(0);
  }

  function toggleSort(field: MrSortBy) {
    if (field === activeSort) {
      setSortBy(field);
      setSortDir(activeDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir(field === "issuedAt" ? "desc" : "asc");
    }
    setPage(0);
  }

  const departmentOptions = useMemo(
    () => (departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: officeName(d) })),
    [departmentsQuery.data],
  );

  const rows = listQuery.data?.data ?? [];
  const empty = emptyCopy(segment, hasFilters);

  const headerLine = overall
    ? [
        `${overall.active} active`,
        `${overall.itemsOut} item${overall.itemsOut === 1 ? "" : "s"} out`,
        overall.overdue > 0 ? `${overall.overdue} overdue` : "none overdue",
      ].join(" · ")
    : "Custody records for issued computers and computer parts.";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Memorandum Receipts"
        description={headerLine}
        actions={
          <Button onClick={() => setShowIssue(true)}>
            <PlusIcon size={15} />
            Issue MR
          </Button>
        }
      />

      <FilterTabs variant="cards" ariaLabel="MR urgency" tabs={tabs} value={segment} onChange={setSegment} />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
          placeholder="Search MR number, custodian, employee #…"
          shortcut
          className="min-w-56 flex-1"
        />
        <Combobox
          value={departmentId}
          onChange={(v) => {
            setDepartmentId(v);
            setPage(0);
          }}
          options={departmentOptions}
          placeholder="Filed under any office"
          ariaLabel="Filed under"
          className="w-60"
        />
        {hasFilters ? (
          <Button variant="ghost" onClick={clearFilters} className="gap-1.5">
            <XIcon size={14} />
            Clear
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        {listQuery.isLoading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : listQuery.isError ? (
          <ErrorState message={(listQuery.error as Error).message} />
        ) : rows.length > 0 ? (
          <div className={clsx("transition-opacity", listQuery.isPlaceholderData && "opacity-60")}>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--gridline)] bg-black/[0.015] text-xs text-ink-muted dark:bg-white/[0.02]">
                    <SortableTh field="mrNumber" activeField={activeSort} dir={activeDir} onSort={toggleSort} className="border-l-4 border-l-transparent">
                      MR #
                    </SortableTh>
                    <SortableTh field="custodian" activeField={activeSort} dir={activeDir} onSort={toggleSort}>
                      Custodian
                    </SortableTh>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Filed under</th>
                    <SortableTh field="status" activeField={activeSort} dir={activeDir} onSort={toggleSort}>
                      Status
                    </SortableTh>
                    <SortableTh field="issuedAt" activeField={activeSort} dir={activeDir} onSort={toggleSort} className="hidden xl:table-cell">
                      Issued
                    </SortableTh>
                    <SortableTh field="dueAt" activeField={activeSort} dir={activeDir} onSort={toggleSort}>
                      Due
                    </SortableTh>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((mr) => {
                    const due = dueInfo(mr);
                    const items = itemsText(mr);
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
                        <td className={clsx("border-l-4 px-4 py-3 font-mono text-[13px] font-semibold whitespace-nowrap text-ink", edgeClass(due))}>
                          {mr.mr_number}
                        </td>
                        <td className="max-w-[16rem] px-4 py-3">
                          <PersonLine person={mr.custodian} size={28} sub={mr.custodian?.employee_number ? `#${mr.custodian.employee_number}` : undefined} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-ink">{items.main}</span>
                          {items.sub ? <span className="block text-xs text-ink-muted">{items.sub}</span> : null}
                        </td>
                        <td className="hidden max-w-[14rem] px-4 py-3 text-ink-secondary lg:table-cell">
                          <Office dept={mr.departments} className="block" />
                        </td>
                        <td className="px-4 py-3">
                          <MrStamp status={mr.status} />
                        </td>
                        <td className="hidden px-4 py-3 whitespace-nowrap text-ink-muted tabular-nums xl:table-cell">{formatDateMedium(mr.issued_at)}</td>
                        <td className="px-4 py-3">
                          <DueLabel mr={mr} />
                        </td>
                        <td className="px-4 py-3 text-right text-ink-muted">
                          <ChevronRightIcon size={15} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[color:var(--gridline)] md:hidden">
              {rows.map((mr) => {
                const due = dueInfo(mr);
                const items = itemsText(mr);
                return (
                  <li key={mr.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(mr.id)}
                      className={clsx(
                        "flex w-full flex-col gap-2 border-l-4 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                        edgeClass(due),
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate font-mono text-sm font-semibold text-ink">{mr.mr_number}</p>
                        <MrStamp status={mr.status} />
                      </div>
                      <PersonLine person={mr.custodian} size={24} sub={`${items.main}${items.sub ? ` ${items.sub}` : ""} · issued ${formatDateMedium(mr.issued_at)}`} />
                      <DueLabel mr={mr} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <EmptyState
            icon={empty.good ? CheckCircleIcon : FileTextIcon}
            title={empty.title}
            hint={empty.hint}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : segment === "all" ? (
                <Button onClick={() => setShowIssue(true)}>
                  <PlusIcon size={15} />
                  Issue MR
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>

      {listQuery.data ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={listQuery.data.total} onPageChange={setPage} itemLabel="MRs" />
      ) : null}

      {selectedId != null ? <MrDetailModal id={selectedId} onClose={() => setSelectedId(null)} /> : null}
      {showIssue ? (
        <IssueMrModal
          onClose={() => setShowIssue(false)}
          onIssued={(id) => {
            setShowIssue(false);
            setSelectedId(id);
          }}
        />
      ) : null}
    </div>
  );
}
