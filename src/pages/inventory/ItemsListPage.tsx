import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { inventoryItemsApi, parsApi, referenceApi, type InventorySortBy, type SortDir } from "../../lib/resources";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { SortableTh } from "../../components/ui/SortableTh";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { PageHeader } from "../../components/ui/PageHeader";
import { AlertBanner } from "../../components/ui/AlertBanner";
import { SearchInput } from "../../components/ui/SearchInput";
import { FilterTabs, type FilterTab } from "../../components/ui/FilterTabs";
import { useToast } from "../../components/ui/toastContext";
import { ChevronRightIcon, InfoIcon, LayersIcon, PlusIcon, QrCodeIcon, ReceiptIcon, TowerIcon, WarehouseIcon, XIcon } from "../../components/ui/icons";
import { itemStatusTone, type Tone } from "../../lib/statusStyles";
import { formatDateMedium } from "../../lib/format";
import { ITEM_STATUS_ORDER, groupCategories, itemDisplayName, officeName } from "../../lib/inventory";
import { isOverdue } from "../../lib/mrMetrics";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import type { InventoryItem, ItemAvailability, Par, Placement } from "../../types/api";
import { ItemDetailModal } from "./ItemDetailModal";
import { InventoryItemQrModal } from "./InventoryItemQrModal";
import { RegisterItemsModal } from "./RegisterItemsModal";
import { AssemblePcModal } from "./AssemblePcModal";
import { AssignParModal } from "./AssignParModal";
import { ParFormModal, type RegisterMode } from "./ParFormModal";
import { ParDetailModal } from "./ParDetailModal";
import { CategoryGlyph, CategoryTile, DueLabel, ItemStatusBadge, Office, ParTag, PersonLine, PlacementChip, SerialTag } from "./InventoryAtoms";

type Density = "comfortable" | "compact";

/** Compact rows are half the height, so the same screen holds twice the
 * page before anyone reaches for the pager. */
const PAGE_SIZE: Record<Density, number> = { comfortable: 15, compact: 30 };
const CELL_PAD: Record<Density, string> = { comfortable: "px-4 py-3", compact: "px-4 py-1.5" };

const PREFS_KEY = "ictd-inventory-prefs";
const SORT_FIELDS: InventorySortBy[] = ["createdAt", "updatedAt", "serialNumber", "brand", "status"];
const AVAILABILITY: ItemAvailability[] = ["all", "available", "issued"];
const PLACEMENTS: Exclude<Placement, "all">[] = ["top_level", "loose", "installed", "host"];
const PLACEMENT_LABEL: Record<Exclude<Placement, "all">, string> = {
  top_level: "Top-level",
  loose: "Loose",
  installed: "Installed",
  host: "PCs with parts",
};
/** The PAR filter's "No PAR" choice. PAR ids are positive. */
const NO_PAR = -1;

interface StoredPrefs {
  categoryId?: number;
  statusId?: number;
  departmentId?: number;
  availability?: ItemAvailability;
  placement?: Exclude<Placement, "all">;
  parId?: number;
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
      availability: AVAILABILITY.includes(p.availability as ItemAvailability) ? p.availability : undefined,
      placement: PLACEMENTS.includes(p.placement as Exclude<Placement, "all">) ? p.placement : undefined,
      parId: typeof p.parId === "number" ? p.parId : undefined,
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

/** Status as a left edge stripe, so condition is scannable straight down the
 * table without reading a badge. Neutral keeps a transparent border, or
 * unremarkable rows would sit 2px left of the rest. */
function stripeClass(tone: Tone): string {
  switch (tone) {
    case "critical":
      return "border-l-critical";
    case "warning":
      return "border-l-warning";
    case "accent":
      return "border-l-series-1";
    default:
      return "border-l-transparent";
  }
}

function toneColor(tone: Tone): string {
  switch (tone) {
    case "critical":
      return "var(--status-critical)";
    case "warning":
      return "var(--status-warning)";
    case "accent":
      return "var(--series-1)";
    default:
      return "var(--text-muted)";
  }
}

/** Who holds the item right now, or that it is with ICTD. The answer to the
 * question operators most often open an item for, surfaced in the row. */
/** Under an item's name: "4 parts" for a PC holding parts, "In PC #223"
 * for an installed part, else its category. Placement never takes a status
 * colour (context doc v2, 5.3). */
function ItemMeta({ item, onOpenItem }: { item: InventoryItem; onOpenItem?: (id: number) => void }) {
  const category = item.is_assembled ? "Assembled PC" : (item.item_categories?.label ?? "Uncategorized");
  if (item.installed_in_item_id) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{category}</span>
        <PlacementChip hostId={item.installed_in_item_id} label={`In PC #${item.installed_in_item_id}`} onOpen={onOpenItem} />
      </span>
    );
  }
  if (item.partCount) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{category}</span>
        <span className="inline-flex items-center gap-1 text-ink-secondary">
          <LayersIcon size={11} />
          {item.partCount} part{item.partCount === 1 ? "" : "s"}
        </span>
      </span>
    );
  }
  return <span className="truncate">{category}</span>;
}

