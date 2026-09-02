import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { referenceApi, technicalRequestsApi } from "../../lib/resources";
import type { TechnicalRequest } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Combobox } from "../../components/ui/Combobox";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { SnackbarStack, type SnackbarData } from "../../components/ui/Snackbar";
import { AlertTriangleIcon, CheckIcon, SearchIcon, XIcon } from "../../components/ui/icons";
import { requestStatusTone, toneDotClass } from "../../lib/statusStyles";
import { REQUEST_STATUS } from "../../lib/constants";
import { fullName, formatDateTime, formatHours, formatRelativeDateTime } from "../../lib/format";
import { latestDenialActivity, responseHoursFor } from "../../lib/requestMetrics";
import { RequestDetailModal } from "./RequestDetailModal";

/**
 * A technical request's life is a small, fixed set of decisions — accept,
 * deny, or complete — not a browsable record like an inventory item. A
 * triage board (one column per decision state, oldest-first) puts that
 * decision front and center: the operator's job each column is "clear the
 * oldest card," which a sortable table with a status column obscures behind
 * a filter click. There's deliberately no table/list fallback here — see
 * RequestCard for the one-tap Accept/Complete that replaces it.
 */
const COLUMNS: { statusId: number; label: string }[] = [
  { statusId: REQUEST_STATUS.PENDING, label: "Pending" },
  { statusId: REQUEST_STATUS.ACCEPTED, label: "Accepted" },
  { statusId: REQUEST_STATUS.COMPLETED, label: "Completed" },
  { statusId: REQUEST_STATUS.DENIED, label: "Denied" },
];

const inputClass =
  "rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";

