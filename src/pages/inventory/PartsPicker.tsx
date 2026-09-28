import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { AlertTriangleIcon, CheckIcon, XIcon } from "../../components/ui/icons";
import { inventoryItemsApi, referenceApi } from "../../lib/resources";
import { PART_CATEGORY_ORDER, itemDisplayName, partBlockReason } from "../../lib/inventory";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import type { InventoryItem } from "../../types/api";
import { CategoryTag, CategoryTile, ParTag, SerialTag } from "./InventoryAtoms";

const PAGE = 60;

/** Reads a scanned label: `ICTD INVENTORY #216` on its first line, else the
 * `Serial:` line (context doc 12.1). */
function readLabel(text: string): { id?: number; serial?: string } | null {
  const id = /ICTD INVENTORY #(\d+)/i.exec(text);
  if (id) return { id: Number(id[1]) };
  const serial = /^\s*Serial:\s*(.+)$/im.exec(text);
  if (serial) return { serial: serial[1].trim() };
  return null;
}

/**
 * The parts picker shared by Assemble PC (F5) and Manage parts (F6). Search
 * by serial, model or PAR; filter by part type with in-storage counts. Parts
 * that can't go in stay listed, disabled, with the reason as their tag, so
 * "where is that GPU?" answers itself. A USB scanner works too: scan a label
 * into the search box and Enter adds that part, or says why it can't.
 */
