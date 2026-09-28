import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { FormField, FormProblems, FormSection, TextArea, TextInput, type FieldProblem } from "../../components/ui/FormField";
import { focusFirstProblem } from "../../components/ui/formFieldContext";
import { Switch } from "../../components/ui/Switch";
import { Spinner } from "../../components/ui/Spinner";
import { AlertTriangleIcon, ArrowRightIcon, CheckCircleIcon, CheckIcon, ListIcon, PrintIcon, TagIcon, XIcon } from "../../components/ui/icons";
import { inventoryItemsApi, referenceApi, type RegisterFields } from "../../lib/resources";
import { officeName, registerStatusOptions, splitSerials } from "../../lib/inventory";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import type { InventoryItem, ItemRef, Par } from "../../types/api";
import { CategoryPicker, StatusPills } from "./ItemFormParts";
import { CategoryTile, ParTag, SerialTag } from "./InventoryAtoms";
import { ItemLabel, LabelSheetModal } from "./LabelSheet";
import { ParField } from "./ParField";
import type { RegisterMode } from "./ParFormModal";
import { useParLookup } from "./useParLookup";

/** Most serials a bulk run takes; the API caps it at the same number. */
const BULK_LIMIT = 500;

/** "The PAR used last in this sitting" (F2) outlives the dialog, so opening
 * Register items again for the next box starts on the same PAR. */
let lastParCode = "";

type LineState =
  | { kind: "ready" }
  | { kind: "checking" }
  | { kind: "repeated"; firstLine: number }
  | { kind: "registered"; item: ItemRef };

/** Which serials are already on file, any letter case, keyed upper-case. */
function useRegisteredSerials(serials: string[]) {
  const unique = useMemo(() => [...new Set(serials.map((s) => s.toUpperCase()))].sort(), [serials]);
  const query = useQuery({
    queryKey: ["check-serials", unique],
    queryFn: () => inventoryItemsApi.checkSerials(unique),
    enabled: unique.length > 0 && unique.length <= BULK_LIMIT,
    staleTime: 10_000,
  });
  const map = useMemo(() => {
    const m = new Map<string, ItemRef>();
    for (const row of query.data?.data ?? []) m.set(row.serial.toUpperCase(), row.item);
    return m;
  }, [query.data]);
  return { map, pending: unique.length > 0 && query.isPending, error: query.isError };
}

/**
 * Register items under a PAR: one at a time (F2) or in bulk (F3). Shared
 * details are entered once. The single form is built for a scanner: Enter
 * saves and clears only the serial, a counter keeps score, and Save opens
 * every label from the sitting on one A4 sheet (F7).
 */
