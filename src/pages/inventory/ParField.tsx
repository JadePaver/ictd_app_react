import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { FieldLabel, FieldMessage, TextInput } from "../../components/ui/FormField";
import { Spinner } from "../../components/ui/Spinner";
import { AlertTriangleIcon, CheckCircleIcon, PlusIcon, ReceiptIcon } from "../../components/ui/icons";
import { parsApi } from "../../lib/resources";
import { parSummary } from "../../lib/inventory";
import type { Par } from "../../types/api";
import { ParFormModal } from "./ParFormModal";
import { parCodeKey, type ParLookup } from "./useParLookup";

/**
 * The PAR field on the register, assemble and edit forms (F2, F4, F5): type
 * the code as printed, or tap one of the three most recent. It confirms what
 * it found in words, and an unknown code offers "Create this PAR" in place,
 * so a delivery nobody recorded yet doesn't send the operator off the form.
 */
export function ParField({
  id,
  code,
  onCodeChange,
  lookup,
  required,
  error,
  hint,
  autoFocus,
  disabled,
}: {
  id: string;
  code: string;
  onCodeChange: (code: string) => void;
  lookup: ParLookup;
  required?: boolean;
  /** Shown once the form has been submitted or the field left. */
  error?: string;
  /** Shown while the field is empty. */
  hint?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const recentQuery = useQuery({
    queryKey: ["pars", "recent"],
    queryFn: () => parsApi.list({ sortBy: "createdAt", sortDir: "desc", pageSize: 3 }),
    staleTime: 30_000,
  });
  const recent = recentQuery.data?.data ?? [];
  const trimmed = code.trim();
  const invalid = !!error && lookup.status !== "found";

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} required={required}>
        PAR code
      </FieldLabel>
      <TextInput
        id={id}
        mono
        className="uppercase placeholder:normal-case"
        leading={<ReceiptIcon size={15} />}
        trailing={
          lookup.status === "checking" ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : lookup.status === "found" ? (
            <CheckCircleIcon size={15} className="text-good" />
          ) : null
        }
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder="e.g. PAR-2026-0012"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        disabled={disabled}
        invalid={invalid}
        aria-required={required || undefined}
        aria-describedby={`${id}-status`}
      />

      <div id={`${id}-status`} aria-live="polite" className="min-h-[1.25rem]">
        {lookup.status === "found" && lookup.par ? (
          <p className="text-xs text-ink-secondary">{parSummary(lookup.par)}</p>
        ) : lookup.status === "unknown" ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <p className="inline-flex items-center gap-1 text-xs font-medium text-[#8a5a00] dark:text-warning">
              <AlertTriangleIcon size={12} />
              No PAR with this code yet
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-series-1 hover:bg-series-1/10"
            >
              <PlusIcon size={12} />
              Create this PAR
            </button>
            {lookup.similar.length > 0 ? (
              <span className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                Did you mean
                {lookup.similar.slice(0, 3).map((par) => (
                  <ParChip key={par.id} par={par} onPick={onCodeChange} />
                ))}
              </span>
            ) : null}
          </div>
        ) : lookup.status === "error" ? (
          <FieldMessage id={`${id}-message`} error="Couldn't check this PAR. Try again in a moment." />
        ) : (
          <FieldMessage id={`${id}-message`} error={error} hint={trimmed ? undefined : hint} />
        )}
      </div>

      {recent.length > 0 && !disabled ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-muted">Recent</span>
          {recent.map((par) => (
            <ParChip key={par.id} par={par} active={lookup.par?.id === par.id} onPick={onCodeChange} />
          ))}
        </div>
      ) : null}

      {creating ? (
        <ParFormModal
          initialCode={trimmed.toUpperCase()}
          onClose={() => setCreating(false)}
          onCreated={(par) => {
            // Seed the exact-code lookup so the field resolves at once
            // instead of showing "checking" for a PAR we already hold.
            queryClient.setQueryData(parCodeKey(par.par_code), { data: [{ ...par, itemCount: 0 }], total: 1, page: 0, pageSize: 1 });
            onCodeChange(par.par_code);
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ParChip({ par, active, onPick }: { par: Par; active?: boolean; onPick: (code: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(par.par_code)}
      title={parSummary(par)}
      aria-pressed={active}
      className={clsx(
        "rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors",
        active
          ? "border-series-1 bg-series-1/10 text-series-1"
          : "border-[color:var(--border-hairline)] text-ink-secondary hover:border-series-1/40 hover:text-ink",
      )}
    >
      {par.par_code}
    </button>
  );
}
