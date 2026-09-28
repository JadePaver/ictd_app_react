import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { Avatar } from "../../components/ui/Avatar";
import { SearchInput } from "../../components/ui/SearchInput";
import { FormField, TextInput } from "../../components/ui/FormField";
import { focusFirstProblem } from "../../components/ui/formFieldContext";
import { Spinner } from "../../components/ui/Spinner";
import { AlertTriangleIcon, PlusIcon } from "../../components/ui/icons";
import { custodiansApi, referenceApi } from "../../lib/resources";
import { fullName } from "../../lib/format";
import { officeName } from "../../lib/inventory";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import type { Custodian } from "../../types/api";
import { AccountabilityBadge, Office } from "./InventoryAtoms";
import { useEmployeeNumberCheck } from "./useEmployeeNumberCheck";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_DRAFT = { firstName: "", middleName: "", lastName: "", employeeNumber: "", contactNumber: "", email: "" };

/**
 * Search-or-add custodian picker, shared by the Issue and Transfer forms.
 * Custodians often have no dashboard login and may not be on file yet, so
 * the operator can register them inline ("Add & select") without leaving
 * the MR they are halfway through. Arrow keys move through the results and
 * Enter picks one.
 */
export function CustodianPicker({
  inputId,
  selected,
  onSelect,
  error,
  excludeId,
  excludeReason = "Current custodian",
}: {
  /** Id for the search box, so a form's problem banner can jump to it. */
  inputId?: string;
  selected: Custodian | null;
  onSelect: (custodian: Custodian | null) => void;
  error?: string;
  /** A custodian who can't be picked here (the current holder, in a transfer). */
  excludeId?: number;
  excludeReason?: string;
}) {
  const listId = useId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [draftDepartmentId, setDraftDepartmentId] = useState<number | "">("");
  const [addTried, setAddTried] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const employeeCheck = useEmployeeNumberCheck(adding ? draft.employeeNumber : "");

  const debouncedSearch = useDebouncedValue(search.trim());
  const searchQuery = useQuery({
    queryKey: ["custodians", "picker", debouncedSearch],
    queryFn: () => custodiansApi.list({ search: debouncedSearch || undefined, sortBy: "name", pageSize: 8 }),
    enabled: !selected && !adding,
    placeholderData: keepPreviousData,
  });
  const departmentsQuery = useQuery({
    queryKey: ["reference", "departments"],
    queryFn: referenceApi.departments,
    enabled: adding,
  });

  const results = useMemo(() => searchQuery.data?.data ?? [], [searchQuery.data]);
  const selectable = results.filter((c) => c.id !== excludeId);

  useEffect(() => setHighlighted(0), [search]);

  const createMutation = useMutation({
    mutationFn: () =>
      custodiansApi.create({
        firstName: draft.firstName.trim(),
        middleName: draft.middleName.trim() || undefined,
        lastName: draft.lastName.trim(),
        employeeNumber: draft.employeeNumber.trim() || undefined,
        departmentId: draftDepartmentId === "" ? undefined : Number(draftDepartmentId),
        contactNumber: draft.contactNumber.trim() || undefined,
        email: draft.email.trim() || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["custodians"] });
      onSelect(res.data);
      setAdding(false);
      setDraft(EMPTY_DRAFT);
      setDraftDepartmentId("");
      setAddTried(false);
      setEmailTouched(false);
    },
  });

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-series-1/35 bg-series-1/[0.04] px-3.5 py-3">
        <Avatar person={selected} size={38} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {fullName(selected)}
            {selected.activeItemCount != null ? <AccountabilityBadge custodian={selected} /> : null}
          </p>
          <p className="truncate text-xs text-ink-muted">
            {selected.employee_number ? `#${selected.employee_number} · ` : ""}
            <Office dept={selected.departments} fallback="No office on file" />
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={() => onSelect(null)}>
          Change
        </Button>
      </div>
    );
  }

  if (adding) {
    const firstError = draft.firstName.trim() ? undefined : "First name is required";
    const lastError = draft.lastName.trim() ? undefined : "Last name is required";
    const emailError = draft.email.trim() && !EMAIL.test(draft.email.trim()) ? "Enter a valid email address, like juan@example.gov" : undefined;
    const ok = !firstError && !lastError && !emailError && !employeeCheck.error && !employeeCheck.checking;
    const set = (key: keyof typeof draft) => (e: ChangeEvent<HTMLInputElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }));
    // The button stays enabled: a click with gaps says what's missing, where
    // a greyed-out button would only say "no".
    const tryCreate = () => {
      setAddTried(true);
      if (createMutation.isPending) return;
      if (ok) createMutation.mutate();
      else focusFirstProblem(addRef.current);
    };
    return (
      <div
        ref={addRef}
        className="flex flex-col gap-3 rounded-xl border border-[color:var(--border-hairline)] bg-black/[0.015] p-4 dark:bg-white/[0.02]"
        // This block sits inside the MR form: Enter adds the person instead of
        // submitting the whole MR.
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
            tryCreate();
          }
        }}
      >
        <div>
          <p className="text-sm font-semibold text-ink">New custodian</p>
          <p className="text-xs text-ink-muted">Doesn't need a dashboard login. This is just a custody record.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="First name" htmlFor="picker-first" required error={addTried ? firstError : undefined}>
            <TextInput value={draft.firstName} onChange={set("firstName")} autoFocus={!draft.firstName} autoComplete="off" />
          </FormField>
          <FormField label="Middle name" htmlFor="picker-middle">
            <TextInput value={draft.middleName} onChange={set("middleName")} autoComplete="off" />
          </FormField>
          <FormField label="Last name" htmlFor="picker-last" required error={addTried ? lastError : undefined}>
            <TextInput value={draft.lastName} onChange={set("lastName")} autoFocus={!!draft.firstName && !draft.lastName} autoComplete="off" />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Employee #" htmlFor="picker-employee" error={employeeCheck.error} hint="Optional, but unique when given.">
            <TextInput
              mono
              trailing={employeeCheck.checking ? <Spinner className="h-3.5 w-3.5" /> : null}
              value={draft.employeeNumber}
              onChange={set("employeeNumber")}
              autoFocus={!!draft.firstName && !!draft.lastName && !draft.employeeNumber}
              placeholder="e.g. EMP-00421"
              autoComplete="off"
              spellCheck={false}
            />
          </FormField>
          <FormField label="Works in" htmlFor="picker-department">
            <Combobox
              id="picker-department"
              value={draftDepartmentId}
              onChange={(v) => setDraftDepartmentId(v ?? "")}
              options={(departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: officeName(d) }))}
              placeholder="No office"
            />
          </FormField>
          <FormField label="Contact number" htmlFor="picker-contact">
            <TextInput type="tel" value={draft.contactNumber} onChange={set("contactNumber")} placeholder="e.g. 0917 555 0142" autoComplete="off" />
          </FormField>
          <FormField
            label="Email"
            htmlFor="picker-email"
            error={addTried || emailTouched ? emailError : undefined}
            hint="Lets you email them if an MR goes overdue."
          >
            <TextInput
              type="email"
              value={draft.email}
              onChange={set("email")}
              onBlur={() => setEmailTouched(true)}
              placeholder="e.g. juan@example.gov"
              autoComplete="off"
              spellCheck={false}
            />
          </FormField>
        </div>
        {createMutation.isError ? <p className="text-xs text-critical">{(createMutation.error as Error).message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setAdding(false);
              setAddTried(false);
              setEmailTouched(false);
            }}
          >
            Back to search
          </Button>
          <Button type="button" disabled={createMutation.isPending} onClick={tryCreate}>
            {createMutation.isPending ? "Adding…" : "Add & select"}
          </Button>
        </div>
      </div>
    );
  }

  function startAdding() {
    // Carry whatever was searched into the right field so nobody retypes
    // it: an email, an employee number, or a name. One word is almost
    // always a surname ("Rosales"); several read as first name, then
    // surname, which keeps compound surnames like "Dela Cruz" whole.
    const typed = search.trim();
    const tokens = typed.split(/\s+/).filter(Boolean);
    setDraft((d) => {
      if (!typed) return d;
      if (typed.includes("@")) return { ...d, email: d.email || typed };
      if (tokens.length === 1 && /\d/.test(typed)) return { ...d, employeeNumber: d.employeeNumber || typed };
      if (tokens.length === 1) return { ...d, lastName: d.lastName || typed };
      return { ...d, firstName: d.firstName || tokens[0], lastName: d.lastName || tokens.slice(1).join(" ") };
    });
    setAdding(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, Math.max(0, selectable.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const pick = selectable[highlighted];
            if (pick) onSelect(pick);
          }
        }}
      >
        <SearchInput
          id={inputId}
          value={search}
          onChange={setSearch}
          placeholder="Search by name, employee #, or email…"
          ariaLabel="Search custodians"
          invalid={!!error}
        />
      </div>

      <div id={listId} role="listbox" aria-label="Custodians" className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)]">
        <div className="max-h-56 overflow-y-auto">
          {results.map((c) => {
            const excluded = c.id === excludeId;
            const index = selectable.indexOf(c);
            return (
              <button
                type="button"
                role="option"
                aria-selected={index === highlighted}
                key={c.id}
                disabled={excluded}
                onClick={() => onSelect(c)}
                onMouseEnter={() => index >= 0 && setHighlighted(index)}
                title={excluded ? excludeReason : undefined}
                className={clsx(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                  excluded
                    ? "cursor-not-allowed opacity-50"
                    : index === highlighted
                      ? "bg-series-1/[0.07]"
                      : "hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
                )}
              >
                <Avatar person={c} size={28} className="text-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{fullName(c)}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {excluded ? excludeReason : [c.employee_number ? `#${c.employee_number}` : null, officeName(c.departments, "No office")].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <AccountabilityBadge custodian={c} />
              </button>
            );
          })}
          {searchQuery.data && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">{debouncedSearch ? `Nobody on file matches "${debouncedSearch}".` : "No custodians on file yet."}</p>
          ) : null}
          {searchQuery.isLoading ? <p className="px-3 py-3 text-sm text-ink-muted">Searching…</p> : null}
        </div>
        <button
          type="button"
          onClick={startAdding}
          className="flex w-full items-center gap-2 border-t border-[color:var(--border-hairline)] px-3 py-2.5 text-left text-sm font-medium text-series-1 transition-colors hover:bg-series-1/[0.05]"
        >
          <PlusIcon size={14} />
          {search.trim() ? `Add "${search.trim()}" as a new custodian` : "Add a new custodian"}
        </button>
      </div>

      {error ? (
        <p className="flex items-start gap-1 text-xs font-medium text-critical">
          <AlertTriangleIcon size={12} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
