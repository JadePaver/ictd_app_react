import { useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { FormField, FormProblems, FormSection, TextArea, TextInput } from "../../components/ui/FormField";
import { focusFirstProblem } from "../../components/ui/formFieldContext";
import { Switch } from "../../components/ui/Switch";
import { Spinner } from "../../components/ui/Spinner";
import { CheckIcon, InfoIcon, TowerIcon } from "../../components/ui/icons";
import { inventoryItemsApi, referenceApi } from "../../lib/resources";
import { describeFromParts, itemDisplayName, officeName } from "../../lib/inventory";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import type { InventoryItem } from "../../types/api";
import { CategoryTag, SerialTag } from "./InventoryAtoms";
import { LabelSheetModal } from "./LabelSheet";
import { ParField } from "./ParField";
import { PartsPicker } from "./PartsPicker";
import { useParLookup } from "./useParLookup";

/**
 * Assemble PC (form F5): a computer record built by ICTD from parts in
 * storage. It takes an ICTD asset tag in place of a maker serial, starts In
 * storage, and every picked part reads "Installed in PC #id" once it's
 * saved. One transaction: the PC and its installations land together or
 * not at all (rule 23).
 */
export function AssemblePcModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (pc: InventoryItem, parts: InventoryItem[]) => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();

  const tagQuery = useQuery({ queryKey: ["inventory-items", "next-pc-tag"], queryFn: inventoryItemsApi.nextPcTag, staleTime: 0 });
  const suggestedTag = tagQuery.data?.data.assetTag ?? "";

  const [assetTag, setAssetTag] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [parCode, setParCode] = useState("");
  const [autoDescription, setAutoDescription] = useState(true);
  const [description, setDescription] = useState("");
  const [parts, setParts] = useState<InventoryItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState<{ pc: InventoryItem; parts: InventoryItem[] } | null>(null);

  // Shown upper-case in the field, so saved that way too.
  const tag = (assetTag ?? suggestedTag).trim().toUpperCase();
  const parLookup = useParLookup(parCode);
  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const departmentOptions = useMemo(
    () => (departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: officeName(d) })),
    [departmentsQuery.data],
  );

  const builtDescription = describeFromParts(parts);
  const shownDescription = autoDescription ? builtDescription : description;

  const debouncedTag = useDebouncedValue(tag, 300);
  const tagCheck = useQuery({
    queryKey: ["check-serials", [debouncedTag.toUpperCase()]],
    queryFn: () => inventoryItemsApi.checkSerials([debouncedTag]),
    enabled: debouncedTag.length > 0,
  });
  const tagTaken = debouncedTag.toUpperCase() === tag.toUpperCase() ? tagCheck.data?.data[0]?.item : undefined;
  const checkingTag = !!tag && (debouncedTag !== tag || tagCheck.isLoading);

  const tagError = !tag ? "Enter an asset tag" : tagTaken ? "An item with this serial or asset tag already exists" : undefined;
  const partsError = parts.length === 0 ? "Add at least one part" : undefined;
  const parError = parCode.trim() && parLookup.status === "unknown" ? "No PAR with this code yet" : undefined;
  const problems = [
    tagError ? { label: "Asset tag", target: "pc-tag" } : null,
    parError ? { label: "PAR code", target: "pc-par" } : null,
    partsError ? { label: "Parts", target: "pc-parts" } : null,
  ].filter((p) => p !== null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await inventoryItemsApi.assemble({
        assetTag: tag,
        partIds: parts.map((p) => p.id),
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        departmentId: departmentId === "" ? null : Number(departmentId),
        parId: parLookup.status === "found" ? parLookup.par!.id : null,
        description: shownDescription.trim() || undefined,
      });
      return (await inventoryItemsApi.get(res.data.id)).data;
    },
    onSuccess: (pc) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["check-serials"] });
      queryClient.invalidateQueries({ queryKey: ["pars"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDone({ pc, parts: pc.parts });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ["inventory-items", "next-pc-tag"] }),
  });

  function submit() {
    setSubmitted(true);
    if (problems.length === 0) mutation.mutate();
    else focusFirstProblem(formRef.current);
  }

  if (done) {
    return (
      <LabelSheetModal
        items={[done.pc]}
        title={`PC #${done.pc.id} assembled`}
        subtitle={`${itemDisplayName(done.pc)} · ${done.pc.serial_number}. It starts In storage. Print its label and stick it on the case.`}
        note={
          <div className="rounded-lg border border-[color:var(--border-hairline)] p-3">
            <p className="mb-2 text-xs font-semibold tracking-wider text-ink-muted uppercase">
              {done.parts.length} part{done.parts.length === 1 ? "" : "s"} now installed in PC #{done.pc.id}
            </p>
            <ul className="flex flex-col gap-1.5">
              {done.parts.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <CategoryTag label={p.item_categories?.code === "storage" ? "Storage" : p.item_categories?.code} />
                  <span className="min-w-0 truncate text-ink">{itemDisplayName(p)}</span>
                  <SerialTag value={p.serial_number} className="ml-auto" />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-muted">Their own labels stay as they are. A scan of any of them shows "Installed in PC #{done.pc.id}".</p>
          </div>
        }
        onClose={() => {
          onCreated?.(done.pc, done.parts);
          onClose();
        }}
        registerNextLabel="Assemble another"
        onRegisterNext={() => {
          onCreated?.(done.pc, done.parts);
          setDone(null);
          setAssetTag(null);
          setParts([]);
          setBrand("");
          setModel("");
          setDescription("");
          setAutoDescription(true);
          setSubmitted(false);
          mutation.reset();
          void queryClient.invalidateQueries({ queryKey: ["inventory-items", "next-pc-tag"] });
        }}
      />
    );
  }

  return (
    <Modal
      title="Assemble PC"
      subtitle="Build a computer record from parts in storage."
      onClose={onClose}
      width="max-w-6xl"
      footer={
        <>
          {mutation.isError ? <p className="w-full text-sm text-critical">{(mutation.error as Error).message}</p> : null}
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <InfoIcon size={13} />
            The PC starts In storage. Issue it on an MR and its parts go with it.
          </p>
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={mutation.isPending}>
            <TowerIcon size={15} />
            {mutation.isPending ? "Creating…" : parts.length > 0 ? `Create PC with ${parts.length} part${parts.length === 1 ? "" : "s"}` : "Create PC"}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-5"
      >
        {submitted ? <FormProblems problems={problems} /> : null}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <FormSection title="PC details">
              <FormField
                label="Asset tag"
                htmlFor="pc-tag"
                required
                error={(submitted && !tag) || tagTaken ? tagError : undefined}
                hint="Printed on the label in place of a maker serial."
              >
                <TextInput
                  mono
                  className="uppercase placeholder:normal-case"
                  trailing={checkingTag ? <Spinner className="h-3.5 w-3.5" /> : tag && !tagTaken ? <CheckIcon size={14} className="text-good" /> : null}
                  value={assetTag ?? suggestedTag}
                  onChange={(e) => setAssetTag(e.target.value)}
                  placeholder={tagQuery.isLoading ? "Getting the next tag…" : "PC-2026-0001"}
                  autoComplete="off"
                  spellCheck={false}
                />
              </FormField>
              {assetTag !== null && suggestedTag && assetTag.trim().toUpperCase() !== suggestedTag.toUpperCase() ? (
                <button
                  type="button"
                  onClick={() => setAssetTag(null)}
                  className="-mt-2 self-start rounded-md px-1.5 py-0.5 text-xs font-medium text-series-1 hover:bg-series-1/10"
                >
                  Use <span className="font-mono">{suggestedTag}</span>
                </button>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <FormField label="Brand" htmlFor="pc-brand">
                  <TextInput value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Leave empty for a custom build" />
                </FormField>
                <FormField label="Model" htmlFor="pc-model" hint="Its name on lists and labels.">
                  <TextInput value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Accounting Workstation" />
                </FormField>
              </div>
              <FormField label="Owning office" htmlFor="pc-department">
                <Combobox id="pc-department" value={departmentId} onChange={(v) => setDepartmentId(v ?? "")} options={departmentOptions} placeholder="Not assigned" />
              </FormField>
              <ParField
                id="pc-par"
                code={parCode}
                onCodeChange={setParCode}
                lookup={parLookup}
                error={submitted ? parError : undefined}
                hint="Only if the PC was bought as one purchase. Parts keep their own PAR."
              />
            </FormSection>
            <FormSection title="Description / specs">
              <TextArea
                id="pc-description"
                aria-label="Description / specs"
                rows={3}
                value={shownDescription}
                onChange={(e) => {
                  setAutoDescription(false);
                  setDescription(e.target.value);
                }}
                placeholder="Built from the parts you pick"
              />
              <Switch
                checked={autoDescription}
                onChange={(on) => {
                  setAutoDescription(on);
                  if (!on) setDescription(builtDescription);
                }}
                label="Build from the parts"
              />
            </FormSection>
          </div>

          <div
            id="pc-parts"
            role="group"
            aria-labelledby="pc-parts-heading"
            aria-invalid={(submitted && !!partsError) || undefined}
            tabIndex={-1}
            className="flex min-w-0 flex-col gap-2 outline-none lg:border-l lg:border-[color:var(--border-hairline)] lg:pl-6"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="pc-parts-heading" className="text-sm font-semibold text-ink">
                Parts{" "}
                <span className="text-critical" aria-hidden="true">
                  *
                </span>
              </h3>
              <span className="text-xs text-ink-muted">
                {parts.length === 0 ? "None picked yet" : `${parts.length} picked`}
              </span>
            </div>
            <p className="-mt-1 text-xs text-ink-muted">Only loose parts in storage can go in. The rest show why.</p>
            {submitted && partsError ? <p className="text-xs font-medium text-critical">{partsError}</p> : null}
            <PartsPicker selected={parts} onChange={setParts} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