export function RegisterItemsModal({
  initialMode = "single",
  initialPar,
  onClose,
  onOpenItem,
  onRegistered,
}: {
  initialMode?: RegisterMode;
  initialPar?: Par | null;
  onClose: () => void;
  /** Opens an item already on file (the "Already registered" card's Open). */
  onOpenItem?: (id: number) => void;
  /** Called with everything saved, when the operator is done. */
  onRegistered?: (items: InventoryItem[]) => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();
  const serialRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<RegisterMode>(initialMode);
  const [parCode, setParCode] = useState(initialPar?.par_code ?? lastParCode);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [statusId, setStatusId] = useState<number | "">("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [serial, setSerial] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [keepDetails, setKeepDetails] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState<InventoryItem[]>([]);
  const [sheet, setSheet] = useState<null | { items: InventoryItem[]; final: boolean }>(null);

  const parLookup = useParLookup(parCode);
  const par = parLookup.status === "found" ? parLookup.par : null;

  const categoriesQuery = useQuery({ queryKey: ["reference", "item-categories"], queryFn: referenceApi.itemCategories });
  const statusesQuery = useQuery({ queryKey: ["reference", "item-statuses"], queryFn: referenceApi.itemStatuses });
  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const categories = categoriesQuery.data?.data ?? [];
  const statuses = registerStatusOptions(statusesQuery.data?.data ?? []);
  const category = categories.find((c) => c.id === categoryId);
  const inStorage = statuses.find((s) => s.code === "in_storage");
  const effectiveStatusId = statusId === "" ? (inStorage?.id ?? "") : statusId;
  const status = statuses.find((s) => s.id === effectiveStatusId);
  const departmentOptions = useMemo(
    () => (departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: officeName(d) })),
    [departmentsQuery.data],
  );
  const department = departmentsQuery.data?.data.find((d) => d.id === departmentId) ?? null;

  useEffect(() => {
    if (par) lastParCode = par.par_code;
  }, [par]);

  // ---- Serial checks
  const debouncedSerial = useDebouncedValue(serial.trim(), 300);
  const singleCheck = useRegisteredSerials(useMemo(() => (debouncedSerial ? [debouncedSerial] : []), [debouncedSerial]));
  const serialTaken = serial.trim() && debouncedSerial.toUpperCase() === serial.trim().toUpperCase() ? singleCheck.map.get(debouncedSerial.toUpperCase()) : undefined;

  const lines = useMemo(() => splitSerials(bulkText), [bulkText]);
  const debouncedBulk = useDebouncedValue(lines.join("\n"), 400);
  const debouncedLines = useMemo(() => (debouncedBulk ? debouncedBulk.split("\n") : []), [debouncedBulk]);
  const bulkCheck = useRegisteredSerials(debouncedLines);
  const bulkSettled = debouncedBulk === lines.join("\n") && !bulkCheck.pending;

  const lineStates: LineState[] = useMemo(() => {
    const first = new Map<string, number>();
    return lines.map((s, i) => {
      const key = s.toUpperCase();
      const seen = first.get(key);
      if (seen !== undefined) return { kind: "repeated", firstLine: seen + 1 };
      first.set(key, i);
      const item = bulkCheck.map.get(key);
      if (item) return { kind: "registered", item };
      return bulkSettled ? { kind: "ready" } : { kind: "checking" };
    });
  }, [lines, bulkCheck.map, bulkSettled]);
  const badLines = lineStates.filter((l) => l.kind === "repeated" || l.kind === "registered").length;
  const readyCount = lineStates.filter((l) => l.kind === "ready").length;

  // ---- Validation
  const parError = !parCode.trim() ? "Select the PAR this item came in" : parLookup.status === "unknown" ? "No PAR with this code yet" : undefined;
  const categoryError = categoryId === "" ? "Choose a category" : undefined;
  const serialError = !serial.trim() ? "Enter the serial number" : serialTaken ? "An item with this serial number already exists" : undefined;
  const bulkError = lines.length === 0 ? "Add at least one serial number" : lines.length > BULK_LIMIT ? `Up to ${BULK_LIMIT} serials at a time` : undefined;

  function problemsFor(which: RegisterMode): FieldProblem[] {
    return [
      parError || !par ? { label: "PAR code", target: "register-par" } : null,
      categoryError ? { label: "Category", target: "register-category" } : null,
      which === "single"
        ? serialError
          ? { label: "Serial number", target: "register-serial" }
          : null
        : bulkError || badLines > 0
          ? { label: "Serial numbers", target: "register-serials" }
          : null,
    ].filter((p) => p !== null);
  }

  function fields(): RegisterFields {
    return {
      parId: par!.id,
      categoryId: Number(categoryId),
      statusId: effectiveStatusId === "" ? undefined : Number(effectiveStatusId),
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      departmentId: departmentId === "" ? null : Number(departmentId),
      description: description.trim() || undefined,
    };
  }

  function afterSave() {
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    queryClient.invalidateQueries({ queryKey: ["pars"] });
    queryClient.invalidateQueries({ queryKey: ["check-serials"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function clearForNext() {
    setSubmitted(false);
    if (!keepDetails) {
      setCategoryId("");
      setStatusId("");
      setBrand("");
      setModel("");
      setDepartmentId("");
      setDescription("");
    }
  }

  const single = useMutation({
    // `finish` rides along as the mutation variable: onSuccess is fixed when
    // mutate() runs, so reading a state flag there could be stale.
    mutationFn: (_v: { finish: boolean }) => inventoryItemsApi.create({ ...fields(), serialNumber: serial.trim() }),
    onSuccess: (res, { finish }) => {
      afterSave();
      const all = [...saved, res.data];
      setSaved(all);
      setSerial("");
      clearForNext();
      if (finish) setSheet({ items: all, final: true });
      else window.setTimeout(() => serialRef.current?.focus(), 0);
    },
  });

  const bulk = useMutation({
    mutationFn: () => inventoryItemsApi.bulk({ ...fields(), serialNumbers: lines }),
    onSuccess: (res) => {
      afterSave();
      setSaved((prev) => [...prev, ...res.data]);
      setSheet({ items: res.data, final: true });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ["check-serials"] }),
  });

  function submitSingle(finish: boolean) {
    // Save with an empty serial after a run of Save & add next: the sitting
    // is done, go straight to its labels.
    if (finish && !serial.trim() && saved.length > 0) {
      setSheet({ items: saved, final: true });
      return;
    }
    setSubmitted(true);
    if (problemsFor("single").length === 0) single.mutate({ finish });
    else focusFirstProblem(formRef.current);
  }

  function submitBulk() {
    setSubmitted(true);
    if (problemsFor("bulk").length === 0 && bulkSettled) bulk.mutate();
    else focusFirstProblem(formRef.current);
  }

  function removeProblemLines() {
    const keep = lines.filter((_, i) => lineStates[i].kind !== "repeated" && lineStates[i].kind !== "registered");
    setBulkText(keep.join("\n"));
  }

  const busy = single.isPending || bulk.isPending;
  const problems = submitted ? problemsFor(mode) : [];
  const mutationError = (mode === "single" ? single.error : bulk.error) as Error | null;

  const previewItem = {
    id: 0,
    serial_number: serial.trim() || "SERIAL NUMBER",
    brand: brand.trim() || null,
    model: model.trim() || null,
    description: description.trim() || null,
    item_categories: category ?? null,
    item_statuses: status ?? null,
    departments: department,
    par: par ? { id: par.id, par_code: par.par_code, supplier: par.supplier, date_received: par.date_received } : null,
    created_at: new Date().toISOString(),
  } as unknown as InventoryItem;

  function finishAndClose() {
    if (saved.length > 0) onRegistered?.(saved);
    onClose();
  }

  return (
    <>
      <Modal
        title="Register items"
        subtitle="Everything that came in one PAR, one at a time or as a pasted list."
        onClose={finishAndClose}
        width="max-w-5xl"
        footer={
          mode === "single" ? (
            <>
              {mutationError ? <p className="w-full text-sm text-critical">{mutationError.message}</p> : null}
              <Switch checked={keepDetails} onChange={setKeepDetails} label="Keep details for the next item" />
              {saved.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSheet({ items: saved, final: false })}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-secondary hover:bg-black/[0.04] hover:text-ink dark:hover:bg-white/[0.06]"
                >
                  <CheckCircleIcon size={14} className="text-good" />
                  {saved.length} saved · <span className="text-series-1 underline-offset-2 hover:underline">Print labels</span>
                </button>
              ) : null}
              <Button type="button" variant="ghost" onClick={finishAndClose} className="ml-auto">
                Cancel
              </Button>
              <Button type="submit" form={formId} variant="secondary" disabled={busy}>
                {single.isPending && !single.variables?.finish ? "Saving…" : "Save & add next"}
              </Button>
              <Button type="button" onClick={() => submitSingle(true)} disabled={busy}>
                {single.isPending && single.variables?.finish ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              {mutationError ? <p className="w-full text-sm text-critical">{mutationError.message}</p> : null}
              {submitted && badLines > 0 ? (
                <p className="text-sm font-medium text-critical">
                  Fix or remove {badLines} serial{badLines === 1 ? "" : "s"}
                </p>
              ) : null}
              <Button type="button" variant="ghost" onClick={finishAndClose} className="ml-auto">
                Cancel
              </Button>
              <Button type="submit" form={formId} disabled={busy || (lines.length > 0 && !bulkSettled)}>
                {bulk.isPending ? "Registering…" : lines.length > 0 && !bulkSettled ? "Checking serials…" : lines.length > 0 ? `Register ${lines.length} item${lines.length === 1 ? "" : "s"}` : "Register items"}
              </Button>
            </>
          )
        }
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="How to register" className="inline-flex rounded-lg border border-[color:var(--border-hairline)] bg-surface p-0.5">
            {(
              [
                ["single", "One at a time", TagIcon],
                ["bulk", "Bulk", ListIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => {
                  setMode(value);
                  setSubmitted(false);
                }}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === value ? "bg-series-1 text-white" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted">
            {mode === "single" ? "Press Enter in the serial field to save and start the next one." : "Shared details once, one serial per line."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <form
            ref={formRef}
            id={formId}
            noValidate
            className="flex min-w-0 flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "single") submitSingle(false);
              else submitBulk();
            }}
          >
            {problems.length > 0 ? <FormProblems problems={problems} /> : null}

            <FormSection title="Purchase">
              <ParField
                id="register-par"
                code={parCode}
                onCodeChange={setParCode}
                lookup={parLookup}
                required
                error={submitted ? parError : undefined}
                hint="The PAR on the delivery these items came in."
                autoFocus={!parCode}
              />
            </FormSection>

            <FormSection title="Classification">
              <FormField label="Category" htmlFor="register-category" required error={submitted ? categoryError : undefined}>
                <CategoryPicker
                  id="register-category"
                  categories={categories}
                  value={categoryId}
                  onChange={setCategoryId}
                  invalid={submitted && !!categoryError}
                />
              </FormField>
              <FormField label="Status" htmlFor="register-status" hint="In use is set by issuing an MR, so it isn't offered here.">
                <StatusPills id="register-status" options={statuses.map((s) => ({ status: s }))} value={effectiveStatusId} onChange={setStatusId} />
              </FormField>
            </FormSection>

            <FormSection title="Identification">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Brand" htmlFor="register-brand">
                  <TextInput value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Kingston" />
                </FormField>
                <FormField label="Model" htmlFor="register-model">
                  <TextInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Fury Beast 16GB DDR4" />
                </FormField>
              </div>
              {mode === "single" ? (
                <div className="flex flex-col gap-2">
                  <FormField
                    label="Serial number"
                    htmlFor="register-serial"
                    required
                    error={(submitted && !serial.trim()) || serialTaken ? serialError : undefined}
                    hint="As printed on the item. Letter case doesn't matter."
                  >
                    <TextInput
                      ref={serialRef}
                      mono
                      trailing={
                        serial.trim() && (debouncedSerial !== serial.trim() || singleCheck.pending) ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : serial.trim() && !serialTaken ? (
                          <CheckIcon size={14} className="text-good" />
                        ) : null
                      }
                      value={serial}
                      onChange={(e) => setSerial(e.target.value)}
                      placeholder="Type or scan"
                      autoComplete="off"
                      spellCheck={false}
                      autoFocus={!!parCode}
                    />
                  </FormField>
                  {serialTaken ? <ExistingItemCard item={serialTaken} onOpen={onOpenItem} /> : null}
                </div>
              ) : null}
            </FormSection>

            {mode === "bulk" ? (
              <FormSection title="Serial numbers" description="Paste a column from a spreadsheet, type them, or scan one per line.">
                <FormField label="Serial numbers" htmlFor="register-serials" required error={submitted ? bulkError : undefined}>
                  <TextArea
                    mono
                    rows={7}
                    maxRows={18}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={"KF432C16BB-A1F3\nKF432C16BB-A1F4\nKF432C16BB-A1F5"}
                    spellCheck={false}
                  />
                </FormField>
                {lines.length > 0 ? (
                  <BulkLines lines={lines} states={lineStates} onOpenItem={onOpenItem} badLines={badLines} onRemoveProblems={removeProblemLines} />
                ) : null}
              </FormSection>
            ) : null}

            <FormSection title="Assignment">
              <FormField label="Owning office" htmlFor="register-department" hint="The office this equipment belongs to.">
                <Combobox id="register-department" value={departmentId} onChange={(v) => setDepartmentId(v ?? "")} options={departmentOptions} placeholder="Not assigned" />
              </FormField>
              <FormField label="Description / specs" htmlFor="register-description">
                <TextArea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 16GB DDR4 3200MHz"
                />
              </FormField>
            </FormSection>
          </form>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start lg:border-l lg:border-[color:var(--border-hairline)] lg:pl-5">
            {mode === "single" ? (
              <>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">Label preview</h3>
                  <div className="flex justify-center rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.05]">
                    <ItemLabel item={previewItem} idText="#NEW" qrSize={120} className="w-52" />
                  </div>
                  <p className="text-xs text-ink-muted">The item number is given when you save.</p>
                </div>
                {saved.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">Saved this sitting · {saved.length}</h3>
                    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                      {[...saved].reverse().map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-xs">
                          <CheckIcon size={12} className="shrink-0 text-good" />
                          <span className="font-mono text-ink-secondary">#{item.id}</span>
                          <span className="min-w-0 truncate font-mono text-ink">{item.serial_number}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">Summary</h3>
                <p className="text-2xl font-semibold text-ink tabular-nums">
                  {lines.length}
                  <span className="ml-1.5 text-sm font-normal text-ink-muted">item{lines.length === 1 ? "" : "s"} will be created</span>
                </p>
                <div className="flex items-center gap-2.5">
                  <CategoryTile code={category?.code} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{category?.label ?? "No category yet"}</p>
                    <p className="truncate text-xs text-ink-muted">{[brand.trim(), model.trim()].filter(Boolean).join(" ") || "No brand or model"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-secondary">
                  {par ? <ParTag code={par.par_code} /> : <span className="text-ink-muted">No PAR yet</span>}
                  <span>·</span>
                  <span>{status?.label ?? "In storage"}</span>
                </div>
                <div className="rounded-lg border border-[color:var(--border-hairline)] p-3 text-xs text-ink-secondary">
                  <p className="flex items-center gap-1.5">
                    <PrintIcon size={13} className="text-ink-muted" />
                    {lines.length} QR label{lines.length === 1 ? "" : "s"} print after saving
                  </p>
                  {lines.length > 0 ? (
                    <p className="mt-1.5 text-ink-muted">
                      {readyCount} ready{badLines > 0 ? ` · ${badLines} to fix` : ""}
                    </p>
                  ) : null}
                </div>
                <p className="text-xs text-ink-muted">All or nothing: one bad serial stops the whole list, so nothing is half registered.</p>
              </div>
            )}
          </aside>
        </div>
      </Modal>

      {sheet ? (
        <LabelSheetModal
          items={sheet.items}
          subtitle={
            sheet.final
              ? `${sheet.items.length} item${sheet.items.length === 1 ? "" : "s"} registered${par ? ` under ${par.par_code}` : ""}. Print the labels and stick each on its item.`
              : "Every label from this sitting so far."
          }
          onClose={() => {
            setSheet(null);
            if (sheet.final) finishAndClose();
          }}
          registerNextLabel={sheet.final ? "Register next" : "Back to the form"}
          onRegisterNext={() => {
            setSheet(null);
            if (sheet.final) {
              // A new sitting: these labels are printed. Details stay by the
              // Keep details switch; the PAR always stays.
              if (saved.length > 0) onRegistered?.(saved);
              setSaved([]);
              setBulkText("");
              clearForNext();
            }
            window.setTimeout(() => (mode === "single" ? serialRef.current : document.getElementById("register-serials"))?.focus(), 0);
          }}
        />
      ) : null}
    </>
  );
}

/** "An item with this serial number already exists", with that item. */
function ExistingItemCard({ item, onOpen }: { item: ItemRef; onOpen?: (id: number) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-critical/25 bg-critical/[0.05] px-3 py-2">
      <AlertTriangleIcon size={15} className="shrink-0 text-critical" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          <span className="font-mono text-ink-muted">#{item.id}</span> {item.name}
        </p>
        <SerialTag value={item.serial_number} />
      </div>
      {onOpen ? (
        <Button type="button" variant="secondary" onClick={() => onOpen(item.id)} className="px-2.5 py-1 text-xs">
          Open
          <ArrowRightIcon size={12} />
        </Button>
      ) : null}
    </div>
  );
}

/** Each pasted line with its check: Ready, Repeated, or Already registered. */
function BulkLines({
  lines,
  states,
  badLines,
  onRemoveProblems,
  onOpenItem,
}: {
  lines: string[];
  states: LineState[];
  badLines: number;
  onRemoveProblems: () => void;
  onOpenItem?: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">
          {lines.length} line{lines.length === 1 ? "" : "s"}
          {badLines > 0 ? <span className="font-medium text-critical"> · {badLines} with problems</span> : null}
        </p>
        {badLines > 0 ? (
          <Button type="button" variant="ghost" onClick={onRemoveProblems} className="px-2 py-1 text-xs whitespace-nowrap text-critical">
            <XIcon size={12} />
            Remove problem lines
          </Button>
        ) : null}
      </div>
      <ol className="max-h-72 divide-y divide-[color:var(--gridline)] overflow-y-auto rounded-lg border border-[color:var(--border-hairline)]">
        {lines.map((serial, i) => {
          const state = states[i];
          return (
            <li
              key={`${i}-${serial}`}
              className={clsx("flex items-baseline gap-3 px-3 py-1.5 text-sm", state.kind === "registered" || state.kind === "repeated" ? "bg-critical/[0.04]" : null)}
            >
              <span className="w-7 shrink-0 text-right font-mono text-[11px] text-ink-muted tabular-nums">{i + 1}</span>
              {/* The serial keeps its full width; on a narrow screen the
                  status drops to its own line instead of hiding it. */}
              <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="max-w-full shrink-0 truncate font-mono text-[13px] text-ink">{serial}</span>
                <LineBadge state={state} onOpenItem={onOpenItem} />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LineBadge({ state, onOpenItem }: { state: LineState; onOpenItem?: (id: number) => void }) {
  switch (state.kind) {
    case "ready":
      return (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-good">
          <CheckIcon size={12} />
          Ready
        </span>
      );
    case "checking":
      return <span className="shrink-0 text-xs text-ink-muted">Checking…</span>;
    case "repeated":
      return (
        <span className="shrink-0 text-xs font-medium text-[#8a5a00] dark:text-warning">Repeated · same as line {state.firstLine}</span>
      );
    case "registered":
      return (
        <span className="flex min-w-0 shrink items-center gap-1 text-xs font-medium text-critical">
          <span className="truncate">
            Already registered · #{state.item.id} {state.item.name}
          </span>
          {onOpenItem ? (
            <button type="button" onClick={() => onOpenItem(state.item.id)} className="shrink-0 underline underline-offset-2 hover:no-underline">
              Open
            </button>
          ) : null}
        </span>
      );
  }
}

