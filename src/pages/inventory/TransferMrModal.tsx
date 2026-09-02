import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { FormField, FormSection, fieldInputClass } from "../../components/ui/FormField";
import { mrApi, referenceApi } from "../../lib/resources";
import { mrItemLabel } from "../../lib/mrMetrics";
import { CustodianPicker } from "./CustodianPicker";
import type { Custodian, MemorandumReceiptDetail } from "../../types/api";

/**
 * Transfers some or all of an active MR's items to a new custodian — see
 * memorandumReceipts.routes.ts's `/:id/transfer`. Every active item is
 * preselected by default (the common case: hand the whole MR to someone
 * else), but each can be unchecked to split a multi-item MR — the rest
 * stay behind on this MR, which is left active rather than closed.
 *
 * `preselectedItemIds` lets a caller (e.g. ItemDetailModal's "Transfer
 * custody" action) scope the modal to just one item up front instead of
 * everything on its MR.
 */
export function TransferMrModal({
  mr,
  preselectedItemIds,
  onClose,
  onTransferred,
}: {
  mr: MemorandumReceiptDetail;
  preselectedItemIds?: number[];
  onClose: () => void;
  onTransferred: (newMrId: number) => void;
}) {
  const queryClient = useQueryClient();

  const activeItems = useMemo(() => mr.items.filter((i) => i.status === "active"), [mr.items]);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(preselectedItemIds ?? activeItems.map((i) => i.item_id)),
  );
  const [mrNumber, setMrNumber] = useState("");
  const [mrNumberTouched, setMrNumberTouched] = useState(false);
  const [custodian, setCustodian] = useState<Custodian | null>(null);
  const [custodianTouched, setCustodianTouched] = useState(false);
  const [departmentId, setDepartmentId] = useState<number | "">(mr.department_id ?? "");
  const [expectedReturnAt, setExpectedReturnAt] = useState(mr.expected_return_at?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const nextNumberQuery = useQuery({ queryKey: ["mr", "next-number"], queryFn: mrApi.nextNumber });
  useEffect(() => {
    if (nextNumberQuery.data && !mrNumber) setMrNumber(nextNumberQuery.data.data.mrNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextNumberQuery.data]);

  useEffect(() => {
    if (custodian?.department_id != null && departmentId === "") setDepartmentId(custodian.department_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custodian]);

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });

  function toggleItem(itemId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const allSelected = selectedIds.size === activeItems.length;
  const isPartial = selectedIds.size > 0 && !allSelected;

  const mutation = useMutation({
    mutationFn: () =>
      mrApi.transfer(mr.id, {
        mrNumber: mrNumber.trim(),
        custodianId: custodian!.id,
        departmentId: departmentId === "" ? undefined : Number(departmentId),
        expectedReturnAt: expectedReturnAt || undefined,
        notes: notes.trim() || undefined,
        itemIds: [...selectedIds],
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["mr"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onTransferred(res.data.id);
    },
  });

  const mrNumberError = mrNumber.trim().length === 0 ? "MR number is required" : undefined;
  const custodianError = !custodian ? "Select or add the new custodian" : undefined;
  const itemsError = selectedIds.size === 0 ? "Select at least one item to transfer" : undefined;
  const canSubmit = !mrNumberError && !custodianError && !itemsError;

  return (
    <Modal title={`Transfer ${mr.mr_number}`} onClose={onClose} width="max-w-lg">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          setMrNumberTouched(true);
          setCustodianTouched(true);
          if (canSubmit) mutation.mutate();
        }}
      >
        <p className="text-sm text-ink-secondary">
          {allSelected ? (
            <>
              This closes {mr.mr_number} (status becomes "transferred") and issues a new MR covering all{" "}
              {activeItems.length} item{activeItems.length === 1 ? "" : "s"} to the new custodian.
            </>
          ) : isPartial ? (
            <>
              This moves <span className="font-medium text-ink">{selectedIds.size}</span> of {activeItems.length} item
              {activeItems.length === 1 ? "" : "s"} to a new MR for the new custodian. {mr.mr_number} stays active with
              the remaining {activeItems.length - selectedIds.size}.
            </>
          ) : (
            "Select at least one item below to transfer."
          )}
        </p>

        <FormSection title="Items to transfer" description={`${selectedIds.size} of ${activeItems.length} selected`}>
          <div className="flex items-center justify-end gap-3 text-xs">
            <button
              type="button"
              className="font-medium text-series-1 hover:underline"
              onClick={() => setSelectedIds(new Set(activeItems.map((i) => i.item_id)))}
              disabled={allSelected}
            >
              Select all
            </button>
            <span className="text-ink-muted">·</span>
            <button
              type="button"
              className="font-medium text-series-1 hover:underline"
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedIds.size === 0}
            >
              Clear
            </button>
          </div>
          <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {activeItems.map((entry) => {
              const checked = selectedIds.has(entry.item_id);
              return (
                <li key={entry.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? "border-series-1 bg-series-1/5"
                        : "border-[color:var(--border-hairline)] hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(entry.item_id)}
                      className="h-4 w-4 shrink-0 accent-[var(--series-1)]"
                    />
                    <span className="min-w-0 flex-1 truncate text-ink">{mrItemLabel(entry)}</span>
                    <span className="shrink-0 font-mono text-xs text-ink-muted">{entry.inventory_items?.serial_number}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {(submitted || selectedIds.size > 0) && itemsError ? <p className="text-xs text-critical">{itemsError}</p> : null}
        </FormSection>

        <FormSection title="New MR details">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="New MR number"
              htmlFor="transfer-mr-number"
              required
              error={mrNumberTouched || submitted ? mrNumberError : undefined}
            >
              <input
                id="transfer-mr-number"
                className={`${fieldInputClass} font-mono`}
                value={mrNumber}
                onChange={(e) => setMrNumber(e.target.value)}
                onBlur={() => setMrNumberTouched(true)}
                autoFocus
              />
            </FormField>
            <FormField
              label="Expected return (optional)"
              htmlFor="transfer-expected-return"
              hint="Flags this MR as due soon or overdue on the ledger — leave blank if there's no fixed date."
            >
              <input
                id="transfer-expected-return"
                type="date"
                className={fieldInputClass}
                value={expectedReturnAt}
                onChange={(e) => setExpectedReturnAt(e.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="New custodian">
          <CustodianPicker
            selected={custodian}
            onSelect={(c) => {
              setCustodian(c);
              setCustodianTouched(true);
            }}
            error={custodianTouched || submitted ? custodianError : undefined}
          />
          <FormField label="Department (optional)" htmlFor="transfer-department">
            <Combobox
              id="transfer-department"
              value={departmentId}
              onChange={(v) => setDepartmentId(v ?? "")}
              options={(departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: d.label }))}
              placeholder="No department"
            />
          </FormField>
        </FormSection>

        <FormSection title="Notes">
          <FormField label="Notes (optional)" htmlFor="transfer-notes">
            <textarea
              id="transfer-notes"
              className={fieldInputClass}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </FormSection>

        {mutation.isError ? <p className="text-xs text-critical">{(mutation.error as Error).message}</p> : null}

        <div className="flex justify-end gap-2 border-t border-[color:var(--border-hairline)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {selectedIds.size > 0 ? `Transfer ${selectedIds.size} item${selectedIds.size === 1 ? "" : "s"}` : "Transfer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
