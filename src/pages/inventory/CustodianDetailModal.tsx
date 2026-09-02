import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { PageSpinner } from "../../components/ui/Spinner";
import { PrintIcon } from "../../components/ui/icons";
import { custodiansApi, mrApi } from "../../lib/resources";
import { mrStatusTone, toneTextClass } from "../../lib/statusStyles";
import { dueStatus } from "../../lib/mrMetrics";
import { fullName, formatDate } from "../../lib/format";
import { CustodianFormModal } from "./CustodianFormModal";
import { CustodianBadgeCard } from "./CustodianBadgeCard";
import { CustodianBadgePrintModal } from "./CustodianBadgePrintModal";
import { IssueMrModal } from "./IssueMrModal";
import { MrDetailModal } from "./MrDetailModal";

/**
 * A custodian's full record: contact info, at-a-glance custody stats, and
 * their complete MR history (issue → return/transfer chain), so "who has
 * what, and for how long" is answerable from one place instead of hunting
 * through the MR list filtered by name.
 */
export function CustodianDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [openMrId, setOpenMrId] = useState<number | null>(null);

  const query = useQuery({ queryKey: ["custodians", id], queryFn: () => custodiansApi.get(id) });
  const mrHistoryQuery = useQuery({
    queryKey: ["mr", { custodianId: id }],
    queryFn: () => mrApi.list({ custodianId: id, sortBy: "issuedAt", sortDir: "desc", pageSize: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => custodiansApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custodians"] });
      onClose();
    },
  });

  const custodian = query.data?.data;
  const history = mrHistoryQuery.data?.data ?? [];
  const activeMrCount = history.filter((mr) => mr.status === "active").length;
  const hasHistory = (mrHistoryQuery.data?.total ?? 0) > 0;

  return (
    <Modal title={custodian ? fullName(custodian) : `Custodian #${id}`} onClose={onClose} width="max-w-2xl">
      {query.isLoading || !custodian ? (
        <PageSpinner />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex justify-center px-2 pt-1">
            <CustodianBadgeCard custodian={custodian} className="w-full max-w-[220px]" />
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg border border-[color:var(--border-hairline)] p-3 text-sm">
            <div>
              <p className="text-xs font-medium text-ink-muted">Items in custody</p>
              <p className="text-ink">{custodian.activeItemCount ?? 0}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Active MRs</p>
              <p className="text-ink">{activeMrCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">MRs to date</p>
              <p className="text-ink">{mrHistoryQuery.data?.total ?? 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-ink-muted">Contact number</p>
              <p className="text-ink">{custodian.contact_number || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Email</p>
              <p className="text-ink">{custodian.email || "—"}</p>
            </div>
            {custodian.notes ? (
              <div className="col-span-2">
                <p className="text-xs font-medium text-ink-muted">Notes</p>
                <p className="text-ink">{custodian.notes}</p>
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">MR history</p>
            {mrHistoryQuery.isLoading ? (
              <PageSpinner />
            ) : (
              <ul className="flex flex-col gap-2">
                {history.length === 0 ? (
                  <li className="text-sm text-ink-muted">No MRs issued to this custodian yet.</li>
                ) : (
                  history.map((mr) => {
                    const due = mr.status === "active" && mr.expected_return_at ? dueStatus(mr) : null;
                    return (
                      <li key={mr.id}>
                        <button
                          type="button"
                          onClick={() => setOpenMrId(mr.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-[color:var(--border-hairline)] p-2.5 text-left text-sm hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-xs text-ink">{mr.mr_number}</span>
                            <span className="block text-xs text-ink-muted">Issued {formatDate(mr.issued_at)}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {due ? <span className={clsx("text-xs font-medium", toneTextClass(due.tone))}>{due.label}</span> : null}
                            <Badge tone={mrStatusTone(mr.status)}>{mr.status}</Badge>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          <div className="flex justify-between border-t border-[color:var(--border-hairline)] pt-4">
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || hasHistory}
              title={hasHistory ? "Custodians with MR history can't be deleted" : undefined}
            >
              Delete custodian
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowPrint(true)} className="gap-1.5">
                <PrintIcon size={14} />
                Print badge
              </Button>
              <Button variant="secondary" onClick={() => setShowEdit(true)}>
                Edit
              </Button>
              <Button onClick={() => setShowIssue(true)}>Issue MR</Button>
            </div>
          </div>
          {deleteMutation.isError ? <p className="text-xs text-critical">{(deleteMutation.error as Error).message}</p> : null}
        </div>
      )}

      {showEdit && custodian ? <CustodianFormModal custodian={custodian} onClose={() => setShowEdit(false)} /> : null}
      {showPrint && custodian ? <CustodianBadgePrintModal custodian={custodian} onClose={() => setShowPrint(false)} /> : null}
      {showIssue && custodian ? (
        <IssueMrModal
          initialCustodian={custodian}
          onClose={() => {
            setShowIssue(false);
            mrHistoryQuery.refetch();
          }}
        />
      ) : null}
      {openMrId != null ? <MrDetailModal id={openMrId} onClose={() => setOpenMrId(null)} /> : null}
    </Modal>
  );
}
