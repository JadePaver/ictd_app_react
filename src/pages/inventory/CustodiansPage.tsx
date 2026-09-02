import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { custodiansApi, referenceApi, type CustodianSortBy, type SortDir } from "../../lib/resources";
import { Card } from "../../components/ui/Card";
import { Combobox } from "../../components/ui/Combobox";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { StatTile } from "../../components/ui/StatTile";
import { Avatar } from "../../components/ui/Avatar";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { SortableTh } from "../../components/ui/SortableTh";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { AlertTriangleIcon, DashboardIcon, ListIcon, SearchIcon, XIcon } from "../../components/ui/icons";
import { fullName } from "../../lib/format";
import { CustodianFormModal } from "./CustodianFormModal";
import { CustodianDetailModal } from "./CustodianDetailModal";
import { CustodianBadgeCard } from "./CustodianBadgeCard";

const PAGE_SIZE = 15;
const inputClass =
  "rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";

export function CustodiansPage() {
  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<CustodianSortBy>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const statsQuery = useQuery({ queryKey: ["custodians", "stats"], queryFn: custodiansApi.stats });
  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });

  const listQuery = useQuery({
    queryKey: ["custodians", { search, departmentId, overdueOnly, sortBy, sortDir, page }],
    queryFn: () =>
      custodiansApi.list({ search: search || undefined, departmentId, overdueOnly, sortBy, sortDir, page, pageSize: PAGE_SIZE }),
  });

  const hasFilters = search !== "" || departmentId != null || overdueOnly;

  function clearFilters() {
    setSearch("");
    setDepartmentId(undefined);
    setOverdueOnly(false);
    setPage(0);
  }

  function toggleSort(field: CustodianSortBy) {
    if (field === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(0);
  }

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
  const stats = statsQuery.data?.data;

  const noResultsIsGoodNews = overdueOnly && !search && departmentId == null;
  const emptyState = (
    <EmptyState
      title={noResultsIsGoodNews ? "Nobody's overdue" : "No custodians found"}
      hint={
        noResultsIsGoodNews
          ? "Every custodian is either empty-handed or on track."
          : hasFilters
            ? "Try a different filter or search term."
            : "Add the first custodian to get started."
      }
      action={
        hasFilters ? (
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : (
          <Button onClick={() => setShowCreate(true)}>Add custodian</Button>
        )
      }
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Custodians</h1>
          <p className="text-sm text-ink-muted">Everyone accountable for issued computers and computer parts.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Add custodian</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label="Custodians on file" value={stats?.totalCustodians ?? 0} />
        <StatTile
          label="Holding items right now"
          value={stats?.activeCustodians ?? 0}
          hint={stats ? `of ${stats.totalCustodians} total` : undefined}
        />
        <StatTile label="Items currently out" value={stats?.totalActiveItems ?? 0} />
      </div>

      {stats && stats.custodiansWithOverdueItems > 0 && !overdueOnly ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-critical/30 bg-critical/10 p-3">
          <AlertTriangleIcon size={16} className="shrink-0 text-critical" />
          <p className="min-w-0 flex-1 text-sm text-critical">
            <span className="font-semibold">
              {stats.custodiansWithOverdueItems} custodian{stats.custodiansWithOverdueItems === 1 ? "" : "s"}
            </span>{" "}
            <span className="text-ink-secondary">
              sitting on {stats.totalOverdueItems} overdue item{stats.totalOverdueItems === 1 ? "" : "s"} — worth a follow-up.
            </span>
          </p>
          <Button
            variant="danger"
            onClick={() => {
              setOverdueOnly(true);
              setPage(0);
            }}
          >
            Review
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search name, employee #, email…"
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
        <button
          onClick={() => {
            setOverdueOnly((v) => !v);
            setPage(0);
          }}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            overdueOnly
              ? "bg-critical text-white"
              : "border border-[color:var(--border-hairline)] text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
          }`}
        >
          Overdue only
        </button>
        {hasFilters ? (
          <Button variant="ghost" onClick={clearFilters} className="gap-1.5">
            <XIcon size={14} />
            Clear filters
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-[color:var(--border-hairline)] p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="List view"
            aria-pressed={view === "list"}
            title="List view"
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
              view === "list" ? "bg-series-1 text-white" : "text-ink-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
            )}
          >
            <ListIcon size={15} />
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Badge wall view"
            aria-pressed={view === "grid"}
            title="Badge wall view"
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
              view === "grid" ? "bg-series-1 text-white" : "text-ink-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
            )}
          >
            <DashboardIcon size={15} />
          </button>
        </div>
      </div>

      {view === "grid" ? (
        listQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <ErrorState message={(listQuery.error as Error).message} />
        ) : rows.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className="rounded-2xl text-left transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series-1"
              >
                <CustodianBadgeCard custodian={c} />
              </button>
            ))}
          </div>
        ) : (
          emptyState
        )
      ) : (
      <Card className="overflow-hidden">
        {listQuery.isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : listQuery.isError ? (
          <ErrorState message={(listQuery.error as Error).message} />
        ) : rows.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--gridline)] text-xs text-ink-muted">
                    <SortableTh field="name" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Custodian
                    </SortableTh>
                    <SortableTh field="employeeNumber" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Employee #
                    </SortableTh>
                    <SortableTh field="department" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Department
                    </SortableTh>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <SortableTh field="activeItems" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Items in custody
                    </SortableTh>
                    <th className="px-4 py-3" />
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar person={c} size={28} className="text-[11px]" />
                          <span className="text-ink">{fullName(c)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{c.employee_number ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-secondary">{c.departments?.label ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-secondary">{c.contact_number || c.email || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {c.activeItemCount ? (
                            <Badge tone="accent">{c.activeItemCount}</Badge>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                          {c.overdueItemCount ? (
                            <Badge tone="critical">
                              {c.overdueItemCount} overdue
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-ink-muted">→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[color:var(--gridline)] sm:hidden">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <Avatar person={c} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{fullName(c)}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                        <span>{c.departments?.label ?? "No department"}</span>
                        {c.employee_number ? (
                          <>
                            <span>·</span>
                            <span className="font-mono">#{c.employee_number}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {c.activeItemCount ? <Badge tone="accent">{c.activeItemCount}</Badge> : null}
                      {c.overdueItemCount ? <Badge tone="critical">{c.overdueItemCount} overdue</Badge> : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          emptyState
        )}
      </Card>
      )}

      {listQuery.data ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={listQuery.data.total} onPageChange={setPage} itemLabel="custodians" />
      ) : null}

      {selectedId != null ? <CustodianDetailModal id={selectedId} onClose={() => setSelectedId(null)} /> : null}
      {showCreate ? <CustodianFormModal onClose={() => setShowCreate(false)} /> : null}
    </div>
  );
}
