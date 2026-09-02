import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { Badge } from "../../components/ui/Badge";
import { FormField, FormSection, fieldInputClass } from "../../components/ui/FormField";
import { XIcon } from "../../components/ui/icons";
import { inventoryItemsApi, mrApi, referenceApi } from "../../lib/resources";
import { itemStatusTone } from "../../lib/statusStyles";
import { CustodianPicker } from "./CustodianPicker";
import type { Custodian, InventoryItem } from "../../types/api";

/** Issues a new MR — picks a custodian (search-or-add, see CustodianPicker),
 * an optional department, one or more inventory items (search + checklist,
 * with a removable chip list so a long selection stays easy to review), an
 * optional expected return date, and notes.
 *
 * `initialCustodian` lets a caller (CustodianDetailModal's "Issue MR"
 * action) skip the search step entirely when the custodian is already
 * known — the field still shows as editable via CustodianPicker's "Change". */
export function IssueMrModal({ initialCustodian, onClose }: { initialCustodian?: Custodian; onClose: () => void }) {
  const queryClient = useQueryClient();

  const [mrNumber, setMrNumber] = useState("");
  const [mrNumberTouched, setMrNumberTouched] = useState(false);
  const [custodian, setCustodian] = useState<Custodian | null>(initialCustodian ?? null);
  const [custodianTouched, setCustodianTouched] = useState(false);
  const [departmentId, setDepartmentId] = useState<number | "">(initialCustodian?.department_id ?? "");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const [itemsTouched, setItemsTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const nextNumberQuery = useQuery({ queryKey: ["mr", "next-number"], queryFn: mrApi.nextNumber });
  useEffect(() => {
    if (nextNumberQuery.data && !mrNumber) setMrNumber(nextNumberQuery.data.data.mrNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextNumberQuery.data]);

  // Custodian's own department is a sensible default for "which office does
  // this MR belong to" — operators can still override it below.
  useEffect(() => {
    if (custodian?.department_id != null && departmentId === "") setDepartmentId(custodian.department_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custodian]);

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const itemsQuery = useQuery({
    queryKey: ["inventory-items", "picker", itemSearch],
    queryFn: () => inventoryItemsApi.list({ search: itemSearch || undefined, pageSize: 20 }),
  });

  const selectedIds = useMemo(() => new Set(selectedItems.map((i) => i.id)), [selectedItems]);

  const mutation = useMutation({
    mutationFn: () =>
      mrApi.issue({
        mrNumber: mrNumber.trim(),
        custodianId: custodian!.id,
        departmentId: departmentId === "" ? undefined : Number(departmentId),
        itemIds: selectedItems.map((i) => i.id),
        expectedReturnAt: expectedReturnAt || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mr"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  function toggleItem(item: InventoryItem) {
    setSelectedItems((current) =>
      current.some((i) => i.id === item.id) ? current.filter((i) => i.id !== item.id) : [...current, item],
    );
  }

  const mrNumberError = mrNumber.trim().length === 0 ? "MR number is required" : undefined;
  const custodianError = !custodian ? "Select or add a custodian" : undefined;
  const itemsError = selectedItems.length === 0 ? "Select at least one item" : undefined;
  const canSubmit = !mrNumberError && !custodianError && !itemsError;

  return (
    <Modal title="Issue a new MR" onClose={onClose} width="max-w-xl">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          setMrNumberTouched(true);
          setCustodianTouched(true);
          setItemsTouched(true);
          if (canSubmit) mutation.mutate();
        }}
      >
        <FormSection title="MR details" description="A unique reference number and, optionally, when items are expected back.">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="MR number"
              htmlFor="mr-number"
              required
              error={mrNumberTouched || submitted ? mrNumberError : undefined}
            >
              <input
                id="mr-number"
                className={`${fieldInputClass} font-mono`}
                value={mrNumber}
                onChange={(e) => setMrNumber(e.target.value)}
                onBlur={() => setMrNumberTouched(true)}
                autoFocus
              />
            </FormField>
            <FormField
              label="Expected return (optional)"
              htmlFor="mr-expected-return"
              hint="Flags this MR as due soon or overdue on the ledger — leave blank if there's no fixed date."
            >
              <input
                id="mr-expected-return"
                type="date"
                className={fieldInputClass}
                value={expectedReturnAt}
                onChange={(e) => setExpectedReturnAt(e.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Custodian" description="Who will have custody of these items. Doesn't need a dashboard login.">
          <CustodianPicker
            selected={custodian}
            onSelect={(c) => {
              setCustodian(c);
              setCustodianTouched(true);
            }}
            error={custodianTouched || submitted ? custodianError : undefined}
          />
          <FormField label="Department (optional)" htmlFor="mr-department" hint="Defaults to the custodian's own department.">
            <Combobox
              id="mr-department"
              value={departmentId}
              onChange={(v) => setDepartmentId(v ?? "")}
              options={(departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: d.label }))}
              placeholder="No department"
            />
          </FormField>
        </FormSection>

        <FormSection title="Items" description="Search across the whole inventory — checked items are added to the selection below.">
          <div className="flex flex-col gap-2">
            {selectedItems.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedItems.map((item) => {
                  const name = [item.brand, item.model].filter(Boolean).join(" ") || item.item_categories?.label || "Item";
                  return (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-series-1/10 px-2.5 py-1 text-xs font-medium text-series-1"
                    >
                      {name}
                      <span className="font-mono text-[10px] opacity-80">{item.serial_number}</span>
                      <button
                        type="button"
                        onClick={() => toggleItem(item)}
                        aria-label={`Remove ${name}`}
                        className="rounded-full hover:opacity-70"
                      >
                        <XIcon size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : null}

            <FormField
              label={`Search items (${selectedItems.length} selected)`}
              htmlFor="mr-item-search"
              error={itemsTouched || submitted ? itemsError : undefined}
            >
              <input
                id="mr-item-search"
                className={fieldInputClass}
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                onBlur={() => setItemsTouched(true)}
                placeholder="Serial number, brand, model…"
              />
            </FormField>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-[color:var(--border-hairline)] p-1">
              {itemsQuery.data?.data.map((item) => {
                const name = [item.brand, item.model].filter(Boolean).join(" ") || item.item_categories?.label || "Item";
                const checked = selectedIds.has(item.id);
                // This app only ever sets "in_use" via an MR issue, so it's
                // a reliable proxy for "already claimed elsewhere" — worth
                // blocking here rather than letting the operator fill out
                // the whole form and hit the server's 409 conflict instead.
                const inUse = !checked && item.item_statuses?.code === "in_use";
                return (
                  <label
                    key={item.id}
                    title={inUse ? "Already in use on another active MR" : undefined}
                    className={clsx(
                      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      inUse
                        ? "cursor-not-allowed text-ink-muted opacity-60"
                        : checked
                          ? "cursor-pointer bg-series-1/10 text-ink"
                          : "cursor-pointer text-ink hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={inUse}
                        onChange={() => {
                          toggleItem(item);
                          setItemsTouched(true);
                        }}
                      />
                      {name}
                      <span className="font-mono text-xs text-ink-muted">{item.serial_number}</span>
                    </span>
                    <Badge tone={itemStatusTone(item.item_statuses?.code)}>{item.item_statuses?.label ?? "—"}</Badge>
                  </label>
                );
              })}
              {itemsQuery.data && itemsQuery.data.data.length === 0 ? (
                <p className="px-2 py-2 text-sm text-ink-muted">No matches.</p>
              ) : null}
            </div>
          </div>
        </FormSection>

        <FormSection title="Notes">
          <FormField label="Notes (optional)" htmlFor="mr-notes">
            <textarea
              id="mr-notes"
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
            Issue MR
          </Button>
        </div>
      </form>
    </Modal>
  );
}
