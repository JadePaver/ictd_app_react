import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { repairItemsApi, usersApi } from "../../lib/resources";
import type { RepairItem } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Combobox } from "../../components/ui/Combobox";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { SnackbarStack, type SnackbarData } from "../../components/ui/Snackbar";
import { AlertTriangleIcon, CheckIcon, SearchIcon, XIcon } from "../../components/ui/icons";
import { repairStatusTone, toneTextClass } from "../../lib/statusStyles";
import { REPAIR_DONE_STATUS_IDS, REPAIR_STATUS, ROLE } from "../../lib/constants";
import { fullName, formatDateTime, formatDays } from "../../lib/format";
import { BookInModal } from "./BookInModal";
import { RepairDetailModal } from "./RepairDetailModal";

/**
 * A repair item isn't a decision like a technical request — it's a physical
 * object sitting in the shop, and the one question that actually matters is
 * "how long has this been on someone's bench." Grouping by technician (not a
 * status filter) mirrors how a shop floor is actually organized — each
 * person's own queue, oldest item first — and a dwell-time readout replaces
 * the plain "Received: date" column, since elapsed time is the signal, not
 * the date itself.
 */
type RepairGroup = {
  key: string;
  person: { first_name: string | null; last_name: string | null } | null;
  items: RepairItem[];
  /** Longest dwell among this bench's still-open items — null if none are
   * open (everything shown for this tech is already done). */
  oldestActiveDays: number | null;
};

function isDone(item: RepairItem): boolean {
  return item.status_id != null && REPAIR_DONE_STATUS_IDS.includes(item.status_id);
}

function dwellDays(item: RepairItem): number | null {
  if (!item.received_at) return null;
  const startMs = new Date(item.received_at).getTime();
  const endMs = item.released_at ? new Date(item.released_at).getTime() : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return (endMs - startMs) / 86_400_000;
}

function dwellTone(days: number): "good" | "warning" | "critical" {
  if (days >= 7) return "critical";
  if (days >= 3) return "warning";
  return "good";
}

const inputClass =
  "rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";

function GroupHeader({ group }: { group: RepairGroup }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[color:var(--gridline)] pb-1.5">
      <Avatar person={group.person} size={22} className="text-[10px]" />
      <h2 className="text-sm font-semibold text-ink">{group.person ? fullName(group.person) : "Unassigned"}</h2>
      <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-muted dark:bg-white/[0.1]">
        {group.items.length}
      </span>
      {group.oldestActiveDays != null ? (
        <span className={clsx("text-[11px] font-medium", toneTextClass(dwellTone(group.oldestActiveDays)))}>
          oldest {formatDays(group.oldestActiveDays)} in shop
        </span>
      ) : null}
    </div>
  );
}

function RepairRow({
  item,
  onOpen,
  quickAction,
}: {
  item: RepairItem;
  onOpen: () => void;
  quickAction: { label: string; pending: boolean; onClick: () => void } | null;
}) {
  const dwell = dwellDays(item);
  const done = isDone(item);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:border-series-1/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-series-1"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{item.item_name}</p>
        <p className="truncate text-xs text-ink-muted">
          {item.owner_user ? fullName(item.owner_user) : (item.owner ?? "No owner")}
          {item.serial_number ? ` · ${item.serial_number}` : ""}
        </p>
      </div>
      <Badge tone={repairStatusTone(item.status_id)}>{item.repair_statuses?.name ?? "Unknown"}</Badge>
      {dwell != null ? (
        <span
          className={clsx("hidden shrink-0 text-xs font-medium tabular-nums sm:inline", toneTextClass(dwellTone(dwell)))}
          title={formatDateTime(item.received_at)}
        >
          {formatDays(dwell)}
          {done ? "" : " in shop"}
        </span>
      ) : null}
      {quickAction ? (
        <Button
          variant="secondary"
          className="shrink-0 gap-1 px-2 py-1 text-xs"
          disabled={quickAction.pending}
          onClick={(e) => {
            e.stopPropagation();
            quickAction.onClick();
          }}
        >
          <CheckIcon size={12} />
          {quickAction.label}
        </Button>
      ) : null}
      <span className="shrink-0 text-ink-muted">→</span>
    </Card>
  );
}

