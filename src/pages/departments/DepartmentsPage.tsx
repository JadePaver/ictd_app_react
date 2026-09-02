import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { departmentsApi } from "../../lib/resources";
import type { Department, DepartmentStats } from "../../types/api";
import { Avatar, colorForString } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PageSpinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { SortableTh, type SortDir } from "../../components/ui/SortableTh";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { BuildingIcon, DashboardIcon, ListIcon, SearchIcon, XIcon } from "../../components/ui/icons";
import { DepartmentFormModal } from "./DepartmentFormModal";
import { DepartmentCard } from "./DepartmentCard";

function DepartmentEmployeesModal({ id, label, onClose }: { id: number; label: string; onClose: () => void }) {
  const query = useQuery({ queryKey: ["departments", id, "employees"], queryFn: () => departmentsApi.employees(id) });
  const employees = query.data?.data ?? [];

  return (
    <Modal title={label} onClose={onClose}>
      {query.isLoading ? (
        <PageSpinner />
      ) : employees.length > 0 ? (
        <ul className="flex flex-col divide-y divide-[color:var(--gridline)]">
          {employees.map((u) => (
            <li key={u.id} className="flex items-center gap-2.5 py-2">
              <Avatar person={u} size={30} />
              <span className="truncate text-sm text-ink">
                {`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.username || `User #${u.id}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No employees assigned" hint="No one is currently assigned to this department." />
      )}
    </Modal>
  );
}

type DeptSortBy = "label" | "employeeCount" | "inventoryItemCount" | "custodianCount" | "activeMrCount";

function statValue(stats: DepartmentStats | undefined, field: DeptSortBy): number {
  if (field === "label") return 0;
  return stats?.[field] ?? 0;
}

export function DepartmentsPage() {
  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<DeptSortBy>("label");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<{ id: number; label: string } | null>(null);
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: ["reference", "departments"], queryFn: departmentsApi.list });
  const statsQuery = useQuery({ queryKey: ["departments", "stats"], queryFn: departmentsApi.stats });

  const statsById = new Map((statsQuery.data?.data ?? []).map((s) => [s.id, s]));
  const total = query.data?.data.length ?? 0;

  function toggleSort(field: DeptSortBy) {
    if (field === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "label" ? "asc" : "desc");
    }
  }

  const rows = useMemo(() => {
    const list = query.data?.data ?? [];
    const term = search.trim().toLowerCase();
    const filtered = term
      ? list.filter((d) => d.label?.toLowerCase().includes(term) || d.code?.toLowerCase().includes(term))
      : list;
    const sorted = [...filtered].sort((a, b) => {
      const cmp =
        sortBy === "label"
          ? (a.label ?? "").localeCompare(b.label ?? "")
          : statValue(statsById.get(a.id), sortBy) - statValue(statsById.get(b.id), sortBy);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
    // statsById is rebuilt every render from statsQuery.data, so it can't be
    // a dependency without recomputing every render anyway — depend on the
    // underlying query data instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, statsQuery.data, search, sortBy, sortDir]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Departments</h1>
          <p className="text-sm text-ink-muted">
            {search.trim() ? `${rows.length} of ${total} departments` : `${total} departments on record.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-[color:var(--border-hairline)] p-0.5">
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
              aria-label="Plaque grid view"
              aria-pressed={view === "grid"}
              title="Plaque grid view"
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                view === "grid" ? "bg-series-1 text-white" : "text-ink-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
              )}
            >
              <DashboardIcon size={15} />
            </button>
          </div>
          <Button onClick={() => setCreating(true)}>Add department</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search department or code…"
          className="w-full rounded-lg border border-[color:var(--border-hairline)] bg-transparent py-2 pr-8 pl-8 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-ink-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
          >
            <XIcon size={13} />
          </button>
        ) : null}
      </div>

      {query.isLoading ? (
        view === "list" ? <TableSkeleton rows={8} cols={6} /> : <PageSpinner />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} />
      ) : rows.length > 0 ? (
        view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((d) => (
              <DepartmentCard
                key={d.id}
                label={d.label ?? "Department"}
                code={d.code}
                stats={statsById.get(d.id)}
                onViewEmployees={() => setSelected({ id: d.id, label: d.label ?? "Department" })}
                onEdit={() => setEditing(d)}
              />
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--gridline)] text-xs text-ink-muted">
                    <SortableTh field="label" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Department
                    </SortableTh>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <SortableTh field="employeeCount" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Employees
                    </SortableTh>
                    <SortableTh field="inventoryItemCount" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Inventory
                    </SortableTh>
                    <SortableTh field="custodianCount" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Custodians
                    </SortableTh>
                    <SortableTh field="activeMrCount" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Active MRs
                    </SortableTh>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    const s = statsById.get(d.id);
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelected({ id: d.id, label: d.label ?? "Department" })}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelected({ id: d.id, label: d.label ?? "Department" });
                          }
                        }}
                        className="cursor-pointer border-b border-[color:var(--gridline)] last:border-0 hover:bg-black/[0.02] focus-visible:bg-black/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-series-1 dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.04]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: colorForString(d.label ?? "department") }}
                            />
                            <span className="text-ink">{d.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{d.code ?? "—"}</td>
                        <td className="px-4 py-3 text-ink-secondary">{s?.employeeCount ?? 0}</td>
                        <td className="px-4 py-3 text-ink-secondary">{s?.inventoryItemCount ?? 0}</td>
                        <td className="px-4 py-3 text-ink-secondary">{s?.custodianCount ?? 0}</td>
                        <td className="px-4 py-3">
                          {s && s.activeMrCount > 0 ? <Badge tone="accent">{s.activeMrCount}</Badge> : <span className="text-ink-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setEditing(d)}
                            className="font-medium text-series-1 hover:opacity-80"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[color:var(--gridline)] sm:hidden">
              {rows.map((d) => {
                const s = statsById.get(d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelected({ id: d.id, label: d.label ?? "Department" })}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: colorForString(d.label ?? "department") }}
                      >
                        <BuildingIcon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{d.label}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                          <span>{s?.employeeCount ?? 0} employees</span>
                          <span>·</span>
                          <span>{s?.custodianCount ?? 0} custodians</span>
                        </div>
                      </div>
                      {s && s.activeMrCount > 0 ? <Badge tone="accent">{s.activeMrCount}</Badge> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )
      ) : search.trim() ? (
        <EmptyState
          icon={SearchIcon}
          title="No departments match your search"
          hint={`Nothing found for "${search.trim()}" — try a different name or code.`}
          action={
            <Button variant="secondary" onClick={() => setSearch("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={BuildingIcon}
          title="No departments yet"
          hint="Add your first department to start organizing employees and custody records."
          action={<Button onClick={() => setCreating(true)}>Add department</Button>}
        />
      )}

      {selected ? (
        <DepartmentEmployeesModal id={selected.id} label={selected.label} onClose={() => setSelected(null)} />
      ) : null}

      {editing ? <DepartmentFormModal department={editing} onClose={() => setEditing(null)} /> : null}
      {creating ? <DepartmentFormModal onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
