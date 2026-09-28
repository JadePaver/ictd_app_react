import { useId, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { FormField, FormProblems, FormSection, TextArea, TextInput } from "../../components/ui/FormField";
import { focusFirstProblem } from "../../components/ui/formFieldContext";
import { CheckIcon, ListIcon, ReceiptIcon, TagIcon } from "../../components/ui/icons";
import { parsApi } from "../../lib/resources";
import { formatCalendarDate, todayYmd } from "../../lib/format";
import { formatPeso } from "../../lib/inventory";
import { useAuth } from "../../context/AuthContext";
import type { Par } from "../../types/api";
import { useParLookup } from "./useParLookup";

/** Digits with optional thousands commas and up to 2 decimals. */
const AMOUNT_PATTERN = /^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;

/** An amount as typed, minus what people paste along with it: the peso
 * sign and spaces ("₱ 248,600.00"). */
function cleanAmount(text: string): string {
  return text.replace(/[₱\s]/g, "");
}

function amountToText(amount: Par["amount"]): string {
  if (amount === null || amount === undefined || amount === "") return "";
  return formatPeso(amount)?.replace("₱", "") ?? String(amount);
}

export type RegisterMode = "single" | "bulk";

/**
 * Record or edit a PAR (form F1). Recent PARs sit beside the form so a
 * delivery recorded twice is caught by eye. After a new PAR is saved the
 * dialog turns into the next step: register its items one at a time or in
 * bulk (6.1). Opened from a PAR field's "Create this PAR", it hands the new
 * PAR back instead.
 */
export function ParFormModal({
  par,
  initialCode,
  onClose,
  onCreated,
  onRegister,
  onSaved,
}: {
  par?: Par;
  initialCode?: string;
  onClose: () => void;
  /** Inline creation: return the new PAR to the caller, skip the success view. */
  onCreated?: (par: Par) => void;
  /** Success view actions. */
  onRegister?: (par: Par, mode: RegisterMode) => void;
  onSaved?: (par: Par) => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isEdit = !!par;
  const operatorName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

  const [code, setCode] = useState(par?.par_code ?? initialCode ?? "");
  const [dateReceived, setDateReceived] = useState(par?.date_received ?? todayYmd());
  const [referenceNo, setReferenceNo] = useState(par?.reference_no ?? "");
  const [supplier, setSupplier] = useState(par?.supplier ?? "");
  const [amount, setAmount] = useState(amountToText(par?.amount ?? null));
  const [receivedBy, setReceivedBy] = useState(par?.received_by ?? (isEdit ? "" : operatorName));
  const [remarks, setRemarks] = useState(par?.remarks ?? "");
  const [submitted, setSubmitted] = useState(false);
  // A format problem shows once the operator leaves the field, not while
  // "248,6" is on its way to "248,600.00".
  const [amountTouched, setAmountTouched] = useState(false);
  const [saved, setSaved] = useState<Par | null>(null);

  const lookup = useParLookup(code);
  const recentQuery = useQuery({
    queryKey: ["pars", "list", { sortBy: "createdAt", pageSize: 6 }],
    queryFn: () => parsApi.list({ sortBy: "createdAt", sortDir: "desc", pageSize: 6 }),
  });

  const taken = lookup.status === "found" && lookup.par && lookup.par.id !== par?.id;
  const codeError = !code.trim() ? (submitted ? "Enter the PAR code" : undefined) : taken ? "A PAR with this code already exists" : undefined;
  const dateError = !dateReceived && submitted ? "Enter the date it was received" : undefined;
  const amountText = cleanAmount(amount);
  const amountError = amountText && !AMOUNT_PATTERN.test(amountText) ? "Numbers only, like 248,600.00" : undefined;
  const problems = [
    !code.trim() || taken ? { label: "PAR code", target: "par-code" } : null,
    !dateReceived ? { label: "Date received", target: "par-date" } : null,
    amountError ? { label: "Amount", target: "par-amount" } : null,
  ].filter((p) => p !== null);

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        parCode: code.trim().toUpperCase(),
        dateReceived,
        referenceNo: referenceNo.trim() || null,
        supplier: supplier.trim() || null,
        amount: amountText || null,
        receivedBy: receivedBy.trim() || null,
        remarks: remarks.trim() || null,
      };
      return isEdit ? parsApi.update(par!.id, body) : parsApi.create(body);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["pars"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      if (isEdit) {
        if (onSaved) onSaved(res.data);
        else onClose();
      } else if (onCreated) onCreated(res.data);
      else setSaved(res.data);
    },
  });

  function submit() {
    setSubmitted(true);
    if (problems.length === 0) mutation.mutate();
    else focusFirstProblem(formRef.current);
  }

  if (saved) {
    return (
      <Modal
        title="PAR saved"
        onClose={onClose}
        width="max-w-lg"
        footer={
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-xl border border-good/25 bg-good/[0.07] p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-good/15 text-good">
              <CheckIcon size={18} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-ink">{saved.par_code}</p>
              <p className="truncate text-xs text-ink-secondary">
                {[saved.supplier, `received ${formatCalendarDate(saved.date_received)}`, formatPeso(saved.amount)].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Now register what came in it</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <NextStepCard
                icon={<TagIcon size={18} />}
                title="One at a time"
                hint="Type or scan each serial. Save & add next keeps the details."
                onClick={() => onRegister?.(saved, "single")}
              />
              <NextStepCard
                icon={<ListIcon size={18} />}
                title="In bulk"
                hint="Paste a list of serials that share the same details."
                onClick={() => onRegister?.(saved, "bulk")}
              />
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  const recent = recentQuery.data?.data ?? [];

  return (
    <Modal
      title={isEdit ? `Edit ${par!.par_code}` : "New PAR"}
      subtitle={isEdit ? "Changes apply to every item linked to this PAR." : "One purchase delivery, under the code printed on its paper PAR."}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          {mutation.isError ? <p className="w-full text-sm text-critical">{(mutation.error as Error).message}</p> : null}
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Save PAR"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
        <form
          ref={formRef}
          id={formId}
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {submitted ? <FormProblems problems={problems} /> : null}
          <FormSection title="Delivery">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="PAR code" htmlFor="par-code" required error={codeError} hint="As printed on the paper PAR.">
                <TextInput
                  mono
                  className="uppercase placeholder:normal-case"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. PAR-2026-0012"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus={!initialCode}
                />
              </FormField>
              <FormField label="Date received" htmlFor="par-date" required error={dateError}>
                <TextInput
                  type="date"
                  value={dateReceived}
                  max={todayYmd()}
                  onChange={(e) => setDateReceived(e.target.value)}
                />
              </FormField>
              <FormField label="PO / reference no." htmlFor="par-ref">
                <TextInput
                  mono
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. PO-2026-0418"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="Supplier" htmlFor="par-supplier">
                <TextInput
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Bacolod Tech Supply"
                  autoComplete="off"
                  autoFocus={!!initialCode}
                />
              </FormField>
            </div>
          </FormSection>
          <FormSection title="Receipt">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                label="Amount (PHP)"
                htmlFor="par-amount"
                error={amountTouched || submitted ? amountError : undefined}
                hint="The PAR's total. Commas are optional."
              >
                <TextInput
                  leading="₱"
                  className="text-right tabular-nums"
                  value={amount}
                  inputMode="decimal"
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => {
                    setAmountTouched(true);
                    if (amountText && AMOUNT_PATTERN.test(amountText)) setAmount(amountToText(amountText));
                  }}
                  placeholder="248,600.00"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="Received by" htmlFor="par-received-by">
                <TextInput
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="Who signed for the delivery"
                  autoComplete="off"
                />
              </FormField>
            </div>
            <FormField label="Remarks" htmlFor="par-remarks">
              <TextArea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Delivered in 3 boxes"
              />
            </FormField>
          </FormSection>
        </form>

        <aside className="flex flex-col gap-2 md:border-l md:border-[color:var(--border-hairline)] md:pl-5">
          <h3 className="text-xs font-semibold tracking-wider text-ink-muted uppercase">Recent PARs</h3>
          <p className="text-xs text-ink-muted">Check the delivery isn't already here.</p>
          {recent.length === 0 ? (
            <p className="py-4 text-sm text-ink-muted">{recentQuery.isLoading ? "Loading…" : "No PARs yet. This will be the first."}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {recent.map((r) => {
                const same = code.trim() && r.par_code.toUpperCase() === code.trim().toUpperCase() && r.id !== par?.id;
                return (
                  <li
                    key={r.id}
                    className={clsx(
                      "rounded-lg border px-3 py-2",
                      same ? "border-critical/40 bg-critical/[0.06]" : "border-[color:var(--border-hairline)]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs font-semibold text-ink">
                        <ReceiptIcon size={12} className="shrink-0 text-ink-muted" />
                        <span className="truncate">{r.par_code}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-muted tabular-nums">
                        {r.itemCount ?? 0} item{r.itemCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-secondary">{r.supplier || "No supplier"}</p>
                    <p className="text-[11px] text-ink-muted">{formatCalendarDate(r.date_received)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </Modal>
  );
}

function NextStepCard({ icon, title, hint, onClick }: { icon: ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-xl border border-[color:var(--border-hairline)] p-4 text-left transition hover:border-series-1/50 hover:bg-series-1/[0.05] focus-visible:outline-2 focus-visible:outline-series-1"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-series-1/10 text-series-1">{icon}</span>
      <span className="text-sm font-semibold text-ink">{title}</span>
      <span className="text-xs text-ink-muted">{hint}</span>
    </button>
  );
}