export function PartsPicker({
  selected,
  onChange,
  hostId,
  disabled,
}: {
  selected: InventoryItem[];
  onChange: (items: InventoryItem[]) => void;
  /** Manage parts: this PC. Its own parts are left out of the list. */
  hostId?: number;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [scanMessage, setScanMessage] = useState<{ tone: "good" | "critical"; text: string } | null>(null);
  const debounced = useDebouncedValue(search.trim());
  const labelScan = readLabel(search);

  const categoriesQuery = useQuery({ queryKey: ["reference", "item-categories"], queryFn: referenceApi.itemCategories });
  const statusesQuery = useQuery({ queryKey: ["reference", "item-statuses"], queryFn: referenceApi.itemStatuses });
  const inStorageId = statusesQuery.data?.data.find((s) => s.code === "in_storage")?.id;
  const partCategories = useMemo(
    () =>
      (categoriesQuery.data?.data ?? [])
        .filter((c) => c.is_part)
        .sort((a, b) => PART_CATEGORY_ORDER.indexOf(a.code) - PART_CATEGORY_ORDER.indexOf(b.code)),
    [categoriesQuery.data],
  );

  // Chip counts: loose parts in storage, not on an MR. What could go in now.
  const countsQuery = useQuery({
    queryKey: ["inventory-items", "summary", { kind: "part", placement: "loose", availability: "available", statusId: inStorageId }],
    queryFn: () => inventoryItemsApi.summary({ kind: "part", placement: "loose", availability: "available", statusId: inStorageId }),
    enabled: inStorageId != null,
  });
  const countFor = (id?: number) => {
    const rows = countsQuery.data?.data.byCategory ?? [];
    return id == null ? rows.filter((r) => r.is_part).reduce((n, r) => n + r.count, 0) : (rows.find((r) => r.id === id)?.count ?? 0);
  };

  const listParams = { kind: "part" as const, categoryId, search: labelScan ? undefined : debounced || undefined, pageSize: PAGE, sortBy: "createdAt" as const };
  const listQuery = useQuery({
    queryKey: ["inventory-items", "list", "parts-picker", listParams],
    queryFn: () => inventoryItemsApi.list(listParams),
    placeholderData: keepPreviousData,
  });

  const selectedIds = new Set(selected.map((p) => p.id));
  const rows = useMemo(() => {
    const list = (listQuery.data?.data ?? []).filter((item) => hostId == null || item.installed_in_item_id !== hostId);
    // Pickable parts first; the rest keep their order below.
    return [...list].sort((a, b) => Number(partBlockReason(a, hostId) != null) - Number(partBlockReason(b, hostId) != null));
  }, [listQuery.data, hostId]);
  const total = listQuery.data?.total ?? 0;

  function toggle(item: InventoryItem) {
    if (disabled) return;
    if (selectedIds.has(item.id)) onChange(selected.filter((p) => p.id !== item.id));
    else if (!partBlockReason(item, hostId)) onChange([...selected, item]);
  }

  async function addScanned() {
    const scan = readLabel(search) ?? { serial: search.trim() };
    if (!scan.id && !scan.serial) return;
    let item: InventoryItem | undefined;
    try {
      if (scan.id) {
        item = (await queryClient.fetchQuery({ queryKey: ["inventory-items", scan.id], queryFn: () => inventoryItemsApi.get(scan.id!) })).data;
      } else {
        const exact = rows.find((r) => r.serial_number.toUpperCase() === scan.serial!.toUpperCase());
        item =
          exact ??
          (await inventoryItemsApi.list({ search: scan.serial, pageSize: 5 })).data.find(
            (r) => r.serial_number.toUpperCase() === scan.serial!.toUpperCase(),
          );
      }
    } catch {
      item = undefined;
    }
    if (!item) {
      setScanMessage({ tone: "critical", text: readLabel(search) ? "No item with this label number." : "Not an ICTD inventory label" });
      return;
    }
    if (selectedIds.has(item.id)) {
      setScanMessage({ tone: "good", text: `${itemDisplayName(item)} is already picked.` });
      setSearch("");
      return;
    }
    const blocked = partBlockReason(item, hostId);
    if (blocked) {
      setScanMessage({ tone: "critical", text: blocked.message });
      return;
    }
    onChange([...selected, item]);
    setScanMessage({ tone: "good", text: `Added ${itemDisplayName(item)}.` });
    setSearch("");
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Picked parts">
          {selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-series-1/40 bg-series-1/[0.07] py-0.5 pr-1 pl-2 text-xs text-ink"
            >
              <CategoryTag label={p.item_categories?.code?.toUpperCase()} className="bg-transparent px-0" />
              <span className="truncate">{itemDisplayName(p)}</span>
              <span className="font-mono text-[10px] text-ink-muted">{p.serial_number}</span>
              <button
                type="button"
                onClick={() => toggle(p)}
                aria-label={`Remove ${itemDisplayName(p)}`}
                className="rounded-full p-0.5 text-ink-muted hover:bg-black/[0.06] hover:text-ink dark:hover:bg-white/[0.1]"
              >
                <XIcon size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void addScanned();
          }
        }}
      >
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setScanMessage(null);
          }}
          placeholder="Search serial, model or PAR, or scan a label"
          ariaLabel="Search parts"
        />
      </div>
      {scanMessage ? (
        <p
          role="status"
          className={clsx("-mt-1 flex items-start gap-1.5 text-xs font-medium", scanMessage.tone === "good" ? "text-good" : "text-critical")}
        >
          {scanMessage.tone === "good" ? <CheckIcon size={13} className="mt-px shrink-0" /> : <AlertTriangleIcon size={13} className="mt-px shrink-0" />}
          {scanMessage.text}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter parts by type">
        {[{ id: undefined as number | undefined, label: "All" }, ...partCategories.map((c) => ({ id: c.id as number | undefined, label: c.code.toUpperCase() === "STORAGE" ? "Storage" : c.code.toUpperCase() }))].map(
          (chip) => {
            const active = categoryId === chip.id;
            return (
              <button
                key={chip.label}
                type="button"
                aria-pressed={active}
                onClick={() => setCategoryId(chip.id)}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  active ? "bg-series-1 text-white" : "border border-[color:var(--border-hairline)] text-ink-secondary hover:text-ink",
                )}
              >
                {chip.label}
                <span
                  className={clsx("rounded-full px-1.5 text-[10px] font-semibold tabular-nums", active ? "bg-white/25" : "bg-black/[0.06] dark:bg-white/[0.1]")}
                  title="In storage, ready to install"
                >
                  {countsQuery.data ? countFor(chip.id) : "·"}
                </span>
              </button>
            );
          },
        )}
      </div>

      <div className={clsx("overflow-hidden rounded-lg border border-[color:var(--border-hairline)]", listQuery.isPlaceholderData && "opacity-60")}>
        {listQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            {debounced ? "No parts match this search." : "No parts on record yet. Register CPUs, GPUs, RAM or storage first."}
          </p>
        ) : (
          <ul className="max-h-[26rem] divide-y divide-[color:var(--gridline)] overflow-y-auto">
            {rows.map((item) => {
              const picked = selectedIds.has(item.id);
              const blocked = partBlockReason(item, hostId);
              const off = !!blocked && !picked;
              return (
                <li key={item.id}>
                  <label
                    title={off ? blocked!.message : undefined}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2",
                      off ? "cursor-not-allowed" : "cursor-pointer hover:bg-black/[0.025] dark:hover:bg-white/[0.04]",
                      picked && "bg-series-1/[0.06]",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={picked}
                      disabled={off || disabled}
                      onChange={() => toggle(item)}
                      className="h-4 w-4 shrink-0 accent-[var(--series-1)]"
                    />
                    <CategoryTile code={item.item_categories?.code} size={28} className={off ? "opacity-50" : undefined} />
                    <span className={clsx("min-w-0 flex-1", off && "opacity-60")}>
                      <span className="block truncate text-sm font-medium text-ink">{itemDisplayName(item)}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <SerialTag value={item.serial_number} />
                        {item.par ? <ParTag code={item.par.par_code} /> : null}
                      </span>
                    </span>
                    {blocked ? (
                      <span className="shrink-0 rounded-full border border-[color:var(--border-hairline)] px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-ink-muted">
                        {blocked.tag}
                      </span>
                    ) : (
                      <CategoryTag label={item.item_categories?.code === "storage" ? "Storage" : item.item_categories?.code} />
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {total > rows.length && rows.length >= PAGE - 5 ? (
          <p className="border-t border-[color:var(--gridline)] px-3 py-2 text-xs text-ink-muted">
            Showing the newest {rows.length} of {total}. Search to narrow down.
          </p>
        ) : null}
      </div>
    </div>
  );
}
