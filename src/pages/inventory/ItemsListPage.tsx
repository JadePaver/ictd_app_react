import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { inventoryItemsApi, referenceApi, type InventorySortBy, type SortDir } from "../../lib/resources";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { SortableTh } from "../../components/ui/SortableTh";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { AlertTriangleIcon, QrCodeIcon, SearchIcon, XIcon } from "../../components/ui/icons";
import { itemStatusTone, type Tone } from "../../lib/statusStyles";
import { formatDate } from "../../lib/format";
import type { InventoryItem, InventoryItemDetail } from "../../types/api";
import { ItemFormModal } from "./ItemFormModal";
import { ItemDetailModal } from "./ItemDetailModal";
import { InventoryItemQrModal } from "./InventoryItemQrModal";

type Density = "comfortable" | "compact";

/** Compact rows are half the height, so the same screen holds twice the
 * page before anyone has to reach for the pager. */
const PAGE_SIZE: Record<Density, number> = { comfortable: 15, compact: 30 };
const CELL_PAD: Record<Density, string> = { comfortable: "px-4 py-3", compact: "px-4 py-1.5" };

const inputClass =
  "rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";
const chipClass = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors";

const PREFS_KEY = "ictd-inventory-prefs";
const SORT_FIELDS: InventorySortBy[] = ["createdAt", "updatedAt", "serialNumber", "brand", "status"];

interface StoredPrefs {
  categoryId?: number;
  statusId?: number;
  departmentId?: number;
  sortBy?: InventorySortBy;
  sortDir?: SortDir;
  density?: Density;
}

/**
 * Filters, sort and density survive a reload; the search box and page index
 * deliberately do not. Coming back tomorrow to a table still narrowed by a
 * half-typed serial number reads as a bug, not as a remembered preference.
 */
function readPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const p = parsed as StoredPrefs;
    return {
      categoryId: typeof p.categoryId === "number" ? p.categoryId : undefined,
      statusId: typeof p.statusId === "number" ? p.statusId : undefined,
      departmentId: typeof p.departmentId === "number" ? p.departmentId : undefined,
      // A stored sort field that no longer exists would make every request
      // 400, so anything off the current union is dropped on the way in.
      sortBy: SORT_FIELDS.includes(p.sortBy as InventorySortBy) ? p.sortBy : undefined,
      sortDir: p.sortDir === "asc" || p.sortDir === "desc" ? p.sortDir : undefined,
      density: p.density === "compact" || p.density === "comfortable" ? p.density : undefined,
    };
  } catch {
    // Storage blocked (private mode) or a hand-edited value: fall back to
    // defaults rather than taking the page down with it.
    return {};
  }
}

function itemName(item: { brand?: string | null; model?: string | null }): string {
  return [item.brand, item.model].filter(Boolean).join(" ") || "—";
}

function SerialTag({ value }: { value: string }) {
  return (
    <span className="rounded border border-[color:var(--border-hairline)] bg-black/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary dark:bg-white/[0.06]">
      {value}
    </span>
  );
}

/** Status as a left edge stripe, so condition is scannable straight down the
 * table without reading a single badge. Neutral keeps a transparent border
 * rather than none, or unremarkable rows would sit 2px left of the rest. */
function statusStripeClass(tone: Tone): string {
  switch (tone) {
    case "critical":
      return "border-l-critical";
    case "warning":
      return "border-l-warning";
    case "serious":
      return "border-l-serious";
    case "good":
      return "border-l-good";
    case "accent":
      return "border-l-series-1";
    default:
      return "border-l-transparent";
  }
}

/** Count pill inside a category chip — inverted while the chip is selected,
 * since the chip's own fill is already the series color. */
function ChipCount({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={clsx(
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        active ? "bg-white/25" : "bg-black/[0.06] dark:bg-white/[0.1]",
      )}
    >
      {value}
    </span>
  );
}

