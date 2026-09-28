import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { AlertBanner } from "../../components/ui/AlertBanner";
import { ErrorState } from "../../components/ui/EmptyState";
import { PageSpinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/toastContext";
import {
  ChevronRightIcon,
  HelpCircleIcon,
  InfoIcon,
  LayersIcon,
  PencilIcon,
  QrCodeIcon,
  TowerIcon,
  TransferIcon,
  TrashIcon,
  WarehouseIcon,
} from "../../components/ui/icons";
import { inventoryItemsApi, mrApi } from "../../lib/resources";
import { toneDotClass } from "../../lib/statusStyles";
import { dueState, daysBetween } from "../../lib/mrMetrics";
import { fullName, formatDateMedium, formatDateTime, formatDayCount } from "../../lib/format";
import { itemDisplayName, lineStatusTone, sortParts } from "../../lib/inventory";
import type { InstallationEntry, InventoryItemDetail, MrCustodyHistoryEntry } from "../../types/api";
import { InventoryItemQrModal } from "./InventoryItemQrModal";
import { TransferMrModal } from "./TransferMrModal";
import { MrDetailModal } from "./MrDetailModal";
import { ItemFormModal } from "./ItemFormModal";
import { ManagePartsModal } from "./ManagePartsModal";
import { ParDetailModal } from "./ParDetailModal";
import {
  CategoryTag,
  CategoryTile,
  DueChip,
  DueLabel,
  Field,
  Figure,
  ItemStatusBadge,
  LineStatus,
  Office,
  ParTag,
  PlacementChip,
  Section,
  SerialTag,
} from "./InventoryAtoms";

/** When this item left the MR a line belongs to: its own line closing, not
 * the MR's (a split leaves the MR open while this item moves on). */
function lineEnd(entry: MrCustodyHistoryEntry): string | null {
  if (entry.status === "active") return null;
  return entry.updated_at ?? entry.memorandum_receipts?.returned_at ?? entry.created_at;
}

type TimelineEvent =
  | { kind: "mr"; at: string; key: string; entry: MrCustodyHistoryEntry; movedTo?: MrCustodyHistoryEntry }
  | { kind: "installed" | "removed"; at: string; key: string; inst: InstallationEntry };

/**
 * One item: who has it right now (the question it is opened for, answered
 * before anything else), where it sits, its record, and a single history of
 * every MR and every install or removal it has been through.
 */
export function ItemDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["inventory-items", id], queryFn: () => inventoryItemsApi.get(id) });
  const [showTransfer, setShowTransfer] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [editing, setEditing] = useState(false);
  const [managePartsOf, setManagePartsOf] = useState<number | null>(null);
  const [openMrId, setOpenMrId] = useState<number | null>(null);
  const [openItemId, setOpenItemId] = useState<number | null>(null);
  const [openParId, setOpenParId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const item = query.data?.data;
  const custody = item?.currentCustody ?? null;
  const hostId = item?.installed_in_item_id ?? null;
  const history = useMemo(() => item?.custodyHistory ?? [], [item]);
  const installations = useMemo(() => item?.installations ?? [], [item]);
  const isComputer = !!item?.item_categories?.can_host_parts;
  const isPart = !!item?.item_categories?.is_part;

  const figures = useMemo(() => {
    let totalDays = 0;
    const people = new Set<number>();
    const mrs = new Set<number>();
    for (const entry of history) {
      totalDays += daysBetween(entry.created_at, lineEnd(entry) ?? undefined);
      const mr = entry.memorandum_receipts;
      if (mr?.custodian) people.add(mr.custodian.id);
      if (mr) mrs.add(mr.id);
    }
    return { totalDays, custodians: people.size, mrs: mrs.size };
  }, [history]);

  const timeline = useMemo(() => {
    // "Moved to" is read off this item's own MR lines only: a window through
    // a PC ends with the PC, not with a move of this item.
    const own = history.filter((e) => !e.via);
    const events: TimelineEvent[] = history.map((entry) => ({
      kind: "mr",
      at: entry.created_at,
      key: `mr-${entry.id}`,
      entry,
      movedTo: entry.status === "transferred" && !entry.via ? own[own.indexOf(entry) - 1] : undefined,
    }));
    for (const inst of installations) {
      events.push({ kind: "installed", at: inst.installed_at, key: `in-${inst.id}`, inst });
      if (inst.removed_at) events.push({ kind: "removed", at: inst.removed_at, key: `out-${inst.id}`, inst });
    }
    return events.sort((a, b) => b.at.localeCompare(a.at));
  }, [history, installations]);

  // Fetched only once "Transfer custody" is pressed: the transfer form needs
  // the whole MR, which this item's history summary doesn't carry.
  const transferMrQuery = useQuery({
    queryKey: ["mr", custody?.mrId],
    queryFn: () => mrApi.get(custody!.mrId),
    enabled: showTransfer && custody != null && !custody.via,
  });

  const deleteMutation = useMutation({
    mutationFn: () => inventoryItemsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["pars"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "Item deleted", description: item ? `${itemDisplayName(item)} · ${item.serial_number}` : undefined });
      onClose();
    },
  });

  const hasHistory = history.length > 0 || installations.length > 0;
  const statusCode = item?.item_statuses?.code;
  // Manual status edits are independent of MRs (rule 15), so the two can
  // drift apart on items edited before the v2 locks. A quiet note, never a block.
  const mismatch =
    item && !hostId && !custody && statusCode === "in_use"
      ? "Marked In use, but not on any active MR. Issue an MR for it or correct the status."
      : item && !hostId && custody && statusCode === "in_storage"
        ? `Marked In storage, but still on ${custody.mrNumber}. Return the MR or correct the status.`
        : null;

  return (
    <Modal
      title={item ? itemDisplayName(item) : `Item #${id}`}
      subtitle={
        item
          ? `${item.is_assembled ? "Assembled PC" : (item.item_categories?.label ?? "Uncategorized")} · Registered ${formatDateMedium(item.created_at)}`
          : undefined
      }
      onClose={onClose}
      width="max-w-3xl"
      footer={
        item ? (
          <>
            <Button
              variant="ghost"
              className="text-critical hover:bg-critical/10 dark:hover:bg-critical/15"
              onClick={() => setConfirmDelete(true)}
              disabled={hasHistory || deleteMutation.isPending}
              title={hasHistory ? "Has custody or assembly history. Mark it decommissioned instead." : undefined}
            >
              <TrashIcon size={14} />
              Delete
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setShowQr(true)}>
                <QrCodeIcon size={14} />
                QR label
              </Button>
              {isComputer ? (
                <Button variant="secondary" onClick={() => setManagePartsOf(item.id)}>
                  <LayersIcon size={14} />
                  Manage parts
                </Button>
              ) : null}
              <Button onClick={() => setEditing(true)}>
                <PencilIcon size={14} />
                Edit item
              </Button>
            </div>
            {deleteMutation.isError ? <p className="w-full text-xs text-critical">{(deleteMutation.error as Error).message}</p> : null}
          </>
        ) : undefined
      }
    >
      {query.isLoading ? (
        <PageSpinner />
      ) : query.isError || !item ? (
        <ErrorState message={(query.error as Error | null)?.message ?? "Item not found"} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <CategoryTile code={item.item_categories?.code} assembled={item.is_assembled} size={44} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <ItemStatusBadge status={item.item_statuses} withIcon />
              <SerialTag value={item.serial_number} copyable className="text-xs" />
              {item.par ? <ParTag code={item.par.par_code} onClick={() => setOpenParId(item.par!.id)} className="text-xs" /> : null}
              {hostId ? <PlacementChip hostId={hostId} onOpen={setOpenItemId} /> : null}
              {item.partCount ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-hairline)] px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                  <LayersIcon size={11} />
                  {item.partCount} part{item.partCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>

          {hostId && item.installedIn ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--border-hairline)] bg-black/[0.02] p-4 dark:bg-white/[0.03]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-ink-secondary dark:bg-white/[0.08]">
                <TowerIcon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Installed in PC #{hostId}</p>
                <p className="text-sm text-ink-muted">
                  Inside {item.installedIn.name} ({item.installedIn.serial_number}). Its status and custody follow the PC.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOpenItemId(hostId)}>
                  Open PC
                </Button>
                <Button variant="secondary" onClick={() => setManagePartsOf(hostId)}>
                  Manage parts
                </Button>
              </div>
            </div>
          ) : null}

          {statusCode === "missing" && !hostId ? (
            <AlertBanner icon={HelpCircleIcon} title="This item is marked missing">
              {custody
                ? `It is still on ${custody.mrNumber} in ${fullName(custody.custodian)}'s name. Follow up with them, then update the status once it is found or written off.`
                : "Locate it and update its status, or keep the record as-is if the loss has already been reported."}
            </AlertBanner>
          ) : null}

          <CustodyPanel
            item={item}
            onOpenMr={setOpenMrId}
            onOpenItem={setOpenItemId}
            onTransfer={() => setShowTransfer(true)}
            transferLoading={showTransfer && transferMrQuery.isLoading}
          />
          {mismatch ? (
            <p className="-mt-3 flex items-start gap-2 text-xs text-ink-muted">
              <InfoIcon size={14} className="mt-px shrink-0" />
              {mismatch}
            </p>
          ) : null}
          {transferMrQuery.isError ? <p className="-mt-3 text-xs text-critical">{(transferMrQuery.error as Error).message}</p> : null}

          <div className="grid grid-cols-3 divide-x divide-[color:var(--gridline)] rounded-xl border border-[color:var(--border-hairline)]">
            <Figure
              label="Time in custody"
              value={history.length === 0 ? "Never issued" : figures.totalDays < 1 ? "Under a day" : formatDayCount(figures.totalDays)}
              hint={isPart ? "Its own MRs and through PCs" : "Across every MR"}
            />
            <Figure label="Custodians to date" value={figures.custodians} />
            <Figure label="MRs to date" value={figures.mrs} />
          </div>

          {isComputer ? (
            <Section
              title={`Parts${item.parts.length ? ` · ${item.parts.length}` : ""}`}
              aside={
                <Button variant="ghost" onClick={() => setManagePartsOf(item.id)} className="px-2 py-1 text-xs">
                  Manage parts
                </Button>
              }
            >
              {item.parts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[color:var(--border-hairline)] px-4 py-4 text-center text-sm text-ink-muted">
                  No parts recorded inside. Add its CPU, GPU, RAM or storage with Manage parts.
                </p>
              ) : (
                <ul className="divide-y divide-[color:var(--gridline)] overflow-hidden rounded-xl border border-[color:var(--border-hairline)]">
                  {sortParts(item.parts).map((part) => (
                    <li key={part.id}>
                      <button
                        type="button"
                        onClick={() => setOpenItemId(part.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-black/[0.025] dark:hover:bg-white/[0.04]"
                      >
                        <CategoryTile code={part.item_categories?.code} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{itemDisplayName(part)}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <CategoryTag label={part.item_categories?.code === "storage" ? "Storage" : part.item_categories?.code} />
                            <SerialTag value={part.serial_number} />
                            {part.par ? <ParTag code={part.par.par_code} /> : null}
                          </span>
                        </span>
                        <ChevronRightIcon size={14} className="text-ink-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ) : null}

          <Section title="Record">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="PAR">
                {item.par ? (
                  <button type="button" onClick={() => setOpenParId(item.par!.id)} className="text-left hover:underline">
                    <span className="font-mono">{item.par.par_code}</span>
                    <span className="block text-xs text-ink-muted">{item.par.supplier || "No supplier on record"}</span>
                  </button>
                ) : item.is_assembled ? (
                  <span className="text-ink-muted">None (assembled by ICTD)</span>
                ) : (
                  <span className="text-ink-muted">No PAR (registered before PARs)</span>
                )}
              </Field>
              <Field label="Owning office">
                <Office dept={item.departments} fallback="Not assigned" />
              </Field>
              <Field label="Registered by">{fullName(item.created_by_user)}</Field>
              <Field label="Added">{formatDateTime(item.created_at)}</Field>
              <Field label="Last updated">{formatDateTime(item.updated_at ?? item.created_at)}</Field>
              <Field label="Description / specs" className="sm:col-span-2">
                {item.description ? <span className="whitespace-pre-line">{item.description}</span> : <span className="text-ink-muted">None</span>}
              </Field>
            </div>
          </Section>

          <Section title="History" aside={timeline.length > 0 ? <span className="text-xs text-ink-muted">Newest first</span> : null}>
            {timeline.length > 0 ? (
              <>
                <ol className="flex flex-col">
                  {timeline.map((event, index) =>
                    event.kind === "mr" ? (
                      <HistoryEntry
                        key={event.key}
                        entry={event.entry}
                        movedTo={event.movedTo}
                        isLast={index === timeline.length - 1}
                        onOpen={setOpenMrId}
                      />
                    ) : (
                      <InstallEntry key={event.key} kind={event.kind} inst={event.inst} isLast={index === timeline.length - 1} onOpenItem={setOpenItemId} />
                    ),
                  )}
                </ol>
                {isPart && installations.length === 0 ? <p className="text-xs text-ink-muted">Never installed in a PC.</p> : null}
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-[color:var(--border-hairline)] px-4 py-5 text-center text-sm text-ink-muted">
                {isPart
                  ? "Never issued on a Memorandum Receipt, and never installed in a PC. It has stayed with ICTD since it was registered."
                  : "Never issued on a Memorandum Receipt. This item has stayed with ICTD since it was registered."}
              </p>
            )}
          </Section>
        </div>
      )}

      {showTransfer && transferMrQuery.data ? (
        <TransferMrModal
          mr={transferMrQuery.data.data}
          preselectedItemIds={[id]}
          onClose={() => setShowTransfer(false)}
          onTransferred={() => {
            setShowTransfer(false);
            queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
          }}
        />
      ) : null}
      {showQr && item ? <InventoryItemQrModal item={item} onClose={() => setShowQr(false)} /> : null}
      {editing && item ? (
        <ItemFormModal
          item={item}
          onClose={() => setEditing(false)}
          onManageParts={(host) => {
            setEditing(false);
            setManagePartsOf(host);
          }}
          onDelete={() => {
            setEditing(false);
            setConfirmDelete(true);
          }}
          onSaved={(saved, { reprint }) => {
            setEditing(false);
            toast(
              reprint
                ? { title: "Saved. Name or serial changed, so reprint the label.", description: `${itemDisplayName(saved)} · ${saved.serial_number}` }
                : { title: "Changes saved", description: `${itemDisplayName(saved)} · ${saved.serial_number}` },
            );
            if (reprint) setShowQr(true);
          }}
        />
      ) : null}
      {managePartsOf != null ? <ManagePartsModal hostId={managePartsOf} onClose={() => setManagePartsOf(null)} /> : null}
      {openMrId != null ? <MrDetailModal id={openMrId} onClose={() => setOpenMrId(null)} /> : null}
      {openItemId != null ? <ItemDetailModal id={openItemId} onClose={() => setOpenItemId(null)} /> : null}
      {openParId != null ? <ParDetailModal id={openParId} onClose={() => setOpenParId(null)} onOpenItem={setOpenItemId} /> : null}
      {confirmDelete && item ? (
        <ConfirmModal
          title="Delete this item?"
          description={`${itemDisplayName(item)} (${item.serial_number}) will be removed from the inventory. It has never been on an MR or in a PC, so no history is lost.`}
          confirmLabel="Delete item"
          tone="danger"
          loading={deleteMutation.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            deleteMutation.mutate();
          }}
        />
      ) : null}
    </Modal>
  );
}

function CustodyPanel({
  item,
  onOpenMr,
  onOpenItem,
  onTransfer,
  transferLoading,
}: {
  item: InventoryItemDetail;
  onOpenMr: (mrId: number) => void;
  onOpenItem: (id: number) => void;
  onTransfer: () => void;
  transferLoading: boolean;
}) {
  const custody = item.currentCustody;

  if (!custody) {
    return (
      <div className="flex items-center gap-3.5 rounded-xl border border-[color:var(--border-hairline)] bg-black/[0.015] p-4 dark:bg-white/[0.02]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-series-1/10 text-series-1">
          <WarehouseIcon size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">In ICTD custody</p>
          <p className="text-sm text-ink-muted">
            {item.installed_in_item_id ? `PC #${item.installed_in_item_id} isn't out on any Memorandum Receipt.` : "Not out on any Memorandum Receipt."}
          </p>
        </div>
      </div>
    );
  }

  const due = { status: "active", expected_return_at: custody.expectedReturnAt };
  const state = dueState(due);
  const heldDays = daysBetween(custody.since);
  const via = custody.via;

  return (
    <div
      className={clsx(
        "rounded-xl border p-4",
        state === "overdue"
          ? "border-critical/35 bg-critical/[0.05]"
          : state === "dueSoon"
            ? "border-warning/45 bg-warning/[0.06]"
            : "border-series-1/30 bg-series-1/[0.04]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar person={custody.custodian} size={44} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">With</p>
            <p className="truncate text-base font-semibold text-ink">
              {fullName(custody.custodian)}
              {via ? <span className="font-normal text-ink-secondary">, via PC #{via.id}</span> : null}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {custody.custodian?.employee_number ? `Employee #${custody.custodian.employee_number}` : "No employee # on file"}
            </p>
          </div>
        </div>
        <DueChip mr={due} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="On MR">
          <button type="button" onClick={() => onOpenMr(custody.mrId)} className="font-mono font-semibold whitespace-nowrap text-series-1 hover:underline">
            {custody.mrNumber}
          </button>
        </Field>
        <Field label={via ? "PC issued" : "Since"}>
          {formatDateMedium(custody.since)}
          <span className="block text-xs text-ink-muted">{formatDayCount(heldDays)}</span>
        </Field>
        <Field label="Due back">{custody.expectedReturnAt ? formatDateMedium(custody.expectedReturnAt) : <span className="text-ink-muted">No due date</span>}</Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => onOpenMr(custody.mrId)}>
          Open MR
          <ChevronRightIcon size={14} />
        </Button>
        {via ? (
          <>
            <Button variant="secondary" onClick={() => onOpenItem(via.id)}>
              <TowerIcon size={14} />
              Open PC #{via.id}
            </Button>
            <span className="text-xs text-ink-muted">Custody follows PC #{via.id}. Transfer the PC to move it.</span>
          </>
        ) : (
          <Button variant="secondary" onClick={onTransfer} disabled={transferLoading}>
            <TransferIcon size={14} />
            {transferLoading ? "Loading…" : "Transfer this item"}
          </Button>
        )}
      </div>
    </div>
  );
}

function HistoryEntry({
  entry,
  movedTo,
  isLast,
  onOpen,
}: {
  entry: MrCustodyHistoryEntry;
  /** For a transferred line: the newer line this item moved onto. */
  movedTo?: MrCustodyHistoryEntry;
  isLast: boolean;
  onOpen: (mrId: number) => void;
}) {
  const mr = entry.memorandum_receipts;
  const end = lineEnd(entry);
  const days = daysBetween(entry.created_at, end ?? undefined);
  const via = entry.via;

  let outcome: string;
  if (via && entry.endedBy === "removed") outcome = `Ended when it came out of PC #${via.id}`;
  else if (entry.status === "active") outcome = via ? `Issued with PC #${via.id} by ${fullName(mr?.issued_by_user)}` : `Issued by ${fullName(mr?.issued_by_user)}`;
  else if (entry.status === "returned") outcome = `Returned to ICTD by ${fullName(mr?.returned_by_user)}`;
  else {
    const next = movedTo?.memorandum_receipts;
    outcome = next ? `Moved to ${next.mr_number} (${fullName(next.custodian)})` : via ? `PC #${via.id} moved to a new MR` : "Transferred";
  }

  return (
    <li className="relative flex gap-3 pb-1">
      {!isLast ? <span className="absolute top-5 bottom-0 left-[5.5px] w-px bg-[color:var(--gridline)]" aria-hidden="true" /> : null}
      <span
        className={clsx(
          "relative z-10 mt-[7px] h-3 w-3 shrink-0 rounded-full ring-4 ring-[color:var(--surface-1)]",
          toneDotClass(lineStatusTone(entry.status)),
        )}
        aria-hidden="true"
      />
      <button
        type="button"
        disabled={!mr}
        onClick={() => mr && onOpen(mr.id)}
        className="-mt-0.5 mb-3 flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
      >
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-ink">{mr?.mr_number ?? "Unknown MR"}</span>
            {via ? <PlacementChip hostId={via.id} label={`via PC #${via.id}`} /> : null}
          </span>
          {via && entry.endedBy === "removed" ? (
            <span className="text-xs font-medium text-ink-muted">Removed from PC</span>
          ) : (
            <LineStatus status={entry.status} />
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink">
          <Avatar person={mr?.custodian} size={20} className="text-[9px]" />
          {fullName(mr?.custodian)}
          {mr?.custodian?.employee_number ? <span className="text-xs text-ink-muted">#{mr.custodian.employee_number}</span> : null}
        </span>
        <span className="text-xs text-ink-muted">
          {formatDateMedium(entry.created_at)} to {end ? formatDateMedium(end) : "now"} · {formatDayCount(days)}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-ink-secondary">
          {outcome}
          {entry.status === "active" && mr ? <DueLabel mr={{ status: "active", expected_return_at: mr.expected_return_at }} /> : null}
        </span>
      </button>
    </li>
  );
}

/** An install or removal, drawn with a hollow marker so it reads apart from
 * custody (MR) entries in the same timeline. */
function InstallEntry({
  kind,
  inst,
  isLast,
  onOpenItem,
}: {
  kind: "installed" | "removed";
  inst: InstallationEntry;
  isLast: boolean;
  onOpenItem: (id: number) => void;
}) {
  const other = inst.other;
  const asPart = inst.role === "part";
  const at = kind === "installed" ? inst.installed_at : inst.removed_at!;
  const by = kind === "installed" ? inst.installed_by_user : inst.removed_by_user;
  const title = asPart
    ? kind === "installed"
      ? `Installed in PC #${inst.host_item_id}`
      : `Removed from PC #${inst.host_item_id}`
    : kind === "installed"
      ? `Part added${other?.category ? `: ${other.category.label}` : ""}`
      : `Part removed${other?.category ? `: ${other.category.label}` : ""}`;
  // Notes are written on the row that opened or closed it; a swap's note
  // belongs to the removal.
  const showNotes = inst.notes && (kind === "removed" || !inst.removed_at);

  return (
    <li className="relative flex gap-3 pb-1">
      {!isLast ? <span className="absolute top-5 bottom-0 left-[5.5px] w-px bg-[color:var(--gridline)]" aria-hidden="true" /> : null}
      <span className="relative z-10 mt-[7px] h-3 w-3 shrink-0 rounded-full border-2 border-ink-muted bg-[color:var(--surface-1)]" aria-hidden="true" />
      <button
        type="button"
        disabled={!other}
        onClick={() => other && onOpenItem(other.id)}
        className="-mt-0.5 mb-3 flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
      >
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            <TowerIcon size={13} className="text-ink-muted" />
            {title}
          </span>
          {kind === "removed" && inst.status_after ? (
            <span className="text-xs text-ink-muted">Set to {inst.status_after.label}</span>
          ) : null}
        </span>
        {other ? (
          <span className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
            {other.name}
            <SerialTag value={other.serial_number} />
          </span>
        ) : null}
        <span className="text-xs text-ink-muted">
          {formatDateTime(at)} · by {fullName(by)}
        </span>
        {showNotes ? <span className="text-xs text-ink-secondary italic">"{inst.notes}"</span> : null}
      </button>
    </li>
  );
}