export function RepairsListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [receivedBy, setReceivedBy] = useState<number | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showBookIn, setShowBookIn] = useState(false);
  const [toasts, setToasts] = useState<SnackbarData[]>([]);

  const techniciansQuery = useQuery({
    queryKey: ["users", "technicians"],
    queryFn: () => usersApi.list({ roleId: ROLE.OPERATOR, pageSize: 200 }),
  });

  const countsQuery = useQuery({
    queryKey: ["repair-items", "counts", { receivedBy }],
    queryFn: () => repairItemsApi.counts({ receivedBy }),
  });

  // A workbench view wants the whole current shop-floor state, not "page 3
  // of 10" — so this fetches a large unpaginated batch (see
  // RequestsListPage's board query for the same reasoning) instead of
  // paging. Sort direction flips with the filter: "active only" (the
  // default) is inherently a small set, so oldest-received-first is safe;
  // "include completed" can span the item's whole history, where
  // newest-first protects the 200-row budget from being spent on ancient
  // closed items instead of what's actually on the bench right now.
  const listQuery = useQuery({
    queryKey: ["repair-items", "workbench", { search, receivedBy, dateFrom, dateTo, includeCompleted }],
    queryFn: () =>
      repairItemsApi.list({
        status: includeCompleted ? "all" : "active",
        search: search || undefined,
        receivedBy,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: "receivedAt",
        sortDir: includeCompleted ? "desc" : "asc",
        page: 0,
        pageSize: 200,
      }),
  });

  function pushErrorToast(title: string, description: string) {
    setToasts((prev) => [{ id: Date.now() + Math.random(), title, description, icon: AlertTriangleIcon }, ...prev]);
  }

  const releaseMutation = useMutation({
    mutationFn: (id: number) => repairItemsApi.updateStatus(id, REPAIR_STATUS.RELEASED),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repair-items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => pushErrorToast("Couldn't release item", (error as Error).message),
  });

  function quickActionFor(item: RepairItem): { label: string; pending: boolean; onClick: () => void } | null {
    if (item.status_id !== REPAIR_STATUS.READY_FOR_RELEASE) return null;
    return {
      label: "Release",
      pending: releaseMutation.isPending && releaseMutation.variables === item.id,
      onClick: () => releaseMutation.mutate(item.id),
    };
  }

  const hasFilters = search !== "" || receivedBy != null || dateFrom !== "" || dateTo !== "" || includeCompleted;

  function clearFilters() {
    setSearch("");
    setReceivedBy(undefined);
    setDateFrom("");
    setDateTo("");
    setIncludeCompleted(false);
  }

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);

  const groups = useMemo<RepairGroup[]>(() => {
    const map = new Map<string, RepairGroup>();
    for (const item of rows) {
      const key = item.received_by != null ? String(item.received_by) : "unassigned";
      let group = map.get(key);
      if (!group) {
        group = { key, person: item.received_by_user, items: [], oldestActiveDays: null };
        map.set(key, group);
      }
      group.items.push(item);
    }
    const list = [...map.values()];
    for (const group of list) {
      group.items.sort((a, b) => {
        const aDone = isDone(a);
        const bDone = isDone(b);
        if (aDone !== bDone) return aDone ? 1 : -1;
        if (!aDone) return new Date(a.received_at ?? a.created_at).getTime() - new Date(b.received_at ?? b.created_at).getTime();
        return (
          new Date(b.released_at ?? b.updated_at ?? b.created_at).getTime() -
          new Date(a.released_at ?? a.updated_at ?? a.created_at).getTime()
        );
      });
      for (const item of group.items) {
        if (isDone(item)) continue;
        const d = dwellDays(item);
        if (d != null && (group.oldestActiveDays == null || d > group.oldestActiveDays)) group.oldestActiveDays = d;
      }
    }
    // Most-neglected bench first — the technician whose oldest open item has
    // waited longest surfaces at the top, ahead of one with a smaller but
    // busier queue.
    list.sort((a, b) => (b.oldestActiveDays ?? -1) - (a.oldestActiveDays ?? -1));
    return list;
  }, [rows]);

  const hiddenDone = !includeCompleted ? countsQuery.data?.data.done : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Repair Items</h1>
          <p className="text-sm text-ink-muted">Grouped by technician — the oldest item on each bench surfaces first.</p>
        </div>
        <Button onClick={() => setShowBookIn(true)}>Book in item</Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item name, owner, serial number…"
            className={`${inputClass} w-full pl-8`}
          />
        </div>
        <Combobox
          value={receivedBy}
          onChange={setReceivedBy}
          options={(techniciansQuery.data?.data ?? []).map((u) => ({ value: u.id, label: fullName(u) }))}
          placeholder="All technicians"
          className="w-44"
        />
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor="repairs-date-from">
            From
          </label>
          <input id="repairs-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          <label className="text-xs text-ink-muted" htmlFor="repairs-date-to">
            To
          </label>
          <input id="repairs-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </div>
        <label className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border-hairline)] px-3 py-2 text-sm text-ink-secondary">
          <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} />
          Include completed
          {hiddenDone ? <span className="text-xs text-ink-muted">({hiddenDone} hidden)</span> : null}
        </label>
        {hasFilters ? (
          <Button variant="ghost" onClick={clearFilters} className="gap-1.5">
            <XIcon size={14} />
            Clear filters
          </Button>
        ) : null}
      </div>

      {listQuery.isLoading ? (
        <div className="flex flex-col gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="h-5 w-32 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="h-14 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.06]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : listQuery.isError ? (
        <ErrorState message={(listQuery.error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No repair items found" : "No repair items yet"}
          hint={hasFilters ? "Try a different filter or search term." : "Booked-in items will show up here."}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <GroupHeader group={group} />
              <div className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <RepairRow key={item.id} item={item} onOpen={() => setSelectedId(item.id)} quickAction={quickActionFor(item)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedId != null ? <RepairDetailModal id={selectedId} onClose={() => setSelectedId(null)} /> : null}
      {showBookIn ? <BookInModal onClose={() => setShowBookIn(false)} /> : null}

      {/* `md:left-60` matches DashboardLayout's sidebar width so the stack
          centers within the main content area only, not the whole viewport. */}
      <SnackbarStack items={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} className="md:left-60" />
    </div>
  );
}
