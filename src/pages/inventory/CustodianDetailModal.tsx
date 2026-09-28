import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { PageSpinner } from "../../components/ui/Spinner";
import { ErrorState } from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/toastContext";
import { ChevronRightIcon, MailIcon, PencilIcon, PhoneIcon, PlusIcon, PrintIcon, TrashIcon } from "../../components/ui/icons";
import { custodiansApi, mrApi } from "../../lib/resources";
import { fullName, formatDateMedium } from "../../lib/format";
import { itemDisplayName } from "../../lib/inventory";
import { CustodianFormModal } from "./CustodianFormModal";
import { CustodianBadgeCard } from "./CustodianBadgeCard";
import { CustodianBadgePrintModal } from "./CustodianBadgePrintModal";
import { IssueMrModal } from "./IssueMrModal";
import { MrDetailModal } from "./MrDetailModal";
import { ItemDetailModal } from "./ItemDetailModal";
import { CategoryTile, DueLabel, Field, Figure, MrStamp, Office, Section } from "./InventoryAtoms";

/**
 * A custodian's record: who they are, what they are holding right now (item
 * by item, overdue first), and every MR ever issued to them, so "who has
 * what, and for how long" is answered in one place.
 */
export function CustodianDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openMrId, setOpenMrId] = useState<number | null>(null);
  const [openItemId, setOpenItemId] = useState<number | null>(null);

  const query = useQuery({ queryKey: ["custodians", id], queryFn: () => custodiansApi.get(id) });
  const historyQuery = useQuery({
    queryKey: ["mr", "by-custodian", id],
    queryFn: () => mrApi.list({ custodianId: id, segment: "all", sortBy: "issuedAt", sortDir: "desc", pageSize: 100 }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => custodiansApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custodians"] });
      toast({ title: "Custodian deleted", description: custodian ? fullName(custodian) : undefined });
      onClose();
    },
  });

  const custodian = query.data?.data;
  const history = historyQuery.data?.data ?? [];
  const hasHistory = (custodian?.totalMrCount ?? 0) > 0;

  return (
    <Modal
      title={custodian ? fullName(custodian) : `Custodian #${id}`}
      subtitle={
        custodian ? (
          <>
            {custodian.employee_number ? `#${custodian.employee_number} · ` : ""}
            <Office dept={custodian.departments} fallback="No office on file" />
          </>
        ) : undefined
      }
      onClose={onClose}
      width="max-w-4xl"
      footer={
        custodian ? (
          <>
            <Button
              variant="ghost"
              className="text-critical hover:bg-critical/10 dark:hover:bg-critical/15"
              onClick={() => setConfirmDelete(true)}
              disabled={hasHistory || deleteMutation.isPending}
              title={hasHistory ? "Custodians with MR history can't be deleted." : undefined}
            >
              <TrashIcon size={14} />
              Delete
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setShowEdit(true)}>
                <PencilIcon size={14} />
                Edit
              </Button>
              <Button onClick={() => setShowIssue(true)}>
                <PlusIcon size={14} />
                Issue MR
              </Button>
            </div>
            {deleteMutation.isError ? <p className="w-full text-xs text-critical">{(deleteMutation.error as Error).message}</p> : null}
          </>
        ) : undefined
      }
    >
      {query.isLoading ? (
        <PageSpinner />
      ) : query.isError || !custodian ? (
        <ErrorState message={(query.error as Error | null)?.message ?? "This custodian could not be loaded."} />
      ) : (
        <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="flex flex-col items-center gap-3 md:sticky md:top-0 md:self-start">
            <CustodianBadgeCard custodian={custodian} className="w-full max-w-[220px]" />
            <Button variant="secondary" className="w-full max-w-[220px]" onClick={() => setShowPrint(true)}>
              <PrintIcon size={14} />
              Print badge
            </Button>
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            <div className="grid grid-cols-3 divide-x divide-[color:var(--gridline)] rounded-xl border border-[color:var(--border-hairline)]">
              <Figure
                label="Items in custody"
                value={custodian.activeItemCount}
                hint={
                  custodian.overdueItemCount
                    ? `${custodian.overdueItemCount} overdue`
                    : custodian.activeInstalledPartCount
                      ? `incl. ${custodian.activeInstalledPartCount} installed part${custodian.activeInstalledPartCount === 1 ? "" : "s"}`
                      : undefined
                }
                tone={custodian.overdueItemCount ? "critical" : undefined}
              />
              <Figure label="Active MRs" value={custodian.activeMrCount} />
              <Figure label="MRs to date" value={custodian.totalMrCount} />
            </div>

            <Section title="Contact">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Field label="Contact number">
                  {custodian.contact_number ? (
                    <a href={`tel:${custodian.contact_number.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-series-1">
                      <PhoneIcon size={14} className="text-ink-muted" />
                      {custodian.contact_number}
                    </a>
                  ) : (
                    <span className="text-ink-muted">None on file</span>
                  )}
                </Field>
                <Field label="Email">
                  {custodian.email ? (
                    <a href={`mailto:${custodian.email}`} className="inline-flex min-w-0 items-center gap-1.5 break-all hover:text-series-1">
                      <MailIcon size={14} className="shrink-0 text-ink-muted" />
                      {custodian.email}
                    </a>
                  ) : (
                    <span className="text-ink-muted">None on file</span>
                  )}
                </Field>
                {custodian.notes ? (
                  <Field label="Notes" className="sm:col-span-2">
                    <span className="whitespace-pre-line">{custodian.notes}</span>
                  </Field>
                ) : null}
              </div>
            </Section>

            <Section
              title="Currently holding"
              aside={custodian.holdings.length ? <span className="text-xs text-ink-muted">Overdue first</span> : null}
            >
              {custodian.holdings.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[color:var(--border-hairline)] px-4 py-5 text-center text-sm text-ink-muted">
                  Nothing out right now. {fullName(custodian)} is clear.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-[color:var(--gridline)] rounded-xl border border-[color:var(--border-hairline)]">
                  {custodian.holdings.map((h) => (
                    <li key={h.lineId}>
                      <button
                        type="button"
                        onClick={() => setOpenItemId(h.item.id)}
                        className={clsx(
                          "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                          h.overdue && "bg-critical/[0.03]",
                        )}
                      >
                        <CategoryTile code={h.item.item_categories?.code} assembled={h.item.is_assembled} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-ink">{itemDisplayName(h.item)}</span>
                            {h.partCount ? (
                              <span className="shrink-0 rounded-full bg-series-1/10 px-1.5 text-[10px] font-semibold text-series-1">
                                +{h.partCount} part{h.partCount === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </span>
                          <span className="block truncate text-xs text-ink-muted">
                            <span className="font-mono">{h.item.serial_number}</span> · on <span className="font-mono">{h.mr.mr_number}</span> since{" "}
                            {formatDateMedium(h.since)}
                          </span>
                        </span>
                        <DueLabel mr={{ status: "active", expected_return_at: h.mr.expected_return_at }} className="hidden sm:inline-flex" />
                        <ChevronRightIcon size={14} className="shrink-0 text-ink-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="MR history" aside={history.length ? <span className="text-xs text-ink-muted">Newest first</span> : null}>
              {historyQuery.isLoading ? (
                <PageSpinner />
              ) : history.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[color:var(--border-hairline)] px-4 py-5 text-center text-sm text-ink-muted">
                  No MRs issued to this custodian yet.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-[color:var(--gridline)] rounded-xl border border-[color:var(--border-hairline)]">
                  {history.map((mr) => (
                    <li key={mr.id}>
                      <button
                        type="button"
                        onClick={() => setOpenMrId(mr.id)}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-sm font-semibold text-ink">{mr.mr_number}</span>
                          <span className="block text-xs text-ink-muted">
                            Issued {formatDateMedium(mr.issued_at)} · {mr.itemCount} item{mr.itemCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        {mr.status === "active" ? <DueLabel mr={mr} className="hidden sm:inline-flex" /> : null}
                        <MrStamp status={mr.status} />
                        <ChevronRightIcon size={14} className="shrink-0 text-ink-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}

      {showEdit && custodian ? (
        <CustodianFormModal
          custodian={custodian}
          onClose={() => setShowEdit(false)}
          onSaved={() => setShowEdit(false)}
        />
      ) : null}
      {showPrint && custodian ? <CustodianBadgePrintModal custodian={custodian} onClose={() => setShowPrint(false)} /> : null}
      {showIssue && custodian ? (
        <IssueMrModal
          initialCustodian={custodian}
          onClose={() => setShowIssue(false)}
          onIssued={(mrId) => {
            setShowIssue(false);
            setOpenMrId(mrId);
          }}
        />
      ) : null}
      {openMrId != null ? <MrDetailModal id={openMrId} onClose={() => setOpenMrId(null)} /> : null}
      {openItemId != null ? <ItemDetailModal id={openItemId} onClose={() => setOpenItemId(null)} /> : null}
      {confirmDelete && custodian ? (
        <ConfirmModal
          title="Delete this custodian?"
          description={`${fullName(custodian)} has never been named on an MR, so no custody history is lost.`}
          confirmLabel="Delete custodian"
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
