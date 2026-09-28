import { useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { FormField, FormProblems, FormSection, TextArea, TextInput } from "../../components/ui/FormField";
import { focusFirstProblem } from "../../components/ui/formFieldContext";
import { Spinner } from "../../components/ui/Spinner";
import { AlertTriangleIcon, CheckIcon, InfoIcon, LayersIcon, PrintIcon, TrashIcon } from "../../components/ui/icons";
import { inventoryItemsApi, referenceApi } from "../../lib/resources";
import { itemDisplayName, officeName, placementText, sortParts } from "../../lib/inventory";
import { fullName } from "../../lib/format";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import type { InventoryItem, InventoryItemDetail } from "../../types/api";
import { CategoryTag, CategoryTile, ItemStatusBadge, SerialTag } from "./InventoryAtoms";
import { CategoryPicker, StatusPills, type StatusOption } from "./ItemFormParts";
import { ItemLabel } from "./LabelSheet";
import { printLabelSheet } from "../../lib/labelPrint";
import { ParField } from "./ParField";
import { useParLookup } from "./useParLookup";

/**
 * Edit an item and its status (form F4). Status follows rule 26: In use and
 * In storage belong to the MR flows, so the one that would contradict the
 * item's custody is locked and says why. An installed part follows its PC
 * (rule 19): category and status are read-only here, with a way to its PC.
 */
export function ItemFormModal({
  item,
  onClose,
  onSaved,
  onManageParts,
  onDelete,
}: {
  item: InventoryItemDetail;
  onClose: () => void;
  onSaved?: (item: InventoryItem, options: { reprint: boolean }) => void;
  /** Opens Manage parts for this PC, or for the PC this part is in. */
  onManageParts?: (hostId: number) => void;
  /** Starts the delete flow. Only offered when the item has no history. */
  onDelete?: () => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();
  const labelCanvas = useRef<HTMLCanvasElement | null>(null);

  const [parCode, setParCode] = useState(item.par?.par_code ?? "");
  const [categoryId, setCategoryId] = useState<number | "">(item.category_id ?? "");
  const [statusId, setStatusId] = useState<number | "">(item.status_id ?? "");
  const [brand, setBrand] = useState(item.brand ?? "");
  const [model, setModel] = useState(item.model ?? "");
  const [serialNumber, setSerialNumber] = useState(item.serial_number);
  const [departmentId, setDepartmentId] = useState<number | "">(item.department_id ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [submitted, setSubmitted] = useState(false);

  const parLookup = useParLookup(parCode);
  const categoriesQuery = useQuery({ queryKey: ["reference", "item-categories"], queryFn: referenceApi.itemCategories });
  const statusesQuery = useQuery({ queryKey: ["reference", "item-statuses"], queryFn: referenceApi.itemStatuses });
  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const departmentOptions = useMemo(
    () => (departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: officeName(d) })),
    [departmentsQuery.data],
  );

  const hostId = item.installed_in_item_id;
  const installed = hostId != null;
  const parts = sortParts(item.parts ?? []);
  const isHost = parts.length > 0;
  const custody = item.currentCustody;
  const ownMr = custody && !custody.via ? custody : null;
  const serialLabel = item.is_assembled ? "Asset tag" : "Serial number";

  const statuses = statusesQuery.data?.data ?? [];
  const chosen = statuses.find((s) => s.id === statusId);
  const statusOptions: StatusOption[] = statuses.map((s) => {
    if (installed) return { status: s, lockedReason: `Follows PC #${hostId}` };
    if (s.code === "in_use" && !ownMr) return { status: s, lockedReason: "In use is set automatically when the item is issued on an MR." };
    if (s.code === "in_storage" && ownMr) return { status: s, lockedReason: `In storage is set automatically when ${ownMr.mrNumber} is returned.` };
    return { status: s };
  });
  const lockedNotes = statusOptions.filter((o) => o.lockedReason && o.status.id !== statusId && !installed).map((o) => o.lockedReason!);

  // ---- Live serial check (itself excluded)
  const trimmedSerial = serialNumber.trim();
  const debouncedSerial = useDebouncedValue(trimmedSerial, 300);
  const serialChanged = trimmedSerial.toUpperCase() !== item.serial_number.toUpperCase();
  const serialCheck = useQuery({
    queryKey: ["check-serials", [debouncedSerial.toUpperCase()]],
    queryFn: () => inventoryItemsApi.checkSerials([debouncedSerial]),
    enabled: serialChanged && debouncedSerial.length > 0,
  });
  const clash = serialChanged && debouncedSerial === trimmedSerial ? serialCheck.data?.data.find((r) => r.item.id !== item.id)?.item : undefined;
  const checkingSerial = serialChanged && !!trimmedSerial && (debouncedSerial !== trimmedSerial || serialCheck.isLoading);

  // ---- Validation
  const parRemoved = item.par_id != null && !parCode.trim();
  const parError = parRemoved
    ? "An item's PAR can be changed but not removed."
    : parCode.trim() && parLookup.status === "unknown"
      ? "No PAR with this code yet"
      : undefined;
  const serialError = !trimmedSerial
    ? `Enter the ${serialLabel.toLowerCase()}`
    : clash
      ? item.is_assembled
        ? "An item with this serial or asset tag already exists"
        : "An item with this serial number already exists"
      : undefined;
  const categoryError = categoryId === "" ? "Choose a category" : undefined;
  const problems = [
    parError ? { label: "PAR code", target: "edit-par" } : null,
    categoryError ? { label: "Category", target: "edit-category" } : null,
    serialError ? { label: serialLabel, target: "edit-serial" } : null,
  ].filter((p) => p !== null);

  const newParId = parLookup.status === "found" ? parLookup.par!.id : item.par_id;
  const changes = {
    parId: newParId !== item.par_id ? newParId : undefined,
    categoryId: categoryId !== item.category_id && categoryId !== "" ? Number(categoryId) : undefined,
    statusId: statusId !== item.status_id && statusId !== "" ? Number(statusId) : undefined,
    brand: brand.trim() !== (item.brand ?? "") ? brand.trim() || null : undefined,
    model: model.trim() !== (item.model ?? "") ? model.trim() || null : undefined,
    serialNumber: trimmedSerial !== item.serial_number ? trimmedSerial : undefined,
    departmentId: (departmentId === "" ? null : departmentId) !== item.department_id ? (departmentId === "" ? null : Number(departmentId)) : undefined,
    description: description.trim() !== (item.description ?? "") ? description.trim() || null : undefined,
  };
  const dirty = Object.values(changes).some((v) => v !== undefined) || (parCode.trim() !== (item.par?.par_code ?? "") && parLookup.status !== "found");
  const nameChanged = changes.brand !== undefined || changes.model !== undefined || changes.serialNumber !== undefined;

  const mutation = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
      return inventoryItemsApi.update(item.id, body);
    },
    onSuccess: (res) => {
      // The saved fields land in the open detail at once, so reopening Edit
      // before the refetch below finishes can't start from the old values.
      queryClient.setQueryData<{ data: InventoryItemDetail }>(["inventory-items", item.id], (old) =>
        old ? { data: { ...old.data, ...res.data } } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["pars"] });
      queryClient.invalidateQueries({ queryKey: ["check-serials"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["mr"] });
      if (onSaved) onSaved(res.data, { reprint: nameChanged });
      else onClose();
    },
  });

  function submit() {
    setSubmitted(true);
    // A PAR code still being looked up would otherwise save without it.
    if (parLookup.status === "checking") return;
    if (problems.length > 0) focusFirstProblem(formRef.current);
    else if (dirty) mutation.mutate();
  }

  // ---- Notes under Status (F4)
  const statusNotes: { tone: "info" | "warning"; text: string }[] = [];
  if (!installed) {
    if (ownMr && chosen && chosen.id !== item.status_id) {
      statusNotes.push({ tone: "info", text: `Stays on ${ownMr.mrNumber} with ${fullName(ownMr.custodian)}. Only its condition changes.` });
    }
    if (chosen?.code === "missing" && chosen.id !== item.status_id) {
      statusNotes.push({ tone: "warning", text: "Missing items get a standing alert until they are found." });
    }
    if (isHost && chosen && chosen.id !== item.status_id) {
      statusNotes.push({
        tone: chosen.code === "decommissioned" ? "warning" : "info",
        text:
          chosen.code === "decommissioned"
            ? `Its ${parts.length} installed part${parts.length === 1 ? "" : "s"} will be decommissioned too. Remove any you want to reuse first.`
            : `Its ${parts.length} installed part${parts.length === 1 ? "" : "s"} will show the same status.`,
      });
    }
  }

  const hasHistory = (item.custodyHistory?.length ?? 0) > 0 || (item.installations?.length ?? 0) > 0;

  return (
    <Modal
      title="Edit item"
      subtitle={`${itemDisplayName(item)} · ${item.serial_number}`}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <>
          {mutation.isError ? <p className="w-full text-sm text-critical">{(mutation.error as Error).message}</p> : null}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="text-critical hover:bg-critical/10 dark:hover:bg-critical/15"
              onClick={onDelete}
              disabled={hasHistory}
              title={hasHistory ? "Has custody or assembly history. Mark it decommissioned instead." : undefined}
            >
              <TrashIcon size={14} />
              Delete item
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!dirty || mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <form
          ref={formRef}
          id={formId}
          noValidate
          className="flex min-w-0 flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {/* Header card */}
          <div className="flex items-center gap-3.5 rounded-xl border border-[color:var(--border-hairline)] p-3.5">
            <CategoryTile code={item.item_categories?.code} assembled={item.is_assembled} size={40} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-ink-muted">ICTD INVENTORY #{item.id}</p>
              <p className="truncate text-sm font-semibold text-ink">{itemDisplayName(item)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <ItemStatusBadge status={item.item_statuses} />
                <span className="text-xs text-ink-secondary">{placementText(item)}</span>
              </div>
            </div>
          </div>

          {submitted && problems.length > 0 ? <FormProblems problems={problems} /> : null}

          <FormSection title="Purchase">
            <ParField
              id="edit-par"
              code={parCode}
              onCodeChange={setParCode}
              lookup={parLookup}
              required={item.par_id != null}
              error={parError && (submitted || parRemoved) ? parError : undefined}
              hint={
                item.is_assembled
                  ? "Only if the PC was bought as one purchase."
                  : item.par_id == null
                    ? "Registered before PARs. Add its PAR when you know it."
                    : undefined
              }
            />
          </FormSection>

          <FormSection title="Classification">
            <FormField label="Category" htmlFor="edit-category" required error={submitted ? categoryError : undefined}>
              <CategoryPicker
                id="edit-category"
                categories={categoriesQuery.data?.data ?? []}
                value={categoryId}
                onChange={setCategoryId}
                lockedReason={
                  installed
                    ? `Follows PC #${hostId}. Remove it from the PC to change it.`
                    : isHost
                      ? `Holds ${parts.length} part${parts.length === 1 ? "" : "s"}. Remove them to change its category.`
                      : undefined
                }
              />
            </FormField>
            <FormField label="Status" htmlFor="edit-status">
              <StatusPills id="edit-status" options={statusOptions} value={statusId} onChange={setStatusId} />
            </FormField>
            {installed ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--border-hairline)] bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                <LayersIcon size={16} className="shrink-0 text-ink-muted" />
                <p className="min-w-0 flex-1 text-sm text-ink-secondary">
                  Follows PC #{hostId}. Remove it from the PC to change its status on its own.
                </p>
                {onManageParts ? (
                  <Button type="button" variant="secondary" onClick={() => onManageParts(hostId!)} className="px-2.5 py-1 text-xs">
                    Manage parts
                  </Button>
                ) : null}
              </div>
            ) : null}
            {statusNotes.map((note) => (
              <p
                key={note.text}
                className={clsx(
                  "-mt-1 flex items-start gap-1.5 text-xs",
                  note.tone === "warning" ? "font-medium text-[#8a5a00] dark:text-warning" : "text-ink-secondary",
                )}
              >
                {note.tone === "warning" ? <AlertTriangleIcon size={13} className="mt-px shrink-0" /> : <InfoIcon size={13} className="mt-px shrink-0" />}
                {note.text}
              </p>
            ))}
            {lockedNotes.length > 0 ? (
              <ul className="-mt-1 flex flex-col gap-0.5">
                {lockedNotes.map((text) => (
                  <li key={text} className="text-xs text-ink-muted">
                    {text}
                  </li>
                ))}
              </ul>
            ) : null}
          </FormSection>

          <FormSection title="Identification">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Brand" htmlFor="edit-brand">
                <TextInput
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder={item.is_assembled ? "Leave empty for a custom build" : "e.g. Dell"}
                />
              </FormField>
              <FormField label="Model" htmlFor="edit-model">
                <TextInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Latitude 5420" />
              </FormField>
            </div>
            <FormField
              label={serialLabel}
              htmlFor="edit-serial"
              required
              error={(submitted && !trimmedSerial) || clash ? serialError : undefined}
              hint="Must be unique across all items. Letter case doesn't matter."
            >
              <TextInput
                mono
                trailing={
                  checkingSerial ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : serialChanged && trimmedSerial && !clash ? (
                    <CheckIcon size={14} className="text-good" />
                  ) : null
                }
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>
            {clash ? (
              <p className="-mt-1 text-xs text-ink-secondary">
                Taken by <span className="font-mono">#{clash.id}</span> {clash.name}.
              </p>
            ) : null}
          </FormSection>

          <FormSection title="Assignment">
            <FormField label="Owning office" htmlFor="edit-department" hint="The office this equipment belongs to. Not necessarily where its custodian works.">
              <Combobox id="edit-department" value={departmentId} onChange={(v) => setDepartmentId(v ?? "")} options={departmentOptions} placeholder="Not assigned" />
            </FormField>
            <FormField label="Description / specs" htmlFor="edit-description">
              <TextArea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. i5 / 16GB RAM / 512GB SSD"
              />
            </FormField>
          </FormSection>

          {item.item_categories?.can_host_parts ? (
            <FormSection title="Parts in this PC">
              {isHost ? (
                <ul className="divide-y divide-[color:var(--gridline)] rounded-lg border border-[color:var(--border-hairline)]">
                  {parts.map((p) => (
                    <li key={p.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                      <CategoryTag label={p.item_categories?.code === "storage" ? "Storage" : p.item_categories?.code} />
                      <span className="min-w-0 flex-1 truncate text-ink">{itemDisplayName(p)}</span>
                      <SerialTag value={p.serial_number} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">No parts recorded inside.</p>
              )}
              {onManageParts ? (
                <Button type="button" variant="secondary" onClick={() => onManageParts(item.id)} className="self-start">
                  Manage parts
                </Button>
              ) : null}
            </FormSection>
          ) : null}
        </form>

        <aside className="flex flex-col gap-2 lg:border-l lg:border-[color:var(--border-hairline)] lg:pl-5">
          <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">Current label</h3>
          <div className="flex justify-center rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.05]">
            <ItemLabel
              item={item}
              qrSize={118}
              className="w-48"
              canvasRef={(el) => {
                labelCanvas.current = el;
              }}
            />
          </div>
          {nameChanged ? (
            <p className="flex items-start gap-1.5 text-xs font-medium text-[#8a5a00] dark:text-warning">
              <AlertTriangleIcon size={13} className="mt-px shrink-0" />
              The name or serial changes on save. Reprint the label afterwards.
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (labelCanvas.current) printLabelSheet([{ item, qrDataUrl: labelCanvas.current.toDataURL("image/png") }]);
            }}
          >
            <PrintIcon size={14} />
            Print label
          </Button>
        </aside>
      </div>
    </Modal>
  );
}
