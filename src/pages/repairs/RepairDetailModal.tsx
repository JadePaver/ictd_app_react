import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { PageSpinner } from "../../components/ui/Spinner";
import { AlertTriangleIcon } from "../../components/ui/icons";
import { referenceApi, repairItemsApi } from "../../lib/resources";
import { repairStatusTone, toneDotClass } from "../../lib/statusStyles";
import { fullName, formatDateTime, formatDays, formatRelativeTime } from "../../lib/format";
import type { RepairLog } from "../../types/api";

const inputClass =
  "w-full rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";
const labelClass = "text-xs font-medium text-ink-muted";

/** Days between two ISO timestamps — mirrors dashboard.routes.ts's
 * avgTurnaroundDays divisor so per-item and org-wide figures are directly
 * comparable. */
function daysBetween(fromIso: string, toIso: string): number | null {
  const fromMs = new Date(fromIso).getTime();
  const toMs = new Date(toIso).getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs < fromMs) return null;
  return (toMs - fromMs) / 86_400_000;
}

export function RepairDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [statusId, setStatusId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<{
    itemName: string;
    description: string;
    conditionOnRelease: string;
    serialNumber: string;
  } | null>(null);

  const itemQuery = useQuery({ queryKey: ["repair-items", id], queryFn: () => repairItemsApi.get(id) });
  const statusesQuery = useQuery({ queryKey: ["reference", "repair-statuses"], queryFn: referenceApi.repairStatuses });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["repair-items"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const statusMutation = useMutation({
    mutationFn: () => repairItemsApi.updateStatus(id, Number(statusId), notes.trim() || undefined),
    onSuccess: () => {
      invalidate();
      setNotes("");
      setStatusId("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      repairItemsApi.update(id, {
        itemName: editFields!.itemName.trim(),
        description: editFields!.description.trim() || null,
        conditionOnRelease: editFields!.conditionOnRelease.trim() || null,
        serialNumber: editFields!.serialNumber.trim() || null,
      }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => repairItemsApi.remove(id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const item = itemQuery.data?.data;

  // repair_statuses' "Cancelled" row isn't a named constant anywhere else in
  // this codebase (see statusStyles.ts's repairStatusTone) — reusing the
  // tone it resolves to avoids duplicating that magic id here too.
  const isCancelled = item ? repairStatusTone(item.status_id) === "critical" : false;

  const sortedLogs = useMemo(
    () =>
      item
        ? [...(item.logs ?? [])].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime())
        : [],
    [item],
  );
  const cancelLog: RepairLog | undefined = isCancelled ? sortedLogs[0] : undefined;

  const turnaroundDays = item?.released_at ? daysBetween(item.received_at ?? item.created_at, item.released_at) : null;
  const inRepairDays =
    item && !item.released_at && item.received_at ? daysBetween(item.received_at, new Date().toISOString()) : null;

  return (
    <Modal title={item ? item.item_name : `Repair item #${id}`} onClose={onClose} width="max-w-2xl">
      {itemQuery.isLoading || !item ? (
        <PageSpinner />
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={repairStatusTone(item.status_id)}>{item.repair_statuses?.name ?? "Unknown"}</Badge>
              {item.serial_number ? <Badge tone="neutral">SN: {item.serial_number}</Badge> : null}
            </div>
            {item.received_at ? (
              <p className="mt-1.5 text-xs text-ink-muted" title={formatDateTime(item.received_at)}>
                Received {formatRelativeTime(item.received_at)}
                {turnaroundDays != null
                  ? ` · turnaround ${formatDays(turnaroundDays)}`
                  : inRepairDays != null
                    ? ` · in repair for ${formatDays(inRepairDays)}`
                    : ""}
              </p>
            ) : null}
          </div>

          {isCancelled ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-critical/30 bg-critical/10 p-3">
              <AlertTriangleIcon size={16} className="mt-0.5 shrink-0 text-critical" />
              <div>
                <p className="text-sm font-medium text-critical">
                  Cancelled{cancelLog ? ` by ${fullName(cancelLog.logged_by_user)}` : ""}
                </p>
                <p className="mt-0.5 text-sm text-ink-secondary">{cancelLog?.notes || "No reason given."}</p>
              </div>
            </div>
          ) : null}

          {editing ? (
            <div className="flex flex-col gap-3 rounded-lg border border-[color:var(--border-hairline)] p-3">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Item name</label>
                <input
                  className={inputClass}
                  value={editFields?.itemName ?? ""}
                  onChange={(e) => setEditFields((f) => ({ ...f!, itemName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Description</label>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={editFields?.description ?? ""}
                  onChange={(e) => setEditFields((f) => ({ ...f!, description: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Condition on release</label>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={editFields?.conditionOnRelease ?? ""}
                  onChange={(e) => setEditFields((f) => ({ ...f!, conditionOnRelease: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Serial number</label>
                <input
                  className={inputClass}
                  value={editFields?.serialNumber ?? ""}
                  onChange={(e) => setEditFields((f) => ({ ...f!, serialNumber: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                  Save details
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-ink-muted">Owner</p>
                <p className="text-ink">{item.owner_user ? fullName(item.owner_user) : item.owner ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Contact</p>
                <p className="text-ink">{item.owner_contact ?? "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-ink-muted">Description</p>
                <p className="text-ink">{item.description || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Handled by</p>
                <p className="text-ink">{fullName(item.received_by_user)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Received</p>
                <p className="text-ink">{formatDateTime(item.received_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Released</p>
                <p className="text-ink">{formatDateTime(item.released_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Condition on receipt</p>
                <p className="text-ink">{item.condition_on_receive || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Condition on release</p>
                <p className="text-ink">{item.condition_on_release || "—"}</p>
              </div>
              <div className="col-span-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditFields({
                      itemName: item.item_name,
                      description: item.description ?? "",
                      conditionOnRelease: item.condition_on_release ?? "",
                      serialNumber: item.serial_number ?? "",
                    });
                    setEditing(true);
                  }}
                >
                  Edit details
                </Button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">Activity log</p>
            {sortedLogs.length === 0 ? (
              <p className="text-sm text-ink-muted">No log entries.</p>
            ) : (
              <ul className="flex flex-col">
                {sortedLogs.map((log, index) => (
                  <li key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < sortedLogs.length - 1 ? (
                      <span className="absolute top-3 left-[4.5px] h-full w-px bg-[color:var(--gridline)]" />
                    ) : null}
                    <span
                      className={clsx(
                        "relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        toneDotClass(repairStatusTone(log.repair_status_id)),
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={repairStatusTone(log.repair_status_id)}>
                          {log.repair_statuses?.name ?? `Status #${log.repair_status_id}`}
                        </Badge>
                        <span className="text-xs text-ink-muted" title={formatDateTime(log.log_date)}>
                          {formatRelativeTime(log.log_date)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-secondary">
                        by {fullName(log.logged_by_user)}
                        {log.notes ? ` — ${log.notes}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-[color:var(--border-hairline)] p-3">
            <p className={labelClass}>Update status</p>
            <Combobox
              value={statusId}
              onChange={(v) => setStatusId(v ?? "")}
              options={(statusesQuery.data?.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Select new status…"
            />
            <textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
            />
            <div className="flex justify-between">
              <Button variant="danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                Delete item
              </Button>
              <Button disabled={!statusId || statusMutation.isPending} onClick={() => statusMutation.mutate()}>
                Save status
              </Button>
            </div>
            {statusMutation.isError ? <p className="text-xs text-critical">{(statusMutation.error as Error).message}</p> : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
