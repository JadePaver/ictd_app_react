import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { FormField, FormProblems, FormSection, TextArea } from "../../components/ui/FormField";
import { focusFirstProblem } from "../../components/ui/formFieldContext";
import { useToast } from "../../components/ui/toastContext";
import { ArrowRightIcon, CheckIcon, SplitIcon, TransferIcon } from "../../components/ui/icons";
import { mrApi, referenceApi } from "../../lib/resources";
import { dateInputToDueIso, isoToDateInput, mrItemLabel } from "../../lib/mrMetrics";
import { formatDateMedium, fullName } from "../../lib/format";
import { officeName } from "../../lib/inventory";
import type { Custodian, MemorandumReceiptDetail } from "../../types/api";
import { CustodianPicker } from "./CustodianPicker";
import { DueDateField } from "./DueDateField";
import { MR_NUMBER_TAKEN, MrNumberField } from "./MrNumberField";
import { useMrNumber } from "./useMrNumber";
import { CategoryTile, PersonLine } from "./InventoryAtoms";

/**
 * Transfers some or all of an active MR's items to a new custodian
 * (context doc 6.4 to 6.6). All active items start selected, the common
 * case; unticking some turns it into a split. Before anything is confirmed
 * the dialog spells out which items move, which stay, and what becomes of
 * the original MR, because a full transfer closes it and a split doesn't.
 *
 * `preselectedItemIds` scopes it to particular items up front (Transfer this
 * item, from an item's own page).
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
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const activeItems = useMemo(() => mr.items.filter((i) => i.status === "active"), [mr.items]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(preselectedItemIds ?? activeItems.map((i) => i.item_id)));
  const number = useMrNumber();
  const mrNumber = number.value;
  const [custodian, setCustodian] = useState<Custodian | null>(null);
  const [departmentId, setDepartmentId] = useState<number | "">(mr.department_id ?? "");
  // The due date carries over (context doc 6.4), unless it has already
  // passed: the new custodian shouldn't start out overdue for someone
  // else's lateness, so a lapsed date is dropped and flagged instead.
  const originalDueLapsed = !!mr.expected_return_at && new Date(mr.expected_return_at).getTime() < Date.now();
  const [dueDate, setDueDate] = useState(originalDueLapsed ? "" : isoToDateInput(mr.expected_return_at));
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Filed under carries over from the old MR; only when it had none does the
  // new custodian's own office step in.
  useEffect(() => {
    if (mr.department_id == null && custodian?.department_id != null) setDepartmentId(custodian.department_id);
  }, [custodian, mr.department_id]);

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });

  function toggle(itemId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const moving = activeItems.filter((i) => selectedIds.has(i.item_id));
  const staying = activeItems.length - moving.length;
  const isFull = moving.length > 0 && staying === 0;

  const mutation = useMutation({
    mutationFn: () =>
      mrApi.transfer(mr.id, {
        mrNumber: mrNumber.trim(),
        custodianId: custodian!.id,
        departmentId: departmentId === "" ? null : Number(departmentId),
        expectedReturnAt: dueDate ? dateInputToDueIso(dueDate) : undefined,
        notes: notes.trim() || undefined,
        itemIds: moving.map((i) => i.item_id),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["mr"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["custodians"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: `${mrNumber.trim()} issued to ${fullName(custodian)}`,
        description: res.data.isFullTransfer
          ? `${mr.mr_number} is closed as Transferred.`
          : `${moving.length} item${moving.length === 1 ? "" : "s"} split off. ${mr.mr_number} stays active with ${staying}.`,
      });
      onTransferred(res.data.id);
    },
    onError: (err) => {
      if ((err as { status?: number }).status === 409) void number.refresh();
    },
  });

  const mrNumberError = mrNumber.trim().length === 0 ? "MR number is required" : number.takenBy ? MR_NUMBER_TAKEN : undefined;
  const custodianError = !custodian ? "Select or add the new custodian" : undefined;
  const itemsError = moving.length === 0 ? "Select at least one item to transfer" : undefined;
  const problems = [
    custodianError ? { label: "New custodian", target: "transfer-custodian" } : null,
    mrNumberError ? { label: "MR number", target: "transfer-mr-number" } : null,
  ].filter((p) => p !== null);
  const newName = custodian ? fullName(custodian) : "the new custodian";

  return (
    <Modal
      title={
        <>
          Transfer <span className="font-mono">{mr.mr_number}</span>
        </>
      }
      subtitle="Custody moves to someone else on a new MR. The original is closed or split, never edited."
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          {mutation.isError ? <p className="w-full text-sm text-critical">{(mutation.error as Error).message}</p> : null}
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={mutation.isPending || moving.length === 0}>
            <TransferIcon size={14} />
            {mutation.isPending
              ? "Transferring…"
              : isFull && moving.length > 1
                ? `Transfer all ${moving.length} items`
                : `Transfer ${moving.length} item${moving.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        id={formId}
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (problems.length === 0 && !itemsError && !number.checking) mutation.mutate();
          else focusFirstProblem(formRef.current);
        }}
      >
        {submitted ? <FormProblems problems={problems} /> : null}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--border-hairline)] p-3.5">
          <PersonLine
            person={mr.custodian}
            size={36}
            strong
            sub={`Holds ${activeItems.length} item${activeItems.length === 1 ? "" : "s"} on ${mr.mr_number}`}
            className="min-w-0 flex-1"
          />
          <ArrowRightIcon size={18} className="shrink-0 text-ink-muted" />
          {custodian ? (
            <PersonLine person={custodian} size={36} strong sub="New custodian" className="min-w-0 flex-1" />
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-2.5 text-sm text-ink-muted">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[color:var(--baseline)]">?</span>
              Choose the new custodian below
            </span>
          )}
        </div>

        <FormSection title="Items to transfer" description={`${moving.length} of ${activeItems.length} selected. Untick any that should stay with ${fullName(mr.custodian)}.`}>
          <div className="flex items-center justify-end gap-3 text-xs">
            <button
              type="button"
              className="font-medium text-series-1 hover:underline disabled:text-ink-muted disabled:no-underline"
              onClick={() => setSelectedIds(new Set(activeItems.map((i) => i.item_id)))}
              disabled={isFull}
            >
              Select all
            </button>
            <span className="text-ink-muted">·</span>
            <button
              type="button"
              className="font-medium text-series-1 hover:underline disabled:text-ink-muted disabled:no-underline"
              onClick={() => setSelectedIds(new Set())}
              disabled={moving.length === 0}
            >
              Clear
            </button>
          </div>
          <ul className="flex max-h-72 flex-col divide-y divide-[color:var(--gridline)] overflow-y-auto rounded-xl border border-[color:var(--border-hairline)]">
            {activeItems.map((entry) => {
              const checked = selectedIds.has(entry.item_id);
              return (
                <li key={entry.id}>
                  <label
                    className={clsx(
                      "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-series-1",
                      checked ? "bg-series-1/[0.06]" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                    )}
                  >
                    <span
                      className={clsx(
                        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                        checked ? "border-series-1 bg-series-1 text-white" : "border-[color:var(--baseline)]",
                      )}
                    >
                      {checked ? <CheckIcon size={12} strokeWidth={3} /> : null}
                    </span>
                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(entry.item_id)} />
                    <CategoryTile code={entry.inventory_items?.item_categories?.code} assembled={entry.inventory_items?.is_assembled} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{mrItemLabel(entry)}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        <span className="font-mono">{entry.inventory_items?.serial_number}</span>
                        {entry.partsNow ? ` · +${entry.partsNow} part${entry.partsNow === 1 ? "" : "s"} go with it` : ""}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        checked ? "bg-series-1/15 text-series-1" : "bg-black/[0.05] text-ink-muted dark:bg-white/[0.08]",
                      )}
                    >
                      {checked ? "Moves" : "Stays"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {submitted && itemsError ? <p className="text-xs text-critical">{itemsError}</p> : null}

          <div
            className={clsx(
              "flex items-start gap-3 rounded-xl border p-3.5 text-sm",
              moving.length === 0
                ? "border-[color:var(--border-hairline)] text-ink-muted"
                : "border-series-2/25 bg-series-2/[0.06] text-ink-secondary",
            )}
          >
            <span className="mt-0.5 shrink-0 text-series-2">{isFull ? <TransferIcon size={16} /> : <SplitIcon size={16} />}</span>
            {moving.length === 0 ? (
              <p>Select at least one item to see what happens.</p>
            ) : isFull ? (
              <p>
                <span className="font-semibold text-ink">Full transfer.</span> {mr.mr_number} closes as Transferred and links forward to
                the new MR, which covers {moving.length === 1 ? "its one item" : `all ${moving.length} items`} for {newName}.
              </p>
            ) : (
              <p>
                <span className="font-semibold text-ink">Split.</span> {moving.length} of {activeItems.length} items move to a new MR for{" "}
                {newName}. {mr.mr_number} stays active with the remaining {staying} in {fullName(mr.custodian)}'s name, and the new MR is
                noted "Split from {mr.mr_number}".
              </p>
            )}
          </div>
        </FormSection>

        <div className="grid gap-6 lg:grid-cols-2">
          <FormSection title="New custodian">
            <CustodianPicker
              inputId="transfer-custodian"
              selected={custodian}
              onSelect={setCustodian}
              error={submitted ? custodianError : undefined}
              excludeId={mr.custodian_id}
              excludeReason={`Already holds ${mr.mr_number}`}
            />
            <FormField label="Filed under" htmlFor="transfer-department" hint="Carried over from the original MR.">
              <Combobox
                id="transfer-department"
                value={departmentId}
                onChange={(v) => setDepartmentId(v ?? "")}
                options={(departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: officeName(d) }))}
                placeholder="No office"
              />
            </FormField>
          </FormSection>

          <FormSection title="New MR">
            <MrNumberField id="transfer-mr-number" number={number} error={submitted ? mrNumberError : undefined} />
            <DueDateField id="transfer-due" value={dueDate} onChange={setDueDate} />
            {originalDueLapsed ? (
              <p className="-mt-1 text-xs text-[#8a5a00] dark:text-warning">
                {mr.mr_number} was due {formatDateMedium(mr.expected_return_at)}, which has passed, so the date wasn't carried over. Set a
                new one for {newName}.
              </p>
            ) : null}
            <FormField label="Notes (optional)" htmlFor="transfer-notes">
              <TextArea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Reassigned while Ana covers the collections window"
              />
            </FormField>
          </FormSection>
        </div>
      </form>
    </Modal>
  );
}
