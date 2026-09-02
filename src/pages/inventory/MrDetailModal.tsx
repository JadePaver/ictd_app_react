import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { PageSpinner } from "../../components/ui/Spinner";
import { ChevronLeftIcon, ChevronRightIcon, MailIcon, PrintIcon } from "../../components/ui/icons";
import { mrApi } from "../../lib/resources";
import { dueStatus } from "../../lib/mrMetrics";
import { fullName, formatDate, formatDateTime } from "../../lib/format";
import { TransferMrModal } from "./TransferMrModal";
import { MrPrintModal } from "./MrPrintModal";
import { CustodianDetailModal } from "./CustodianDetailModal";
import { MrReceiptCard } from "./MrReceiptCard";

const inputClass =
  "w-full rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";

export function MrDetailModal({ id: initialId, onClose }: { id: number; onClose: () => void }) {
  const [id, setId] = useState(initialId);
  const [returnNotes, setReturnNotes] = useState("");
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showCustodian, setShowCustodian] = useState(false);
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ["mr", id], queryFn: () => mrApi.get(id) });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["mr"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const returnMutation = useMutation({
    mutationFn: () => mrApi.return(id, returnNotes.trim() || undefined),
    onSuccess: () => {
      invalidate();
      setShowReturnForm(false);
      setReturnNotes("");
    },
  });

  const mr = query.data?.data;
  const isOverdue = mr ? dueStatus(mr).tone === "critical" : false;

  return (
    <Modal title={mr ? mr.mr_number : `MR #${id}`} onClose={onClose} width="max-w-lg">
      {query.isLoading || !mr ? (
        <PageSpinner />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex justify-center px-2 pt-1">
            <MrReceiptCard mr={mr} className="w-full max-w-[300px]" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" onClick={() => setShowPrint(true)} className="gap-1.5">
              <PrintIcon size={14} />
              Print
            </Button>
            {mr.custodian ? (
              <Button variant="secondary" onClick={() => setShowCustodian(true)} className="gap-1.5">
                View custodian
              </Button>
            ) : null}
            {isOverdue && mr.custodian?.email ? (
              <a
                href={`mailto:${mr.custodian.email}?subject=${encodeURIComponent(
                  `Overdue item — ${mr.mr_number}`,
                )}&body=${encodeURIComponent(
                  `Hi ${mr.custodian.first_name ?? ""},\n\n${mr.mr_number} was due back on ${formatDate(
                    mr.expected_return_at,
                  )} and is still showing as active. Please return the item(s) or arrange a transfer at your earliest convenience.\n\nThanks.`,
                )}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border-hairline)] px-3.5 py-2 text-sm font-medium text-ink transition duration-150 hover:bg-black/[0.03] active:scale-[0.98] dark:hover:bg-white/[0.06]"
              >
                <MailIcon size={14} />
                Email custodian
              </a>
            ) : null}
            {mr.precededBy ? (
              <Button variant="secondary" onClick={() => setId(mr.precededBy!.id)} className="gap-1.5">
                <ChevronLeftIcon size={14} />
                From {mr.precededBy.mr_number}
              </Button>
            ) : null}
            {mr.status === "transferred" && mr.superseded_by ? (
              <Button variant="secondary" onClick={() => setId(mr.superseded_by!)} className="gap-1.5">
                View new MR
                <ChevronRightIcon size={14} />
              </Button>
            ) : null}
          </div>

          {mr.returned_at ? (
            <p className="text-center text-xs text-ink-muted">
              {mr.status === "transferred" ? "Transferred" : "Returned"} by {fullName(mr.returned_by_user)} on{" "}
              {formatDateTime(mr.returned_at)}
            </p>
          ) : null}

          {mr.status === "active" ? (
            showReturnForm ? (
              <div className="flex flex-col gap-2 rounded-lg border border-[color:var(--border-hairline)] p-3">
                <label className="text-xs font-medium text-ink-muted" htmlFor="return-notes">
                  Return notes (optional)
                </label>
                <textarea
                  id="return-notes"
                  className={inputClass}
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowReturnForm(false)}>
                    Cancel
                  </Button>
                  <Button disabled={returnMutation.isPending} onClick={() => returnMutation.mutate()}>
                    Confirm return
                  </Button>
                </div>
                {returnMutation.isError ? (
                  <p className="text-xs text-critical">{(returnMutation.error as Error).message}</p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--border-hairline)] pt-4">
                <Button variant="secondary" onClick={() => setShowReturnForm(true)}>
                  Return
                </Button>
                <Button onClick={() => setShowTransfer(true)}>Transfer</Button>
              </div>
            )
          ) : null}
        </div>
      )}

      {showTransfer && mr ? (
        <TransferMrModal
          mr={mr}
          onClose={() => setShowTransfer(false)}
          onTransferred={(newId) => {
            setShowTransfer(false);
            setId(newId);
          }}
        />
      ) : null}

      {showPrint && mr ? <MrPrintModal mr={mr} onClose={() => setShowPrint(false)} /> : null}
      {showCustodian && mr?.custodian ? (
        <CustodianDetailModal id={mr.custodian.id} onClose={() => setShowCustodian(false)} />
      ) : null}
    </Modal>
  );
}
