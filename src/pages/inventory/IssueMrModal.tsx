import { useEffect, useId, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { SearchInput } from "../../components/ui/SearchInput";
import { FormField, FormProblems, FormSection, TextArea } from "../../components/ui/FormField";
import { focusFirstProblem } from "../../components/ui/formFieldContext";
import { useToast } from "../../components/ui/toastContext";
import { AlertTriangleIcon, CheckIcon, XIcon } from "../../components/ui/icons";
import { inventoryItemsApi, mrApi, referenceApi } from "../../lib/resources";
import { dateInputToDueIso } from "../../lib/mrMetrics";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { formatDateMedium, fullName } from "../../lib/format";
import { itemDisplayName, officeName } from "../../lib/inventory";
import type { Custodian, InventoryItem } from "../../types/api";
import { CustodianPicker } from "./CustodianPicker";
import { DueDateField } from "./DueDateField";
import { MR_NUMBER_TAKEN, MrNumberField } from "./MrNumberField";
import { useMrNumber } from "./useMrNumber";
import { CategoryTile, ItemStatusBadge } from "./InventoryAtoms";

const PICKER_PAGE = 40;

/**
 * Issues a new MR: a numbered receipt, a custodian (searched or added on the
 * spot), the office it is filed under, and one or more items. Items already
 * on an active MR can't be picked (rule 1), and each says who has it.
 *
 * `initialCustodian` skips the search when the custodian is already known
 * (Issue MR from a custodian's record). `onIssued` receives the new MR's id
 * so the caller can open it straight away, ready to print for signature.
 */
export function IssueMrModal({
  initialCustodian,
  onClose,
  onIssued,
}: {
  initialCustodian?: Custodian;
  onClose: () => void;
  onIssued?: (mrId: number) => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [custodian, setCustodian] = useState<Custodian | null>(initialCustodian ?? null);
  const [departmentId, setDepartmentId] = useState<number | "">(initialCustodian?.department_id ?? "");
  const [departmentEdited, setDepartmentEdited] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<InventoryItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const number = useMrNumber();
  const mrNumber = number.value;

  // The MR's office defaults to the custodian's own, until the operator
  // picks one on purpose.
  useEffect(() => {
    if (!departmentEdited) setDepartmentId(custodian?.department_id ?? "");
  }, [custodian, departmentEdited]);

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const categoriesQuery = useQuery({ queryKey: ["reference", "item-categories"], queryFn: referenceApi.itemCategories });

  const debouncedItemSearch = useDebouncedValue(itemSearch.trim());
  const itemsQuery = useQuery({
    queryKey: ["inventory-items", "picker", { itemSearch: debouncedItemSearch, categoryId, availableOnly }],
    queryFn: () =>
      inventoryItemsApi.list({
        search: debouncedItemSearch || undefined,
        categoryId,
        availability: availableOnly ? "available" : "all",
        // Installed parts travel with their PC and never get a line of their
        // own; they only show when searched for, to say so (context doc 6.6).
        placement: debouncedItemSearch ? undefined : "top_level",
        sortBy: "brand",
        sortDir: "asc",
        pageSize: PICKER_PAGE,
      }),
    placeholderData: keepPreviousData,
  });

  const selectedIds = useMemo(() => new Set(selected.map((i) => i.id)), [selected]);
  const departmentOptions = useMemo(
    () => (departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: officeName(d) })),
    [departmentsQuery.data],
  );

  function toggle(item: InventoryItem) {
    setSelected((current) => (current.some((i) => i.id === item.id) ? current.filter((i) => i.id !== item.id) : [...current, item]));
  }

  const mutation = useMutation({
    mutationFn: () =>
      mrApi.issue({
        mrNumber: mrNumber.trim(),
        custodianId: custodian!.id,
        departmentId: departmentId === "" ? null : Number(departmentId),
        itemIds: selected.map((i) => i.id),
        expectedReturnAt: dueDate ? dateInputToDueIso(dueDate) : undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["mr"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["custodians"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: `${mrNumber.trim()} issued`,
        description: `${selected.length} item${selected.length === 1 ? "" : "s"} to ${fullName(custodian)}. Print it for signature.`,
      });
      if (onIssued) onIssued(res.data.id);
      else onClose();
    },
    // A number taken meanwhile: offer a fresh one instead of a dead end.
    onError: (err) => {
      if ((err as { status?: number }).status === 409) void number.refresh();
    },
  });

  const mrNumberError = mrNumber.trim().length === 0 ? "MR number is required" : number.takenBy ? MR_NUMBER_TAKEN : undefined;
  const custodianError = !custodian ? "Select or add a custodian" : undefined;
  const itemsError = selected.length === 0 ? "Select at least one item" : undefined;
  const problems = [
    mrNumberError ? { label: "MR number", target: "mr-number" } : null,
    custodianError ? { label: "Custodian", target: "mr-custodian" } : null,
    itemsError ? { label: "Items", target: "mr-items" } : null,
  ].filter((p) => p !== null);

  const notInStorage = selected.filter((i) => i.item_statuses?.code && i.item_statuses.code !== "in_storage");
  const partsAlong = selected.reduce((n, i) => n + (i.partCount ?? 0), 0);
  const rows = itemsQuery.data?.data ?? [];
  const total = itemsQuery.data?.total ?? 0;

  return (
    <Modal
      title="Issue a memorandum receipt"
      subtitle="Place one or more items in a custodian's care. They become In use."
      onClose={onClose}
      width="max-w-6xl"
      footer={
        <>
          <p className="min-w-0 flex-1 text-sm text-ink-secondary">
            {selected.length > 0 && custodian ? (
              <>
                <span className="font-semibold text-ink">
                  {selected.length} item{selected.length === 1 ? "" : "s"}
                </span>
                {partsAlong > 0 ? ` (plus ${partsAlong} part${partsAlong === 1 ? "" : "s"} inside)` : ""}{" "}
                to <span className="font-semibold text-ink">{fullName(custodian)}</span>
                {dueDate ? `, due ${formatDateMedium(dateInputToDueIso(dueDate))}` : ", no due date"}
              </>
            ) : (
              "Choose a custodian and at least one item."
            )}
          </p>
          {mutation.isError ? <p className="w-full text-sm text-critical sm:order-first">{(mutation.error as Error).message}</p> : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={mutation.isPending}>
            {mutation.isPending ? "Issuing…" : "Issue MR"}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        id={formId}
        noValidate
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (problems.length === 0 && !number.checking) mutation.mutate();
          else focusFirstProblem(formRef.current);
        }}
      >
        {submitted && problems.length > 0 ? (
          <div className="lg:col-span-2">
            <FormProblems problems={problems} />
          </div>
        ) : null}
        <div className="flex flex-col gap-5">
          <FormSection title="Receipt" description="The reference number goes on the printed, signed form.">
            <MrNumberField id="mr-number" number={number} error={submitted ? mrNumberError : undefined} />
            <DueDateField id="mr-due" value={dueDate} onChange={setDueDate} />
          </FormSection>

          <FormSection title="Custodian" description="The person who signs for these items and is accountable for them.">
            <CustodianPicker inputId="mr-custodian" selected={custodian} onSelect={setCustodian} error={submitted ? custodianError : undefined} />
            <FormField
              label="Filed under"
              htmlFor="mr-department"
              hint={departmentEdited ? "The office this MR is filed under." : "Defaults to the custodian's office. Change it if the MR belongs elsewhere."}
            >
              <Combobox
                id="mr-department"
                value={departmentId}
                onChange={(v) => {
                  setDepartmentEdited(true);
                  setDepartmentId(v ?? "");
                }}
                options={departmentOptions}
                placeholder="No office"
              />
            </FormField>
          </FormSection>

          <FormSection title="Notes">
            <FormField label="Notes (optional)" htmlFor="mr-notes" hint="Printed on the receipt.">
              <TextArea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Workstation for the new disbursement desk"
              />
            </FormField>
          </FormSection>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Items</h3>
              <p className="text-xs text-ink-muted">Items already on an MR can't be picked. A PC's parts go with it.</p>
            </div>
            <span className={clsx("text-sm font-semibold tabular-nums", selected.length ? "text-series-1" : "text-ink-muted")}>
              {selected.length} selected
            </span>
          </div>

          <div
            id="mr-items"
            role="group"
            aria-label="Selected items"
            aria-invalid={(submitted && !!itemsError) || undefined}
            tabIndex={-1}
            className={clsx(
              "flex min-h-[3.25rem] flex-wrap content-start gap-1.5 rounded-xl border p-2 outline-none",
              submitted && itemsError ? "border-critical/50 bg-critical/[0.03]" : "border-dashed border-[color:var(--border-hairline)]",
            )}
          >
            {selected.length === 0 ? (
              <p className={clsx("self-center px-1.5 text-sm", submitted && itemsError ? "text-critical" : "text-ink-muted")}>
                {submitted && itemsError ? itemsError : "Tick items below to add them to this MR."}
              </p>
            ) : (
              selected.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-series-1/30 bg-series-1/[0.08] py-1 pr-1 pl-2.5 text-xs font-medium text-ink"
                >
                  <span className="truncate">{item.partCount ? `PC #${item.id} · ${itemDisplayName(item)}` : itemDisplayName(item)}</span>
                  <span className="font-mono text-[10px] text-ink-muted">{item.serial_number}</span>
                  {item.partCount ? (
                    <span className="rounded-full bg-series-1/15 px-1.5 text-[10px] font-semibold text-series-1">
                      +{item.partCount} part{item.partCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    aria-label={`Remove ${item.serial_number}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-ink-muted hover:bg-black/[0.06] hover:text-ink dark:hover:bg-white/[0.1]"
                  >
                    <XIcon size={11} />
                  </button>
                </span>
              ))
            )}
          </div>
          {notInStorage.length > 0 ? (
            <p className="flex items-start gap-1.5 text-xs text-[#8a5a00] dark:text-warning">
              <AlertTriangleIcon size={13} className="mt-px shrink-0" />
              {notInStorage.map((i) => `${i.serial_number} (${i.item_statuses?.label})`).join(", ")}{" "}
              {notInStorage.length === 1 ? "is" : "are"} not in storage. Issuing sets {notInStorage.length === 1 ? "it" : "them"} to In use.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={itemSearch} onChange={setItemSearch} placeholder="Serial number, brand, model…" className="min-w-48 flex-1" />
            <Combobox
              value={categoryId}
              onChange={setCategoryId}
              options={(categoriesQuery.data?.data ?? []).map((c) => ({ value: c.id, label: c.label }))}
              placeholder="Any category"
              ariaLabel="Category"
              className="w-44"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-secondary select-none">
            <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />
            Only show items with ICTD
          </label>

          <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)]">
            <ul className={clsx("max-h-[26rem] divide-y divide-[color:var(--gridline)] overflow-y-auto", itemsQuery.isPlaceholderData && "opacity-60")}>
              {rows.map((item) => {
                const checked = selectedIds.has(item.id);
                const installedIn = item.installed_in_item_id;
                const holder = installedIn ? null : item.currentCustody;
                const blocked = (!!holder || !!installedIn) && !checked;
                const blockedReason = installedIn
                  ? `Installed in PC #${installedIn}. Issue the PC instead.`
                  : holder
                    ? "Already in use on another active MR"
                    : undefined;
                return (
                  <li key={item.id}>
                    <label
                      title={blocked ? blockedReason : undefined}
                      className={clsx(
                        "flex items-center gap-3 px-3 py-2.5 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-series-1",
                        blocked ? "cursor-not-allowed bg-black/[0.02] dark:bg-white/[0.02]" : "cursor-pointer",
                        checked ? "bg-series-1/[0.07]" : !blocked && "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                          checked ? "border-series-1 bg-series-1 text-white" : "border-[color:var(--baseline)]",
                          blocked && "opacity-40",
                        )}
                      >
                        {checked ? <CheckIcon size={12} strokeWidth={3} /> : null}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={blocked}
                        onChange={() => toggle(item)}
                      />
                      <CategoryTile code={item.item_categories?.code} assembled={item.is_assembled} size={32} className={clsx(blocked && "opacity-50")} />
                      <span className={clsx("min-w-0 flex-1", blocked && "opacity-60")}>
                        <span className="block truncate text-sm font-medium text-ink">{itemDisplayName(item)}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          <span className="font-mono">{item.serial_number}</span>
                          {installedIn
                            ? ` · Installed in PC #${installedIn}. Issue the PC instead.`
                            : holder
                              ? ` · On ${holder.mrNumber} with ${fullName(holder.custodian)}`
                              : item.partCount
                                ? ` · ${item.partCount} part${item.partCount === 1 ? "" : "s"} inside`
                                : ""}
                        </span>
                      </span>
                      <ItemStatusBadge status={item.item_statuses} />
                    </label>
                  </li>
                );
              })}
            </ul>
            {itemsQuery.data && rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-muted">No items match. Try a serial number or a different category.</p>
            ) : null}
            {total > rows.length ? (
              <p className="border-t border-[color:var(--border-hairline)] px-3 py-2 text-xs text-ink-muted">
                Showing {rows.length} of {total}. Search to narrow it down.
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </Modal>
  );
}