export function ItemsListPage() {
  const [prefs] = useState(readPrefs);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(prefs.categoryId);
  const [statusId, setStatusId] = useState<number | undefined>(prefs.statusId);
  const [departmentId, setDepartmentId] = useState<number | undefined>(prefs.departmentId);
  const [sortBy, setSortBy] = useState<InventorySortBy>(prefs.sortBy ?? "createdAt");
  const [sortDir, setSortDir] = useState<SortDir>(prefs.sortDir ?? "desc");
  const [density, setDensity] = useState<Density>(prefs.density ?? "comfortable");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | InventoryItemDetail | null>(null);
  const [qrItem, setQrItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ categoryId, statusId, departmentId, sortBy, sortDir, density }));
    } catch {
      // Quota or a blocked store — persistence is a convenience, not a
      // requirement, so a failed write is not worth surfacing.
    }
  }, [categoryId, statusId, departmentId, sortBy, sortDir, density]);

  const categoriesQuery = useQuery({ queryKey: ["reference", "item-categories"], queryFn: referenceApi.itemCategories });
  const statusesQuery = useQuery({ queryKey: ["reference", "item-statuses"], queryFn: referenceApi.itemStatuses });
  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });

  const categories = categoriesQuery.data?.data ?? [];
  const hasFilters = search !== "" || categoryId != null || statusId != null || departmentId != null;
  const pageSize = PAGE_SIZE[density];

  // The chips carry absolute per-category totals, so they only tell the
  // truth while nothing *else* is narrowing the set. Rather than show a
  // chip reading "3" above a table holding one row, the counts drop out
  // whenever another filter is active — and the queries behind them stop
  // firing at the same moment.
  const countsAreExact = statusId == null && departmentId == null && search === "";

  const totalQuery = useQuery({
    queryKey: ["inventory-items", "total"],
    queryFn: () => inventoryItemsApi.list({ pageSize: 1 }),
  });

  // One cheap count-only request per category (pageSize 1 — Postgrest's
  // exact count doesn't care how many rows actually come back) so the chips
  // can show real per-category totals without a dedicated aggregate
  // endpoint.
  const categoryCountQueries = useQueries({
    queries: categories.map((c) => ({
      queryKey: ["inventory-items", "category-count", c.id],
      queryFn: () => inventoryItemsApi.list({ categoryId: c.id, pageSize: 1 }),
      enabled: countsAreExact,
    })),
  });

  // A missing item is a liability, not just another status color — worth a
  // standing alert rather than something you only notice by filtering.
  const missingStatusId = statusesQuery.data?.data.find((s) => s.code === "missing")?.id;
  const missingQuery = useQuery({
    queryKey: ["inventory-items", "missing"],
    queryFn: () => inventoryItemsApi.list({ statusId: missingStatusId, pageSize: 5 }),
    enabled: missingStatusId != null,
  });
  const missingTotal = missingQuery.data?.total ?? 0;
  const missingExamples = missingQuery.data?.data ?? [];

  const listQuery = useQuery({
    queryKey: ["inventory-items", { search, categoryId, statusId, departmentId, sortBy, sortDir, page, pageSize }],
    queryFn: () =>
      inventoryItemsApi.list({
        search: search || undefined,
        categoryId,
        statusId,
        departmentId,
        sortBy,
        sortDir,
        page,
        pageSize,
      }),
  });

  const totalCount = totalQuery.data?.total;
  const summary = useMemo(() => {
    if (totalCount == null) return null;
    const bits = [`${totalCount} item${totalCount === 1 ? "" : "s"}`];
    if (missingTotal > 0) bits.push(`${missingTotal} missing`);
    if (categories.length > 0) bits.push(`${categories.length} categories`);
    return bits.join(" · ");
  }, [totalCount, missingTotal, categories.length]);

  function clearFilters() {
    setSearch("");
    setCategoryId(undefined);
    setStatusId(undefined);
    setDepartmentId(undefined);
    setPage(0);
  }

  function toggleSort(field: InventorySortBy) {
    if (field === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "createdAt" || field === "updatedAt" ? "desc" : "asc");
    }
    setPage(0);
  }

  /** Page index is a slice of a specific page size — switching density
   * rescales the slices, so "page 3" would land somewhere unrelated. */
  function changeDensity(next: Density) {
    setDensity(next);
    setPage(0);
  }

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
  const cellPad = CELL_PAD[density];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Inventory</h1>
          <p className="text-sm text-ink-muted">{summary ?? "Computers and computer parts on record, by serial number."}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Add item</Button>
      </div>

      {missingTotal > 0 && statusId !== missingStatusId ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-critical/30 bg-critical/10 p-3">
          <AlertTriangleIcon size={16} className="shrink-0 text-critical" />
          <p className="min-w-0 flex-1 text-sm text-critical">
            <span className="font-semibold">
              {missingTotal} item{missingTotal === 1 ? "" : "s"} marked missing
            </span>
            {missingExamples.length > 0 ? (
              <span className="text-ink-secondary">
                {" "}
                — {missingExamples.map((i) => i.serial_number).join(", ")}
                {missingTotal > missingExamples.length ? ", …" : ""}
              </span>
            ) : null}
          </p>
          <Button
            variant="danger"
            onClick={() => {
              setCategoryId(undefined);
              setStatusId(missingStatusId);
              setPage(0);
            }}
          >
            Review
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search serial number, brand, model…"
            className={`${inputClass} w-full pl-8`}
          />
        </div>
        <Combobox
          value={statusId}
          onChange={(v) => {
            setStatusId(v);
            setPage(0);
          }}
          options={(statusesQuery.data?.data ?? []).map((s) => ({ value: s.id, label: s.label }))}
          placeholder="All statuses"
          className="w-40"
        />
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
        {/* Spelled out rather than iconified: a bare pair of glyphs here is
            exactly the kind of control nobody finds. */}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-[color:var(--border-hairline)] p-0.5">
          {(["comfortable", "compact"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => changeDensity(d)}
              aria-pressed={density === d}
              className={clsx(
                "rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                density === d ? "bg-series-1 text-white" : "text-ink-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Categories as one wrapping chip row instead of a screen of tiles:
          same counts, a tenth of the vertical cost, and the active category
          stays visible while you read the table it filtered. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setCategoryId(undefined);
            setPage(0);
          }}
          aria-pressed={categoryId == null}
          className={clsx(
            chipClass,
            categoryId == null
              ? "bg-series-1 text-white"
              : "border border-[color:var(--border-hairline)] text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
          )}
        >
          All
          {countsAreExact && totalCount != null ? <ChipCount value={totalCount} active={categoryId == null} /> : null}
        </button>
        {categories.map((c, i) => {
          const active = categoryId === c.id;
          const count = categoryCountQueries[i]?.data?.total;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategoryId(active ? undefined : c.id);
                setPage(0);
              }}
              aria-pressed={active}
              className={clsx(
                chipClass,
                active
                  ? "bg-series-1 text-white"
                  : "border border-[color:var(--border-hairline)] text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
              )}
            >
              {c.label}
              {countsAreExact && count != null ? <ChipCount value={count} active={active} /> : null}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {listQuery.isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : listQuery.isError ? (
          <ErrorState message={(listQuery.error as Error).message} />
        ) : rows.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--gridline)] text-xs text-ink-muted">
                    {/* Matches the body's 2px stripe so the header label
                        sits on the same left edge as the cells below it. */}
                    <th className="border-l-2 border-l-transparent px-4 py-3 font-medium">Category</th>
                    <SortableTh field="brand" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Item
                    </SortableTh>
                    <SortableTh field="serialNumber" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Serial #
                    </SortableTh>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <SortableTh field="status" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Status
                    </SortableTh>
                    <SortableTh field="createdAt" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Added
                    </SortableTh>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const tone = itemStatusTone(item.item_statuses?.code);
                    return (
                      <tr
                        key={item.id}
                        className="cursor-pointer border-b border-[color:var(--gridline)] last:border-0 hover:bg-black/[0.02] focus-visible:bg-black/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-series-1 dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.04]"
                        onClick={() => setSelectedId(item.id)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(item.id);
                          }
                        }}
                      >
                        <td className={clsx("border-l-2 text-ink-secondary", cellPad, statusStripeClass(tone))}>
                          {item.item_categories?.label ?? "—"}
                        </td>
                        <td className={clsx("text-ink", cellPad)}>{itemName(item)}</td>
                        <td className={cellPad}>
                          <SerialTag value={item.serial_number} />
                        </td>
                        <td className={clsx("text-ink-secondary", cellPad)}>{item.departments?.label ?? "—"}</td>
                        <td className={cellPad}>
                          <Badge tone={tone}>{item.item_statuses?.label ?? "—"}</Badge>
                        </td>
                        <td className={clsx("tabular-nums text-ink-muted", cellPad)}>{formatDate(item.created_at)}</td>
                        <td className={cellPad}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="QR label"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQrItem(item);
                              }}
                              className="rounded-md p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-ink dark:hover:bg-white/[0.06]"
                            >
                              <QrCodeIcon size={15} />
                            </button>
                            <span className="text-ink-muted">→</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[color:var(--gridline)] sm:hidden">
              {rows.map((item) => {
                const tone = itemStatusTone(item.item_statuses?.code);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={clsx(
                        "flex w-full flex-col gap-2 border-l-2 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                        statusStripeClass(tone),
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium text-ink">{itemName(item)}</p>
                        <Badge tone={tone}>{item.item_statuses?.label ?? "—"}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                        <SerialTag value={item.serial_number} />
                        <span>·</span>
                        <span>{item.item_categories?.label ?? "Uncategorized"}</span>
                        <span>·</span>
                        <span>{item.departments?.label ?? "No department"}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : hasFilters ? (
          <EmptyState
            title="No items found"
            hint="Try a different filter or search term."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          // Unfiltered and still empty — there is nothing to clear, so the
          // only useful action is adding the first item.
          <EmptyState
            title="No items yet"
            hint="Add the first item to get started."
            action={<Button onClick={() => setShowCreate(true)}>Add item</Button>}
          />
        )}
      </Card>

      {listQuery.data ? (
        <Pagination page={page} pageSize={pageSize} total={listQuery.data.total} onPageChange={setPage} itemLabel="items" />
      ) : null}

      {selectedId != null ? (
        <ItemDetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onEdit={(item) => {
            setSelectedId(null);
            setEditingItem(item);
          }}
        />
      ) : null}
      {showCreate ? <ItemFormModal onClose={() => setShowCreate(false)} /> : null}
      {editingItem ? <ItemFormModal item={editingItem} onClose={() => setEditingItem(null)} /> : null}
      {qrItem ? <InventoryItemQrModal item={qrItem} onClose={() => setQrItem(null)} /> : null}
    </div>
  );
}
