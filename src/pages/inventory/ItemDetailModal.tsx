import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { PageSpinner } from "../../components/ui/Spinner";
import { AlertTriangleIcon, QrCodeIcon, TransferIcon } from "../../components/ui/icons";
import { inventoryItemsApi, mrApi } from "../../lib/resources";
import { itemStatusTone, mrStatusTone, toneDotClass } from "../../lib/statusStyles";
import { fullName, formatDateTime, formatDays } from "../../lib/format";
import { InventoryItemQrModal } from "./InventoryItemQrModal";
import { TransferMrModal } from "./TransferMrModal";
import type { CustodianRef, InventoryItemDetail } from "../../types/api";

function itemName(item: { brand?: string | null; model?: string | null }): string {
  return [item.brand, item.model].filter(Boolean).join(" ") || "Item";
}

function daysBetween(startIso: string, endIso: string): number {
  return Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 86_400_000);
}

export function ItemDetailModal({
  id,
  onClose,
  onEdit,
}: {
  id: number;
  onClose: () => void;
  onEdit?: (item: InventoryItemDetail) => void;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["inventory-items", id], queryFn: () => inventoryItemsApi.get(id) });
  const [showTransfer, setShowTransfer] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => inventoryItemsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      onClose();
    },
  });

  const item = query.data?.data;
  const isMissing = item?.item_statuses?.code === "missing";

  // Custody summary — derived entirely from custodyHistory (already fetched
  // for the timeline below), no extra request needed. "Total time in
  // custody" sums every MR window this item has ever been on (open windows
  // count up to now); "custodians to date" is the number of distinct people
  // across that history, current one included; "currentMrId" is what lets
  // the "Transfer custody" action below jump straight into a transfer
  // scoped to just this item, without the operator having to go find the
  // right MR from the MR list themselves.
  const custodyStats = useMemo(() => {
    let totalDays = 0;
    const custodianIds = new Set<number>();
    let currentCustodian: CustodianRef | null = null;
    let currentMrId: number | null = null;
    const nowIso = new Date().toISOString();
    for (const entry of item?.custodyHistory ?? []) {
      const mr = entry.memorandum_receipts;
      if (!mr) continue;
      totalDays += daysBetween(mr.issued_at, mr.returned_at ?? nowIso);
      if (mr.custodian) custodianIds.add(mr.custodian.id);
      if (entry.status === "active") {
        currentCustodian = mr.custodian;
        currentMrId = mr.id;
      }
    }
    return { totalDays, custodianCount: custodianIds.size, currentCustodian, currentMrId };
  }, [item]);

  // Fetched on demand (only once "Transfer custody" is clicked) since
  // TransferMrModal needs the MR's full item list, not just the summary
  // custodyHistory already carries.
  const transferMrQuery = useQuery({
    queryKey: ["mr", custodyStats.currentMrId],
    queryFn: () => mrApi.get(custodyStats.currentMrId!),
    enabled: showTransfer && custodyStats.currentMrId != null,
  });

  return (
    <Modal title={item ? itemName(item) : `Item #${id}`} onClose={onClose} width="max-w-2xl">
      {query.isLoading || !item ? (
        <PageSpinner />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={itemStatusTone(item.item_statuses?.code)}>{item.item_statuses?.label ?? "Unknown"}</Badge>
              <Badge tone="neutral">{item.item_categories?.label ?? "Uncategorized"}</Badge>
              <Badge tone="neutral">SN: {item.serial_number}</Badge>
            </div>
            <Button variant="secondary" onClick={() => setShowQr(true)} className="gap-1.5">
              <QrCodeIcon size={14} />
              QR Label
            </Button>
          </div>

          {isMissing ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-critical/30 bg-critical/10 p-3">
              <AlertTriangleIcon size={16} className="mt-0.5 shrink-0 text-critical" />
              <p className="text-sm text-critical">
                This item is marked <span className="font-semibold">missing</span>. Locate it and update its status,
                or keep this record as-is if the loss has already been reported.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-ink-muted">Department</p>
              <p className="text-ink">{item.departments?.label ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Registered by</p>
              <p className="text-ink">{fullName(item.created_by_user)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-medium text-ink-muted">Description</p>
              <p className="text-ink">{item.description || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Added</p>
              <p className="text-ink">{formatDateTime(item.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Last updated</p>
              <p className="text-ink">{formatDateTime(item.updated_at ?? item.created_at)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg border border-[color:var(--border-hairline)] p-3 text-sm">
            <div>
              <p className="text-xs font-medium text-ink-muted">Current custodian</p>
              <p className="text-ink">{custodyStats.currentCustodian ? fullName(custodyStats.currentCustodian) : "In storage"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Total time in custody</p>
              <p className="text-ink">{custodyStats.totalDays > 0 ? formatDays(custodyStats.totalDays) : "Never issued"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Custodians to date</p>
              <p className="text-ink">{custodyStats.custodianCount}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">Custody history</p>
            {item.custodyHistory.length === 0 ? (
              <p className="text-sm text-ink-muted">Never issued on an MR.</p>
            ) : (
              <ul className="flex flex-col">
                {item.custodyHistory.map((entry, index) => {
                  const mr = entry.memorandum_receipts;
                  return (
                    <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < item.custodyHistory.length - 1 ? (
                        <span className="absolute top-3 left-[4.5px] h-full w-px bg-[color:var(--gridline)]" />
                      ) : null}
                      <span
                        className={clsx(
                          "relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                          toneDotClass(mrStatusTone(entry.status)),
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-ink">{mr?.mr_number ?? "—"}</span>
                          <Badge tone={mrStatusTone(entry.status)}>{entry.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-ink-secondary">
                          Custodian: {fullName(mr?.custodian)} · issued by {fullName(mr?.issued_by_user)} on{" "}
                          {formatDateTime(mr?.issued_at)}
                        </p>
                        {mr?.returned_at ? (
                          <p className="text-xs text-ink-muted">
                            Closed by {fullName(mr?.returned_by_user)} on {formatDateTime(mr.returned_at)}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-between border-t border-[color:var(--border-hairline)] pt-4">
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || item.custodyHistory.length > 0}
              title={item.custodyHistory.length > 0 ? "Items with MR history can't be deleted" : undefined}
            >
              Delete item
            </Button>
            <div className="flex gap-2">
              {custodyStats.currentMrId != null ? (
                <Button
                  variant="secondary"
                  onClick={() => setShowTransfer(true)}
                  disabled={showTransfer && transferMrQuery.isLoading}
                >
                  <TransferIcon size={14} />
                  {showTransfer && transferMrQuery.isLoading ? "Loading…" : "Transfer custody"}
                </Button>
              ) : null}
              {onEdit ? <Button onClick={() => onEdit(item)}>Edit item</Button> : null}
            </div>
          </div>
          {deleteMutation.isError ? (
            <p className="text-xs text-critical">{(deleteMutation.error as Error).message}</p>
          ) : null}
          {transferMrQuery.isError ? (
            <p className="text-xs text-critical">{(transferMrQuery.error as Error).message}</p>
          ) : null}
        </div>
      )}

      {showTransfer && transferMrQuery.data ? (
        <TransferMrModal
          mr={transferMrQuery.data.data}
          preselectedItemIds={[id]}
          onClose={() => setShowTransfer(false)}
          onTransferred={() => {
            setShowTransfer(false);
            queryClient.invalidateQueries({ queryKey: ["inventory-items", id] });
          }}
        />
      ) : null}

      {showQr && item ? <InventoryItemQrModal item={item} onClose={() => setShowQr(false)} /> : null}
    </Modal>
  );
}
