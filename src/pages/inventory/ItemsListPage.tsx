import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
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
import { itemStatusTone } from "../../lib/statusStyles";
import { formatDate } from "../../lib/format";
import type { InventoryItem, InventoryItemDetail, ItemCategory } from "../../types/api";
import { ItemFormModal } from "./ItemFormModal";
import { ItemDetailModal } from "./ItemDetailModal";
import { InventoryItemQrModal } from "./InventoryItemQrModal";

const PAGE_SIZE = 15;
const inputClass =
  "rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";

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

/**
 * A physical asset catalog is naturally browsed by category — like walking
 * shelf to shelf — not filtered by decision-state (Requests) or grouped by
 * who's handling it (Repairs). Clicking a tile just sets the category
 * filter and drops into the same table the page already had below; there's
 * no separate "category view" to keep in sync, only one drill-down path.
 */
function CategoryTile({
  category,
  count,
  onClick,
}: {
  category: ItemCategory;
  count: number | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-xl border border-[color:var(--border-hairline)] bg-surface p-4 text-left shadow-sm transition-colors hover:border-series-1/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-series-1"
    >
      <span className="text-2xl font-semibold tabular-nums text-ink">{count ?? "–"}</span>
      <span className="text-sm text-ink-secondary">{category.label}</span>
    </button>
  );
}

export function ItemsListPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [statusId, setStatusId] = useState<number | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<InventorySortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | InventoryItemDetail | null>(null);
  const [qrItem, setQrItem] = useState<InventoryItem | null>(null);

  const categoriesQuery = useQuery({ queryKey: ["reference", "item-categories"], queryFn: referenceApi.itemCategories });
  const statusesQuery = useQuery({ queryKey: ["reference", "item-statuses"], queryFn: referenceApi.itemStatuses });
  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });

  const hasFilters = search !== "" || categoryId != null || statusId != null || departmentId != null;
  const categories = categoriesQuery.data?.data ?? [];

  // One cheap count-only request per category (pageSize 1 — Postgrest's
  // exact count doesn't care how many rows actually come back) so the
  // landing tiles can show real per-category totals without a dedicated
  // aggregate endpoint. Only runs while browsing — once any filter is set
  // the table below takes over and these are pointless.
  const categoryCountQueries = useQueries({
    queries: categories.map((c) => ({
      queryKey: ["inventory-items", "category-count", c.id],
      queryFn: () => inventoryItemsApi.list({ categoryId: c.id, pageSize: 1 }),
      enabled: !hasFilters,
    })),
  });
  const categoriesLoaded = categories.length > 0 && categoryCountQueries.every((q) => q.isSuccess);
  const totalItems = categoryCountQueries.reduce((sum, q) => sum + (q.data?.total ?? 0), 0);

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
    queryKey: ["inventory-items", { search, categoryId, statusId, departmentId, sortBy, sortDir, page }],
    queryFn: () =>
      inventoryItemsApi.list({
        search: search || undefined,
        categoryId,
        statusId,
        departmentId,
        sortBy,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: hasFilters,
  });

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

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Inventory</h1>
          <p className="text-sm text-ink-muted">Computers and computer parts on record, by serial number.</p>
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

      <div className="flex flex-wrap items-end gap-2">
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
          value={categoryId}
          onChange={(v) => {
            setCategoryId(v);
            setPage(0);
          }}
          options={categories.map((c) => ({ value: c.id, label: c.label }))}
          placeholder="All categories"
          className="w-42"
        />
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
      </div>

      {!hasFilters ? (
        categoriesQuery.isError ? (
          <ErrorState message={(categoriesQuery.error as Error).message} />
        ) : categoriesQuery.isLoading || !categoriesLoaded ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-[74px] animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.06]" />
            ))}
          </div>
        ) : totalItems === 0 ? (
          <EmptyState
            title="No items yet"
            hint="Add the first item to get started."
            action={<Button onClick={() => setShowCreate(true)}>Add item</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((c, i) => (
              <CategoryTile
                key={c.id}
                category={c}
                count={categoryCountQueries[i]?.data?.total}
                onClick={() => {
                  setCategoryId(c.id);
                  setPage(0);
                }}
              />
            ))}
          </div>
        )
      ) : (
        <>
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
                        <th className="px-4 py-3 font-medium">Category</th>
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
                      {rows.map((item) => (
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
                          <td className="px-4 py-3 text-ink-secondary">{item.item_categories?.label ?? "—"}</td>
                          <td className="px-4 py-3 text-ink">{itemName(item)}</td>
                          <td className="px-4 py-3">
                            <SerialTag value={item.serial_number} />
                          </td>
                          <td className="px-4 py-3 text-ink-secondary">{item.departments?.label ?? "—"}</td>
                          <td className="px-4 py-3">
                            <Badge tone={itemStatusTone(item.item_statuses?.code)}>{item.item_statuses?.label ?? "—"}</Badge>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-ink-muted">{formatDate(item.created_at)}</td>
                          <td className="px-4 py-3">
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
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="divide-y divide-[color:var(--gridline)] sm:hidden">
                  {rows.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="flex w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-medium text-ink">{itemName(item)}</p>
                          <Badge tone={itemStatusTone(item.item_statuses?.code)}>{item.item_statuses?.label ?? "—"}</Badge>
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
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState
                title="No items found"
                hint="Try a different filter or search term."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            )}
          </Card>

          {listQuery.data ? (
            <Pagination page={page} pageSize={PAGE_SIZE} total={listQuery.data.total} onPageChange={setPage} itemLabel="items" />
          ) : null}
        </>
      )}

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
