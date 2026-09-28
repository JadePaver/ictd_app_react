import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { PageSpinner } from "../../components/ui/Spinner";
import { TextInput } from "../../components/ui/FormField";
import { ErrorState } from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/toastContext";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MailIcon,
  PhoneIcon,
  PrintIcon,
  ReturnIcon,
  SplitIcon,
  TransferIcon,
} from "../../components/ui/icons";
import { mrApi } from "../../lib/resources";
import { daysBetween, dueInfo, isOverdue } from "../../lib/mrMetrics";
import { fullName, formatDateMedium, formatDateTime, formatDayCount } from "../../lib/format";
import { itemDisplayName } from "../../lib/inventory";
import type { MemorandumReceiptDetail } from "../../types/api";
import { TransferMrModal } from "./TransferMrModal";
import { MrPrintModal } from "./MrPrintModal";
import { CustodianDetailModal } from "./CustodianDetailModal";
import { ItemDetailModal } from "./ItemDetailModal";
import { MrReceiptCard } from "./MrReceiptCard";
import { CategoryTag, CategoryTile, DueChip, Field, ItemStatusBadge, LineStatus, MrStamp, Office, PersonLine, Section, SerialTag } from "./InventoryAtoms";

function overdueEmail(mr: MemorandumReceiptDetail): string {
  const due = dueInfo(mr);
  const outstanding = mr.items.filter((line) => line.status === "active");
  const lines = outstanding.map((line) => `- ${itemDisplayName(line.inventory_items ?? {})} (S/N ${line.inventory_items?.serial_number ?? "unknown"})`);
  const subject = `Overdue equipment: ${mr.mr_number}`;
  const body = [
    `Good day, ${mr.custodian?.first_name ?? ""},`,
    "",
    `Memorandum Receipt ${mr.mr_number} was due back on ${formatDateMedium(mr.expected_return_at)} (${due.detail ?? "overdue"}) and still lists the following in your name:`,
    "",
    ...lines,
    "",
    "Please return the equipment to ICTD, or let us know if it should be transferred to someone else.",
    "",
    "Thank you.",
    "ICTD",
  ].join("\n");
  return `mailto:${mr.custodian?.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * One memorandum receipt. The receipt itself sits on the left as the paper
 * it is; the record around it answers who holds it, how late it is, where
 * its items came from and went, and offers the only two things you can do
 * to an open MR: return it, or transfer it. Neither edits it: both close it
 * (or part of it) out.
 */
export function MrDetailModal({ id: initialId, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [id, setId] = useState(initialId);
  // MRs visited by following the custody chain, so "Back" can retrace it.
  const [trail, setTrail] = useState<{ id: number; mrNumber: string }[]>([]);
  const [returning, setReturning] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [custodianId, setCustodianId] = useState<number | null>(null);
  const [itemId, setItemId] = useState<number | null>(null);

  const query = useQuery({ queryKey: ["mr", id], queryFn: () => mrApi.get(id) });
  const mr = query.data?.data;

  function goTo(nextId: number) {
    if (mr) setTrail((t) => [...t, { id: mr.id, mrNumber: mr.mr_number }]);
    setReturning(false);
    setId(nextId);
  }

  function goBack() {
    const previous = trail[trail.length - 1];
    if (!previous) return;
    setTrail((t) => t.slice(0, -1));
    setReturning(false);
    setId(previous.id);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["mr"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    queryClient.invalidateQueries({ queryKey: ["custodians"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const returnMutation = useMutation({
    mutationFn: () => mrApi.return(id, returnNotes.trim() || undefined),
    onSuccess: () => {
      invalidate();
      setReturning(false);
      setReturnNotes("");
      toast({ title: `${mr?.mr_number ?? "MR"} returned`, description: "Its items are back in ICTD custody." });
    },
  });

  const activeLines = mr?.items.filter((line) => line.status === "active") ?? [];
  const overdue = mr ? isOverdue(mr) : false;
  const previous = trail[trail.length - 1];

  const footer = !mr ? undefined : mr.status !== "active" ? (
    <>
      <p className="text-xs text-ink-muted">Closed MRs can't be changed. Print it again any time for the record.</p>
      <Button variant="secondary" className="ml-auto" onClick={() => setShowPrint(true)}>
        <PrintIcon size={14} />
        Print
      </Button>
    </>
  ) : returning ? (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm text-ink-secondary">
        <span className="font-semibold text-ink">
          {activeLines.length} item{activeLines.length === 1 ? "" : "s"} come{activeLines.length === 1 ? "s" : ""} back to ICTD
        </span>{" "}
        and {mr.mr_number} closes as Returned. Items still In use go back to In storage; a more specific status (Under repair,
        Missing, Decommissioned) is kept.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          autoFocus
          className="min-w-56 flex-1"
          placeholder="Return note (optional), e.g. condition on return"
          value={returnNotes}
          onChange={(e) => setReturnNotes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !returnMutation.isPending) returnMutation.mutate();
          }}
          aria-label="Return note"
        />
        <Button variant="ghost" onClick={() => setReturning(false)} disabled={returnMutation.isPending}>
          Cancel
        </Button>
        <Button onClick={() => returnMutation.mutate()} disabled={returnMutation.isPending}>
          <ReturnIcon size={14} />
          {returnMutation.isPending ? "Returning…" : "Confirm return"}
        </Button>
      </div>
      {returnMutation.isError ? <p className="text-xs text-critical">{(returnMutation.error as Error).message}</p> : null}
    </div>
  ) : (
    <>
      <Button variant="secondary" onClick={() => setShowPrint(true)}>
        <PrintIcon size={14} />
        Print
      </Button>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setReturning(true)}>
          <ReturnIcon size={14} />
          Return
        </Button>
        <Button onClick={() => setShowTransfer(true)}>
          <TransferIcon size={14} />
          Transfer
        </Button>
      </div>
    </>
  );

  return (
    <Modal
      title={<span className="font-mono">{mr?.mr_number ?? `MR #${id}`}</span>}
      subtitle={
        previous ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            <button type="button" onClick={goBack} className="inline-flex items-center gap-1 font-medium text-series-1 hover:underline">
              <ChevronLeftIcon size={13} />
              Back to {previous.mrNumber}
            </button>
            {mr ? <span>· {fullName(mr.custodian)}</span> : null}
          </span>
        ) : mr ? (
          `Memorandum receipt · ${fullName(mr.custodian)}`
        ) : undefined
      }
      onClose={onClose}
      width="max-w-5xl"
      footer={footer}
    >
      {query.isLoading ? (
        <PageSpinner />
      ) : query.isError || !mr ? (
        <ErrorState message={(query.error as Error | null)?.message ?? "This MR could not be loaded."} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <aside className="flex flex-col items-center gap-3 lg:sticky lg:top-0 lg:self-start">
            <MrReceiptCard mr={mr} className="w-full max-w-[300px]" />
            {overdue && mr.custodian?.email ? (
              <a
                href={overdueEmail(mr)}
                className="inline-flex w-full max-w-[300px] items-center justify-center gap-2 rounded-lg bg-critical px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[color-mix(in_oklab,var(--status-critical)_88%,black)] active:scale-[0.98]"
              >
                <MailIcon size={14} />
                Email custodian
              </a>
            ) : null}
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <MrStamp status={mr.status} className="text-[11px]" />
              <DueChip mr={mr} />
              <span className="text-xs text-ink-muted">
                {mr.status === "active" ? "Open" : "Was open"} {formatDayCount(daysBetween(mr.issued_at, mr.returned_at ?? undefined))}
              </span>
            </div>

            {mr.status !== "active" ? <ClosedNotice mr={mr} onOpen={goTo} /> : null}

            {mr.precededBy || mr.successors.length > 0 ? (
              <Section title="Custody chain">
                <ul className="flex flex-col divide-y divide-[color:var(--gridline)] rounded-xl border border-[color:var(--border-hairline)]">
                  {mr.precededBy ? (
                    <ChainRow
                      icon={<ArrowLeftIcon size={15} />}
                      label={mr.precededBy.kind === "split" ? "Split from" : "Transferred from"}
                      mrNumber={mr.precededBy.mr_number}
                      detail={mr.precededBy.kind === "split" ? "Some of its items moved here" : "Every item on it moved here"}
                      onOpen={() => goTo(mr.precededBy!.id)}
                    />
                  ) : null}
                  {mr.successors.map((s) => (
                    <ChainRow
                      key={s.id}
                      icon={s.kind === "split" ? <SplitIcon size={15} /> : <ArrowRightIcon size={15} />}
                      label={s.kind === "split" ? "Split to" : "Transferred to"}
                      mrNumber={s.mr_number}
                      detail={`${s.itemIds.length} item${s.itemIds.length === 1 ? "" : "s"} to ${fullName(s.custodian)} on ${formatDateMedium(s.issued_at)}`}
                      onOpen={() => goTo(s.id)}
                    />
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section title="Custodian">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border-hairline)] p-3.5">
                <PersonLine
                  person={mr.custodian}
                  size={40}
                  strong
                  sub={
                    <>
                      {mr.custodian?.employee_number ? `#${mr.custodian.employee_number} · ` : ""}
                      <Office dept={mr.custodian?.departments} fallback="No office on file" />
                    </>
                  }
                />
                <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary">
                  {mr.custodian?.contact_number ? (
                    <a href={`tel:${mr.custodian.contact_number.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 hover:text-ink">
                      <PhoneIcon size={13} />
                      {mr.custodian.contact_number}
                    </a>
                  ) : null}
                  {mr.custodian?.email ? (
                    <a href={`mailto:${mr.custodian.email}`} className="inline-flex items-center gap-1 hover:text-ink">
                      <MailIcon size={13} />
                      {mr.custodian.email}
                    </a>
                  ) : null}
                  {mr.custodian ? (
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setCustodianId(mr.custodian!.id)}>
                      View custodian
                      <ChevronRightIcon size={13} />
                    </Button>
                  ) : null}
                </div>
              </div>
            </Section>

            <Section title="Receipt details">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Field label="Filed under">
                  <Office dept={mr.departments} fallback="No office" />
                </Field>
                <Field label="Issued">
                  {formatDateTime(mr.issued_at)}
                  <span className="block text-xs text-ink-muted">by {fullName(mr.issued_by_user)}</span>
                </Field>
                <Field label="Expected return">
                  {mr.expected_return_at ? formatDateMedium(mr.expected_return_at) : <span className="text-ink-muted">No fixed date</span>}
                  {mr.status === "active" && !mr.expected_return_at ? (
                    <span className="block text-xs text-ink-muted">Can never be flagged due soon or overdue.</span>
                  ) : null}
                </Field>
                {mr.notes ? (
                  <Field label="Notes" className="sm:col-span-2">
                    <span className="whitespace-pre-line">{mr.notes}</span>
                  </Field>
                ) : null}
              </div>
            </Section>

            <Section
              title={`Items (${mr.items.length})`}
              aside={
                mr.status === "active" && activeLines.length !== mr.items.length ? (
                  <span className="text-xs text-ink-muted">{activeLines.length} still in custody</span>
                ) : null
              }
            >
              <ul className="flex flex-col divide-y divide-[color:var(--gridline)] rounded-xl border border-[color:var(--border-hairline)]">
                {mr.items.map((line) => {
                  const it = line.inventory_items;
                  const partsAtIssue = line.partsAtIssue ?? [];
                  return (
                    <li key={line.id}>
                      <button
                        type="button"
                        disabled={!it}
                        onClick={() => it && setItemId(it.id)}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                      >
                        <CategoryTile code={it?.item_categories?.code} assembled={it?.is_assembled} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{itemDisplayName(it ?? {})}</span>
                          <span className="block truncate font-mono text-xs text-ink-muted">{it?.serial_number}</span>
                        </span>
                        <span className="hidden sm:block">
                          <LineStatus status={line.status} />
                        </span>
                        <span className="hidden md:block">
                          <ItemStatusBadge status={it?.item_statuses} />
                        </span>
                        <ChevronRightIcon size={14} className="shrink-0 text-ink-muted" />
                      </button>
                      {partsAtIssue.length > 0 ? (
                        <div className="-mt-1 pb-2.5 pl-[3.6rem] pr-3.5">
                          <p className="mb-1 text-[11px] font-medium text-ink-muted">
                            {partsAtIssue.length} part{partsAtIssue.length === 1 ? "" : "s"} inside when issued
                          </p>
                          <ul className="flex flex-col gap-1 border-l border-[color:var(--border-hairline)] pl-3">
                            {partsAtIssue.map((part) => (
                              <li key={part.id}>
                                <button
                                  type="button"
                                  onClick={() => setItemId(part.id)}
                                  className="flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                                >
                                  <CategoryTag label={part.item_categories?.code === "storage" ? "Storage" : part.item_categories?.code} />
                                  <span className="min-w-0 truncate text-ink-secondary">
                                    {[part.brand, part.model].filter(Boolean).join(" ") || part.item_categories?.label}
                                  </span>
                                  <SerialTag value={part.serial_number} className="ml-auto shrink-0" />
                                </button>
                              </li>
                            ))}
                          </ul>
                          {line.partsChangedSinceIssue && it ? (
                            <p className="mt-1.5 text-xs text-ink-muted">
                              Parts changed since issue.{" "}
                              <button type="button" onClick={() => setItemId(it.id)} className="font-medium text-series-1 hover:underline">
                                See PC #{it.id}'s history.
                              </button>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-ink-muted">
                Left: what happened to each item on this MR. Right: the item's condition today.
              </p>
            </Section>
          </div>
        </div>
      )}

      {showTransfer && mr ? (
        <TransferMrModal
          mr={mr}
          onClose={() => setShowTransfer(false)}
          onTransferred={(newId) => {
            setShowTransfer(false);
            goTo(newId);
          }}
        />
      ) : null}
      {showPrint && mr ? <MrPrintModal mr={mr} onClose={() => setShowPrint(false)} /> : null}
      {custodianId != null ? <CustodianDetailModal id={custodianId} onClose={() => setCustodianId(null)} /> : null}
      {itemId != null ? <ItemDetailModal id={itemId} onClose={() => setItemId(null)} /> : null}
    </Modal>
  );
}

function ClosedNotice({ mr, onOpen }: { mr: MemorandumReceiptDetail; onOpen: (id: number) => void }) {
  const transferred = mr.status === "transferred";
  return (
    <div className="rounded-xl border border-[color:var(--border-hairline)] bg-black/[0.02] p-4 dark:bg-white/[0.03]">
      <p className="text-sm text-ink">
        <span className="font-semibold">{transferred ? "Transferred" : "Returned to ICTD"}</span> by {fullName(mr.returned_by_user)} on{" "}
        {formatDateTime(mr.returned_at)}.
      </p>
      {transferred && mr.superseded_by ? (
        <p className="mt-1 text-sm text-ink-secondary">
          Every item on it moved to a new MR.{" "}
          <button type="button" onClick={() => onOpen(mr.superseded_by!)} className="font-medium text-series-1 hover:underline">
            View the new MR
          </button>
        </p>
      ) : null}
      {mr.return_notes ? (
        <blockquote className="mt-2 border-l-2 border-[color:var(--baseline)] pl-3 text-sm whitespace-pre-line text-ink-secondary">
          {mr.return_notes}
        </blockquote>
      ) : null}
    </div>
  );
}

function ChainRow({
  icon,
  label,
  mrNumber,
  detail,
  onOpen,
}: {
  icon: ReactNode;
  label: string;
  mrNumber: string;
  detail: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-series-2/10 text-series-2">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ink">
            {label} <span className="font-mono font-semibold">{mrNumber}</span>
          </span>
          <span className="block truncate text-xs text-ink-muted">{detail}</span>
        </span>
        <ChevronRightIcon size={14} className="shrink-0 text-ink-muted" />
      </button>
    </li>
  );
}