function RequestCard({
  request,
  onOpen,
  onAccept,
  acceptPending,
  onDeny,
  onComplete,
  completePending,
}: {
  request: TechnicalRequest;
  onOpen: () => void;
  onAccept?: () => void;
  acceptPending?: boolean;
  onDeny?: () => void;
  onComplete?: () => void;
  completePending?: boolean;
}) {
  const denial = request.latestStatusId === REQUEST_STATUS.DENIED ? latestDenialActivity(request.technical_request_activity) : undefined;
  const responseHours = request.latestStatusId === REQUEST_STATUS.COMPLETED ? responseHoursFor(request) : null;

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
      className="flex cursor-pointer flex-col gap-2 p-3 text-left shadow-sm transition-colors hover:border-series-1/40 focus-visible:outline-2 focus-visible:outline-series-1"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-ink">{request.request_types?.label ?? "Request"}</p>
        <span className="shrink-0 text-[11px] text-ink-muted" title={formatDateTime(request.created_at)}>
          {formatRelativeDateTime(request.created_at)}
        </span>
      </div>
      <p className="line-clamp-2 text-xs text-ink-secondary">{request.description || "—"}</p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-muted">
        <span className="truncate">{request.departments?.label ?? "No department"}</span>
        <span>·</span>
        <span className="truncate">{fullName(request.created_by_user)}</span>
      </div>
      {denial ? (
        <p className="line-clamp-2 rounded-md bg-critical/10 px-2 py-1 text-[11px] text-critical">
          {denial.message || "No reason given."}
        </p>
      ) : null}
      {responseHours != null ? <p className="text-[11px] text-ink-muted">Responded after {formatHours(responseHours)}</p> : null}
      {onAccept || onComplete ? (
        <div className="mt-1 flex gap-1.5 border-t border-[color:var(--border-hairline)] pt-2" onClick={(e) => e.stopPropagation()}>
          {onAccept ? (
            <>
              <Button variant="secondary" className="flex-1 gap-1 px-2 py-1 text-xs" disabled={acceptPending} onClick={onAccept}>
                <CheckIcon size={12} />
                Accept
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onDeny}>
                Deny
              </Button>
            </>
          ) : null}
          {onComplete ? (
            <Button variant="secondary" className="flex-1 gap-1 px-2 py-1 text-xs" disabled={completePending} onClick={onComplete}>
              <CheckIcon size={12} />
              Mark complete
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function RequestsListPage() {
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const [typeId, setTypeId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailModal, setDetailModal] = useState<{ id: number; initialShowDenyForm?: boolean } | null>(null);
  const [toasts, setToasts] = useState<SnackbarData[]>([]);

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const typesQuery = useQuery({ queryKey: ["reference", "request-types"], queryFn: referenceApi.requestTypes });

  // Unpaginated (well, 200-capped — this backend already loads its whole
  // table into memory per request regardless; see technicalRequests.routes.ts)
  // and always newest-200-first: a board shows every open column at once, so
  // slicing "page 2" would silently hide, say, Accepted cards behind however
  // many Pending ones sort earlier. Within each column below, that same
  // batch is re-sorted oldest-first for display — newest-first is just how
  // the 200-row budget is spent when history exceeds it.
  const listQuery = useQuery({
    queryKey: ["technical-requests", "board", { departmentId, typeId, search, dateFrom, dateTo }],
    queryFn: () =>
      technicalRequestsApi.list({
        status: "all",
        departmentId,
        typeId,
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: "createdAt",
        sortDir: "desc",
        page: 0,
        pageSize: 200,
      }),
  });

  function pushErrorToast(title: string, description: string) {
    setToasts((prev) => [{ id: Date.now() + Math.random(), title, description, icon: AlertTriangleIcon }, ...prev]);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["technical-requests"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const acceptMutation = useMutation({
    mutationFn: (id: number) => technicalRequestsApi.accept(id),
    onSuccess: invalidate,
    onError: (error) => pushErrorToast("Couldn't accept request", (error as Error).message),
  });
  const completeMutation = useMutation({
    mutationFn: (id: number) => technicalRequestsApi.complete(id),
    onSuccess: invalidate,
    onError: (error) => pushErrorToast("Couldn't complete request", (error as Error).message),
  });

  const hasFilters = departmentId != null || typeId != null || search !== "" || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setDepartmentId(undefined);
    setTypeId(undefined);
    setSearch("");
    setDateFrom("");
    setDateTo("");
  }

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);

  const columns = useMemo(() => {
    const map = new Map<number, TechnicalRequest[]>(COLUMNS.map((c) => [c.statusId, [] as TechnicalRequest[]]));
    for (const r of rows) {
      const bucket =
        r.latestStatusId === REQUEST_STATUS.ACCEPTED ||
        r.latestStatusId === REQUEST_STATUS.COMPLETED ||
        r.latestStatusId === REQUEST_STATUS.DENIED
          ? r.latestStatusId
          : REQUEST_STATUS.PENDING;
      map.get(bucket)!.push(r);
    }
    for (const list of map.values()) list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return map;
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Technical Requests</h1>
        <p className="text-sm text-ink-muted">Triage oldest-first — accept, deny, or mark complete right from the board.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, look-for, department…"
            className={`${inputClass} w-full pl-8`}
          />
        </div>
        <Combobox
          value={departmentId}
          onChange={setDepartmentId}
          options={(departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: d.label }))}
          placeholder="All departments"
          className="w-44"
        />
        <Combobox
          value={typeId}
          onChange={setTypeId}
          options={(typesQuery.data?.data ?? []).map((t) => ({ value: t.id, label: t.label }))}
          placeholder="All types"
          className="w-40"
        />
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-ink-muted" htmlFor="requests-date-from">
            From
          </label>
          <input
            id="requests-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputClass}
          />
          <label className="text-xs text-ink-muted" htmlFor="requests-date-to">
            To
          </label>
          <input id="requests-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </div>
        {hasFilters ? (
          <Button variant="ghost" onClick={clearFilters} className="gap-1.5">
            <XIcon size={14} />
            Clear filters
          </Button>
        ) : null}
      </div>

      {listQuery.isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((col) => (
            <div key={col.statusId} className="w-[300px] shrink-0">
              <div className="mb-3 h-5 w-24 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.06]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : listQuery.isError ? (
        <ErrorState message={(listQuery.error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No requests found" : "No requests yet"}
          hint={hasFilters ? "Try a different filter or search term." : "New requests will show up here."}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const items = columns.get(col.statusId) ?? [];
            const oldest = col.statusId === REQUEST_STATUS.PENDING ? items[0] : undefined;
            return (
              <div key={col.statusId} className="flex w-[300px] shrink-0 flex-col gap-3">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <span className={clsx("h-2 w-2 shrink-0 rounded-full", toneDotClass(requestStatusTone(col.statusId)))} />
                    <h2 className="text-sm font-semibold text-ink">{col.label}</h2>
                    <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-muted dark:bg-white/[0.1]">
                      {items.length}
                    </span>
                  </div>
                  {oldest ? (
                    <span className="text-[10px] text-ink-muted" title={formatDateTime(oldest.created_at)}>
                      oldest {formatRelativeDateTime(oldest.created_at)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[color:var(--border-hairline)] py-6 text-center text-xs text-ink-muted">
                      No {col.label.toLowerCase()} requests
                    </div>
                  ) : (
                    items.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        onOpen={() => setDetailModal({ id: request.id })}
                        onAccept={col.statusId === REQUEST_STATUS.PENDING ? () => acceptMutation.mutate(request.id) : undefined}
                        acceptPending={acceptMutation.isPending && acceptMutation.variables === request.id}
                        onDeny={
                          col.statusId === REQUEST_STATUS.PENDING
                            ? () => setDetailModal({ id: request.id, initialShowDenyForm: true })
                            : undefined
                        }
                        onComplete={col.statusId === REQUEST_STATUS.ACCEPTED ? () => completeMutation.mutate(request.id) : undefined}
                        completePending={completeMutation.isPending && completeMutation.variables === request.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailModal ? (
        <RequestDetailModal
          id={detailModal.id}
          onClose={() => setDetailModal(null)}
          initialShowDenyForm={detailModal.initialShowDenyForm}
        />
      ) : null}

      {/* `md:left-60` matches DashboardLayout's sidebar width so the stack
          centers within the main content area only, not the whole viewport. */}
      <SnackbarStack items={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} className="md:left-60" />
    </div>
  );
}
