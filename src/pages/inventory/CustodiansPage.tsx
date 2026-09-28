import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { custodiansApi, referenceApi, type CustodianSortBy, type SortDir } from "../../lib/resources";
import { Card } from "../../components/ui/Card";
import { Combobox } from "../../components/ui/Combobox";
import { Button } from "../../components/ui/Button";
import { StatTile } from "../../components/ui/StatTile";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { SortableTh } from "../../components/ui/SortableTh";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { PageHeader } from "../../components/ui/PageHeader";
import { AlertBanner } from "../../components/ui/AlertBanner";
import { SearchInput } from "../../components/ui/SearchInput";
import { FilterTabs } from "../../components/ui/FilterTabs";
import { CheckCircleIcon, ChevronRightIcon, DashboardIcon, IdCardIcon, ListIcon, PlusIcon, XIcon } from "../../components/ui/icons";
import { officeName } from "../../lib/inventory";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import type { Custodian } from "../../types/api";
import { CustodianFormModal } from "./CustodianFormModal";
import { CustodianDetailModal } from "./CustodianDetailModal";
import { CustodianBadgeCard } from "./CustodianBadgeCard";
import { AccountabilityBadge, DueLabel, Office, PersonLine } from "./InventoryAtoms";

type Holding = "all" | "holding" | "overdue";
const HOLDINGS: Holding[] = ["all", "holding", "overdue"];
const PAGE_SIZE = 15;
const VIEW_KEY = "ictd-custodians-view";