function HolderCell({ item, compact }: { item: InventoryItem; compact?: boolean }) {
  const custody = item.currentCustody;
  if (!custody) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
        <WarehouseIcon size={14} />
        With ICTD
      </span>
    );
  }
  const due = { status: "active", expected_return_at: custody.expectedReturnAt };
  return (
    <PersonLine
      person={custody.custodian}
      size={compact ? 22 : 26}
      sub={
        compact ? undefined : (
          <span className="flex items-center gap-1.5">
            <span className="font-mono">{custody.mrNumber}</span>
            {custody.via ? <span>via PC #{custody.via.id}</span> : null}
            {isOverdue(due) ? <DueLabel mr={due} hideIcon /> : null}
          </span>
        )
      }
    />
  );
}

export function ItemsListPage() {
  const toast = useToast();
  const [prefs] = useState(readPrefs);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(prefs.categoryId);
  const [statusId, setStatusId] = useState<number | undefined>(prefs.statusId);
  const [departmentId, setDepartmentId] = useState<number | undefined>(prefs.departmentId);
  const [availability, setAvailability] = useState<ItemAvailability>(prefs.availability ?? "all");
  const [placement, setPlacement] = useState<Exclude<Placement, "all">>(prefs.placement ?? "top_level");
  const [parFilter, setParFilter] = useState<number | undefined>(prefs.parId);
  const [sortBy, setSortBy] = useState<InventorySortBy>(prefs.sortBy ?? "createdAt");
  const [sortDir, setSortDir] = useState<SortDir>(prefs.sortDir ?? "desc");
  const [density, setDensity] = useState<Density>(prefs.density ?? "comfortable");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [register, setRegister] = useState<{ mode: RegisterMode; par?: Par } | null>(null);
  const [showAssemble, setShowAssemble] = useState(false);
  const [showNewPar, setShowNewPar] = useState(false);
  const [showAssignPar, setShowAssignPar] = useState(false);
  const [openParId, setOpenParId] = useState<number | null>(null);
  const [qrItem, setQrItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ categoryId, statusId, departmentId, availability, placement, parId: parFilter, sortBy, sortDir, density }),
      );
    } catch {
      // Quota or a blocked store: persistence is a convenience, not a
      // requirement, so a failed write is not worth surfacing.
    }
  }, [categoryId, statusId, departmentId, availability, placement, parFilter, sortBy, sortDir, density]);

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const parsQuery = useQuery({
    queryKey: ["pars", "list", { sortBy: "dateReceived", pageSize: 200 }],
    queryFn: () => parsApi.list({ sortBy: "dateReceived", sortDir: "desc", pageSize: 200 }),
  });

  const debouncedSearch = useDebouncedValue(search.trim());
  const filters = {
    search: debouncedSearch || undefined,
    categoryId,
    statusId,
    departmentId,
    availability: availability === "all" ? undefined : availability,
    placement,
    parId: parFilter === NO_PAR ? ("none" as const) : parFilter,
  };
  const pageSize = PAGE_SIZE[density];
  const hasFilters =
    !!filters.search ||
    categoryId != null ||
    statusId != null ||
    departmentId != null ||
    availability !== "all" ||
    placement !== "top_level" ||
    parFilter != null;

  // Facets honour every filter but their own, so the tabs and chips always
  // say what picking them would show.
  const summaryQuery = useQuery({
    queryKey: ["inventory-items", "summary", filters],
    queryFn: () => inventoryItemsApi.summary(filters),
    placeholderData: keepPreviousData,
  });
  const overallQuery = useQuery({
    queryKey: ["inventory-items", "summary", {}],
    queryFn: () => inventoryItemsApi.summary(),
  });
  const installedQuery = useQuery({
    queryKey: ["inventory-items", "summary", { placement: "installed" }],
    queryFn: () => inventoryItemsApi.summary({ placement: "installed" }),
  });

  const listQuery = useQuery({
    queryKey: ["inventory-items", "list", { ...filters, sortBy, sortDir, page, pageSize }],
    queryFn: () => inventoryItemsApi.list({ ...filters, sortBy, sortDir, page, pageSize }),
    placeholderData: keepPreviousData,
  });

  const summary = summaryQuery.data?.data;
  const overall = overallQuery.data?.data;
  const missingStatus = overall?.byStatus.find((s) => s.code === "missing");

  const statusTabs: FilterTab<number>[] = useMemo(() => {
    const byCode = new Map((summary?.byStatus ?? []).map((s) => [s.code, s]));
    const ordered = [
      ...ITEM_STATUS_ORDER.map((code) => byCode.get(code)).filter((s): s is NonNullable<typeof s> => !!s),
      ...(summary?.byStatus ?? []).filter((s) => !ITEM_STATUS_ORDER.includes(s.code)),
    ];
    // Status facet counts ignore the status filter, so their sum is exactly
    // what "All" would show under everything else.
    const all = (summary?.byStatus ?? []).reduce((n, s) => n + s.count, 0);
    return [
      { value: 0, label: "All items", count: summary ? all : undefined },
      ...ordered.map((s) => ({
        value: s.id,
        label: s.label,
        count: s.count,
        dot: toneColor(itemStatusTone(s.code)),
        alert: s.code === "missing" ? ("critical" as const) : undefined,
      })),
    ];
  }, [summary]);

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }

  function clearFilters() {
    setSearch("");
    setCategoryId(undefined);
    setStatusId(undefined);
    setDepartmentId(undefined);
    setAvailability("all");
    setPlacement("top_level");
    setParFilter(undefined);
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

  const rows = listQuery.data?.data ?? [];
  const cellPad = CELL_PAD[density];
  const compact = density === "compact";

  const installedCount = installedQuery.data?.data.total ?? 0;
  const headerLine = overall
    ? [
        `${overall.total} item${overall.total === 1 ? "" : "s"}`,
        installedCount > 0 ? `${installedCount} inside PCs` : null,
        `${overall.issued} out on MRs`,
        overall.missing.count > 0 ? `${overall.missing.count} missing` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Computers and computer parts on record, by serial number.";

  const departmentOptions = useMemo(
    () => (departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: officeName(d) })),
    [departmentsQuery.data],
  );
  const parOptions = useMemo(
    () => [
      { value: NO_PAR, label: "No PAR (registered before PARs)" },
      ...(parsQuery.data?.data ?? []).map((p) => ({ value: p.id, label: p.supplier ? `${p.par_code} · ${p.supplier}` : p.par_code })),
    ],
    [parsQuery.data],
  );
  const categoryGroups = groupCategories(summary?.byCategory ?? []);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Inventory"
        description={headerLine}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowNewPar(true)}>
              <ReceiptIcon size={15} />
              New PAR
            </Button>
            <Button variant="secondary" onClick={() => setShowAssemble(true)}>
              <TowerIcon size={15} />
              Assemble PC
            </Button>
            <Button onClick={() => setRegister({ mode: "single" })}>
              <PlusIcon size={15} />
              Register items
            </Button>
          </>
        }
      />

      {overall && overall.missing.count > 0 && statusId !== missingStatus?.id ? (
        <AlertBanner
          title={`${overall.missing.count} item${overall.missing.count === 1 ? "" : "s"} marked missing`}
          action={
            <Button
              variant="danger"
              onClick={() => {
                setCategoryId(undefined);
                setStatusId(missingStatus?.id);
                setAvailability("all");
                setPlacement("top_level");
                setPage(0);
              }}
            >
              Review
            </Button>
          }
        >
          Missing equipment is a liability until it is found or written off.{" "}
          <span className="font-mono text-xs">
            {overall.missing.serials.join(", ")}
            {overall.missing.count > overall.missing.serials.length ? ", …" : ""}
          </span>
        </AlertBanner>
      ) : null}

      {overall && overall.withoutPar > 0 && parFilter !== NO_PAR ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[color:var(--border-hairline)] bg-surface px-4 py-2.5">
          <InfoIcon size={16} className="shrink-0 text-ink-muted" />
          <p className="min-w-[15rem] flex-1 text-sm text-ink-secondary">
            <span className="font-medium text-ink">
              {overall.withoutPar} item{overall.withoutPar === 1 ? " was" : "s were"} registered before PARs.
            </span>{" "}
            Link them to their delivery when you know it.
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="px-2.5 py-1 text-xs"
              onClick={() => {
                setParFilter(NO_PAR);
                setPage(0);
              }}
            >
              Show them
            </Button>
            <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => setShowAssignPar(true)}>
              Assign PAR
            </Button>
          </div>
        </div>
      ) : null}

      <FilterTabs
        variant="cards"
        ariaLabel="Filter by item status"
        tabs={statusTabs}
        value={statusId ?? 0}
        onChange={(v) => resetPage(setStatusId)(v === 0 ? undefined : v)}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={resetPage(setSearch)}
            placeholder="Search serial number, brand, model…"
            shortcut
            className="min-w-56 flex-1"
          />
          <Combobox
            value={departmentId}
            onChange={resetPage(setDepartmentId)}
            options={departmentOptions}
            placeholder="Any owning office"
            ariaLabel="Owning office"
            className="w-56"
          />
          <Combobox
            value={parFilter}
            onChange={resetPage(setParFilter)}
            options={parOptions}
            placeholder="Any PAR"
            ariaLabel="PAR"
            className="w-56"
          />
          <div
            role="radiogroup"
            aria-label="Custody"
            className="flex items-center gap-0.5 rounded-lg border border-[color:var(--border-hairline)] bg-surface p-0.5"
          >
            {(
              [
                ["all", "Any custody"],
                ["available", "With ICTD"],
                ["issued", "On an MR"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={availability === value}
                onClick={() => resetPage(setAvailability)(value)}
                className={clsx(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  availability === value
                    ? "bg-series-1 text-white"
                    : "text-ink-muted hover:bg-black/[0.04] hover:text-ink dark:hover:bg-white/[0.06]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            role="radiogroup"
            aria-label="Placement"
            className="flex items-center gap-0.5 rounded-lg border border-[color:var(--border-hairline)] bg-surface p-0.5"
          >
            {PLACEMENTS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={placement === value}
                onClick={() => resetPage(setPlacement)(value)}
                title={
                  value === "top_level"
                    ? "Everything not inside a PC: loose items and PCs"
                    : value === "loose"
                      ? "Not inside a PC and holding no parts"
                      : value === "installed"
                        ? "Parts inside a PC"
                        : "PCs holding at least one part"
                }
                className={clsx(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  placement === value
                    ? "bg-black/[0.07] text-ink dark:bg-white/[0.12]"
                    : "text-ink-muted hover:bg-black/[0.04] hover:text-ink dark:hover:bg-white/[0.06]",
                )}
              >
                {PLACEMENT_LABEL[value]}
              </button>
            ))}
          </div>
          {hasFilters ? (
            <Button variant="ghost" onClick={clearFilters} className="gap-1.5">
              <XIcon size={14} />
              Clear
            </Button>
          ) : null}
          {/* Spelled out rather than iconified: a bare pair of glyphs here is
              exactly the kind of control nobody finds. */}
          <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-[color:var(--border-hairline)] bg-surface p-0.5">
            {(["comfortable", "compact"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  // Page index is a slice of a specific page size, so
                  // switching density would land "page 3" somewhere unrelated.
                  setDensity(d);
                  setPage(0);
                }}
                aria-pressed={density === d}
                className={clsx(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                  density === d ? "bg-black/[0.07] text-ink dark:bg-white/[0.12]" : "text-ink-muted hover:text-ink",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Categories as one wrapping chip row: same counts as a wall of
            tiles for a tenth of the height, and the active category stays in
            view while you read the table it filtered. */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by category">
          <CategoryChip
            label="All categories"
            active={categoryId == null}
            count={summary ? summary.byCategory.reduce((n, c) => n + c.count, 0) : undefined}
            onClick={() => resetPage(setCategoryId)(undefined)}
          />
          {categoryGroups.units.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.label}
              code={c.code}
              count={c.count}
              active={categoryId === c.id}
              onClick={() => resetPage(setCategoryId)(categoryId === c.id ? undefined : c.id)}
            />
          ))}
          {categoryGroups.parts.length > 0 ? (
            <span className="mx-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase" aria-hidden="true">
              <span className="h-4 w-px bg-[color:var(--border-hairline)]" />
              Parts
            </span>
          ) : null}
          {categoryGroups.parts.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.label}
              code={c.code}
              count={c.count}
              active={categoryId === c.id}
              onClick={() => resetPage(setCategoryId)(categoryId === c.id ? undefined : c.id)}
            />
          ))}
        </div>
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
                    <SortableTh field="brand" activeField={sortBy} dir={sortDir} onSort={toggleSort} className="border-l-2 border-l-transparent">
                      Item
                    </SortableTh>
                    <SortableTh field="serialNumber" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Serial #
                    </SortableTh>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">PAR</th>
                    <SortableTh field="status" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Status
                    </SortableTh>
                    <th className="px-4 py-3 font-medium">Custodian</th>
                    <th className="hidden px-4 py-3 font-medium 2xl:table-cell">Owning office</th>
                    <SortableTh field="createdAt" activeField={sortBy} dir={sortDir} onSort={toggleSort} className="hidden 2xl:table-cell">
                      Added
                    </SortableTh>
                    <th className="w-20 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const tone = itemStatusTone(item.item_statuses?.code);
                    return (
                      <tr
                        key={item.id}
                        className="group cursor-pointer border-b border-[color:var(--gridline)] last:border-0 hover:bg-black/[0.02] focus-visible:bg-black/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-series-1 dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.04]"
                        onClick={() => setSelectedId(item.id)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(item.id);
                          }
                        }}
                      >
                        <td className={clsx("border-l-2", cellPad, stripeClass(tone))}>
                          <div className="flex min-w-0 items-center gap-3">
                            <CategoryTile code={item.item_categories?.code} assembled={item.is_assembled} size={compact ? 26 : 34} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{itemDisplayName(item)}</p>
                              {compact && !item.installed_in_item_id && !item.partCount ? null : (
                                <div className="text-xs text-ink-muted">
                                  <ItemMeta item={item} onOpenItem={setSelectedId} />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={cellPad}>
                          <SerialTag value={item.serial_number} />
                        </td>
                        <td className={clsx("hidden lg:table-cell", cellPad)}>
                          {item.par ? (
                            <ParTag code={item.par.par_code} onClick={() => setOpenParId(item.par!.id)} />
                          ) : (
                            <span className="text-xs text-ink-muted">{item.is_assembled ? "Assembled" : "None"}</span>
                          )}
                        </td>
                        <td className={cellPad}>
                          <ItemStatusBadge status={item.item_statuses} />
                        </td>
                        <td className={clsx("max-w-[15rem]", cellPad)}>
                          <HolderCell item={item} compact={compact} />
                        </td>
                        <td className={clsx("hidden max-w-[14rem] text-ink-secondary 2xl:table-cell", cellPad)}>
                          <Office dept={item.departments} className="block" />
                        </td>
                        <td className={clsx("hidden whitespace-nowrap text-ink-muted tabular-nums 2xl:table-cell", cellPad)}>
                          {formatDateMedium(item.created_at)}
                        </td>
                        <td className={cellPad}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="QR label"
                              aria-label={`QR label for ${item.serial_number}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setQrItem(item);
                              }}
                              className="rounded-md p-1.5 text-ink-muted opacity-60 transition hover:bg-black/[0.04] hover:text-ink group-hover:opacity-100 dark:hover:bg-white/[0.06]"
                            >
                              <QrCodeIcon size={15} />
                            </button>
                            <ChevronRightIcon size={15} className="text-ink-muted" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[color:var(--gridline)] md:hidden">
              {rows.map((item) => {
                const tone = itemStatusTone(item.item_statuses?.code);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={clsx(
                        "flex w-full gap-3 border-l-2 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                        stripeClass(tone),
                      )}
                    >
                      <CategoryTile code={item.item_categories?.code} assembled={item.is_assembled} size={36} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-medium text-ink">{itemDisplayName(item)}</p>
                          <ItemStatusBadge status={item.item_statuses} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                          <SerialTag value={item.serial_number} />
                          {/* The whole card is a button already, so no link inside it. */}
                          <ItemMeta item={item} />
                          {item.par ? <span className="font-mono text-[11px]">{item.par.par_code}</span> : null}
                        </div>
                        <HolderCell item={item} compact />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : hasFilters ? (
          <EmptyState
            title="No items match"
            hint="Try a different search, or clear the filters."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={WarehouseIcon}
            title="No items on record yet"
            hint="Record the delivery's PAR, then register what came in it."
            action={
              <Button onClick={() => setRegister({ mode: "single" })}>
                <PlusIcon size={15} />
                Register items
              </Button>
            }
          />
        )}
      </Card>

      {listQuery.data ? (
        <Pagination page={page} pageSize={pageSize} total={listQuery.data.total} onPageChange={setPage} itemLabel="items" />
      ) : null}

      {register ? (
        <RegisterItemsModal
          initialMode={register.mode}
          initialPar={register.par}
          onClose={() => setRegister(null)}
          onOpenItem={setSelectedId}
          onRegistered={(items) =>
            toast({
              title: `${items.length} item${items.length === 1 ? "" : "s"} registered`,
              description: items.length === 1 ? `${itemDisplayName(items[0])} · ${items[0].serial_number}` : items[0].par?.par_code ? `Under ${items[0].par.par_code}` : undefined,
            })
          }
        />
      ) : null}
      {showAssemble ? (
        <AssemblePcModal
          onClose={() => setShowAssemble(false)}
          onCreated={(pc, parts) =>
            toast({ title: `PC #${pc.id} assembled`, description: `${pc.serial_number} · ${parts.length} part${parts.length === 1 ? "" : "s"} installed` })
          }
        />
      ) : null}
      {showNewPar ? (
        <ParFormModal
          onClose={() => setShowNewPar(false)}
          onRegister={(par, mode) => {
            setShowNewPar(false);
            setRegister({ mode, par });
          }}
        />
      ) : null}
      {showAssignPar ? <AssignParModal onClose={() => setShowAssignPar(false)} /> : null}
      {openParId != null ? <ParDetailModal id={openParId} onClose={() => setOpenParId(null)} onOpenItem={setSelectedId} /> : null}
      {selectedId != null ? <ItemDetailModal id={selectedId} onClose={() => setSelectedId(null)} /> : null}
      {qrItem ? <InventoryItemQrModal item={qrItem} onClose={() => setQrItem(null)} /> : null}
    </div>
  );
}

function CategoryChip({
  label,
  code,
  count,
  active,
  onClick,
}: {
  label: string;
  code?: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  const empty = count === 0 && !active;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-series-1 text-white"
          : "border border-[color:var(--border-hairline)] bg-surface text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
        empty && "opacity-50",
      )}
    >
      {code ? <CategoryGlyph code={code} size={14} className={active ? "text-white" : "text-ink-muted"} /> : null}
      {label}
      {count != null ? (
        <span
          className={clsx(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-white/25" : "bg-black/[0.06] dark:bg-white/[0.1]",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