function readView(): "list" | "grid" {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function custodySummary(c: Custodian): string | null {
  if (!c.activeItemCount) return null;
  // A PC counts once; the parts inside it are named separately (context
  // doc v2, 3.6: "3 items · incl. 4 installed parts").
  const parts = c.activeInstalledPartCount
    ? ` · incl. ${c.activeInstalledPartCount} installed part${c.activeInstalledPartCount === 1 ? "" : "s"}`
    : "";
  return `${c.activeItemCount} item${c.activeItemCount === 1 ? "" : "s"} on ${c.activeMrCount} MR${c.activeMrCount === 1 ? "" : "s"}${parts}`;
}

export function CustodiansPage() {
  const [params, setParams] = useSearchParams();
  const holdingParam = params.get("filter") as Holding | null;
  const holding: Holding = holdingParam && HOLDINGS.includes(holdingParam) ? holdingParam : "all";

  const [view, setView] = useState<"list" | "grid">(readView);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  // Accountability first: the people worth a phone call belong at the top.
  const [sortBy, setSortBy] = useState<CustodianSortBy>("accountability");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const statsQuery = useQuery({ queryKey: ["custodians", "stats"], queryFn: custodiansApi.stats });
  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });

  const debouncedSearch = useDebouncedValue(search.trim());
  const listParams = {
    search: debouncedSearch || undefined,
    departmentId,
    overdueOnly: holding === "overdue" || undefined,
    holdingOnly: holding === "holding" || undefined,
    sortBy,
    sortDir,
    page,
    pageSize: view === "grid" ? 16 : PAGE_SIZE,
  };
  const listQuery = useQuery({
    queryKey: ["custodians", "list", listParams],
    queryFn: () => custodiansApi.list(listParams),
    placeholderData: keepPreviousData,
  });

  const stats = statsQuery.data?.data;
  const rows = listQuery.data?.data ?? [];
  const hasFilters = !!listParams.search || departmentId != null || holding !== "all";

  function setHolding(next: Holding) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "all") p.delete("filter");
        else p.set("filter", next);
        return p;
      },
      { replace: true },
    );
    setPage(0);
  }

  function changeView(next: "list" | "grid") {
    setView(next);
    setPage(0);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Convenience only.
    }
  }

  function clearFilters() {
    setSearch("");
    setDepartmentId(undefined);
    setHolding("all");
  }

  function toggleSort(field: CustodianSortBy) {
    if (field === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir(field === "activeItems" ? "desc" : "asc");
    }
    setPage(0);
  }

  const departmentOptions = useMemo(
    () => (departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: officeName(d) })),
    [departmentsQuery.data],
  );

  const nobodyOverdue = holding === "overdue" && !listParams.search && departmentId == null;
  const emptyState = (
    <EmptyState
      icon={nobodyOverdue ? CheckCircleIcon : IdCardIcon}
      title={nobodyOverdue ? "Nobody's overdue" : hasFilters ? "No custodians match" : "No custodians on file yet"}
      hint={
        nobodyOverdue
          ? "Every custodian is either empty-handed or on track."
          : hasFilters
            ? "Try a different search, office or filter."
            : "Add the people who sign for equipment. They don't need a dashboard login."
      }
      action={
        hasFilters ? (
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : (
          <Button onClick={() => setShowCreate(true)}>
            <PlusIcon size={15} />
            Add custodian
          </Button>
        )
      }
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Custodians"
        description="Everyone accountable for issued computers and computer parts."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <PlusIcon size={15} />
            Add custodian
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Custodians on file" value={stats?.totalCustodians ?? 0} hint="People who can sign for equipment" />
        <StatTile
          label="Holding items right now"
          value={stats?.activeCustodians ?? 0}
          hint={stats ? `of ${stats.totalCustodians} on file` : undefined}
        />
        <StatTile
          label="Items currently out"
          value={stats?.totalActiveItems ?? 0}
          hint={stats ? (stats.totalOverdueItems > 0 ? `${stats.totalOverdueItems} overdue for return` : "None overdue for return") : undefined}
        />
      </div>

      {stats && stats.custodiansWithOverdueItems > 0 && holding !== "overdue" ? (
        <AlertBanner
          title={`${stats.custodiansWithOverdueItems} custodian${stats.custodiansWithOverdueItems === 1 ? "" : "s"} sitting on ${stats.totalOverdueItems} overdue item${stats.totalOverdueItems === 1 ? "" : "s"}`}
          action={
            <Button variant="danger" onClick={() => setHolding("overdue")}>
              Review
            </Button>
          }
        >
          Their MRs are past the expected return date. Worth a follow-up.
        </AlertBanner>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
          placeholder="Search name, employee #, email…"
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
          placeholder="Works in any office"
          ariaLabel="Works in"
          className="w-56"
        />
        <FilterTabs
          ariaLabel="Filter by custody"
          value={holding}
          onChange={setHolding}
          tabs={[
            { value: "all", label: "Everyone" },
            { value: "holding", label: "Holding items", count: stats?.activeCustodians },
            { value: "overdue", label: "Overdue", count: stats?.custodiansWithOverdueItems, alert: "critical" },
          ]}
        />
        {hasFilters ? (
          <Button variant="ghost" onClick={clearFilters} className="gap-1.5">
            <XIcon size={14} />
            Clear
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-[color:var(--border-hairline)] bg-surface p-0.5">
          {(
            [
              ["list", ListIcon, "List"],
              ["grid", DashboardIcon, "Badge wall"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => changeView(value)}
              aria-pressed={view === value}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === value ? "bg-black/[0.07] text-ink dark:bg-white/[0.12]" : "text-ink-muted hover:text-ink",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "grid" ? (
        listQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <ErrorState message={(listQuery.error as Error).message} />
        ) : rows.length > 0 ? (
          <div className={clsx("grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4", listQuery.isPlaceholderData && "opacity-60")}>
            {rows.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                aria-label={`Open ${c.first_name} ${c.last_name}`}
                className="rounded-2xl text-left transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series-1"
              >
                <CustodianBadgeCard custodian={c} />
              </button>
            ))}
          </div>
        ) : (
          <Card>{emptyState}</Card>
        )
      ) : (
        <Card className="overflow-hidden">
          {listQuery.isLoading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : listQuery.isError ? (
            <ErrorState message={(listQuery.error as Error).message} />
          ) : rows.length > 0 ? (
            <div className={clsx("transition-opacity", listQuery.isPlaceholderData && "opacity-60")}>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--gridline)] bg-black/[0.015] text-xs text-ink-muted dark:bg-white/[0.02]">
                      <SortableTh field="name" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                        Custodian
                      </SortableTh>
                      <SortableTh field="employeeNumber" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                        Employee #
                      </SortableTh>
                      <SortableTh field="department" activeField={sortBy} dir={sortDir} onSort={toggleSort} className="hidden lg:table-cell">
                        Works in
                      </SortableTh>
                      <th className="hidden px-4 py-3 font-medium xl:table-cell">Contact</th>
                      <SortableTh field="accountability" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                        Custody
                      </SortableTh>
                      <th className="px-4 py-3 font-medium">Next due</th>
                      <th className="w-10 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr
                        key={c.id}
                        className="cursor-pointer border-b border-[color:var(--gridline)] last:border-0 hover:bg-black/[0.02] focus-visible:bg-black/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-series-1 dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.04]"
                        onClick={() => setSelectedId(c.id)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(c.id);
                          }
                        }}
                      >
                        <td className="max-w-[18rem] px-4 py-3">
                          <PersonLine person={c} size={32} sub={c.email ?? undefined} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-ink-secondary">
                          {c.employee_number ?? <span className="font-sans text-ink-muted">None</span>}
                        </td>
                        <td className="hidden max-w-[15rem] px-4 py-3 text-ink-secondary lg:table-cell">
                          <Office dept={c.departments} className="block" />
                        </td>
                        <td className="hidden px-4 py-3 whitespace-nowrap text-ink-secondary xl:table-cell">
                          {c.contact_number || <span className="text-ink-muted">None</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <AccountabilityBadge custodian={c} />
                            {custodySummary(c) ? <span className="text-xs text-ink-muted">{custodySummary(c)}</span> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {c.activeItemCount ? (
                            c.nextDueAt ? (
                              <DueLabel mr={{ status: "active", expected_return_at: c.nextDueAt }} />
                            ) : (
                              <span className="text-xs text-ink-muted">No due date</span>
                            )
                          ) : (
                            <span className="text-xs text-ink-muted">Nothing out</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-ink-muted">
                          <ChevronRightIcon size={15} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[color:var(--gridline)] md:hidden">
                {rows.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    >
                      <PersonLine
                        person={c}
                        size={36}
                        className="flex-1"
                        sub={[c.employee_number ? `#${c.employee_number}` : null, officeName(c.departments, "No office")].filter(Boolean).join(" · ")}
                      />
                      <AccountabilityBadge custodian={c} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            emptyState
          )}
        </Card>
      )}

      {listQuery.data ? (
        <Pagination
          page={page}
          pageSize={listParams.pageSize}
          total={listQuery.data.total}
          onPageChange={setPage}
          itemLabel="custodians"
        />
      ) : null}

      {selectedId != null ? <CustodianDetailModal id={selectedId} onClose={() => setSelectedId(null)} /> : null}
      {showCreate ? (
        <CustodianFormModal
          onClose={() => setShowCreate(false)}
          onSaved={(c) => {
            setShowCreate(false);
            setSelectedId(c.id);
          }}
        />
      ) : null}
    </div>
  );
}
