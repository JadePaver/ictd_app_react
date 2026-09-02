import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { Avatar } from "../../components/ui/Avatar";
import { FormField, fieldInputClass } from "../../components/ui/FormField";
import { custodiansApi, referenceApi } from "../../lib/resources";
import { fullName } from "../../lib/format";
import type { Custodian } from "../../types/api";

/**
 * Searchable custodian picker, shared by IssueMrModal and TransferMrModal.
 * Custodians are staff who may not have a dashboard login (see the
 * `custodians` table) — so this isn't just search-and-select, it also lets
 * an operator register someone new inline the moment they discover that
 * person isn't on file yet, without leaving the MR form.
 */
export function CustodianPicker({
  selected,
  onSelect,
  error,
}: {
  selected: Custodian | null;
  onSelect: (custodian: Custodian | null) => void;
  error?: string;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");

  const searchQuery = useQuery({
    queryKey: ["custodians", "search", search],
    queryFn: () => custodiansApi.list({ search: search || undefined, pageSize: 10 }),
    enabled: !selected,
  });
  const departmentsQuery = useQuery({
    queryKey: ["reference", "departments"],
    queryFn: referenceApi.departments,
    enabled: showAddForm,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      custodiansApi.create({
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        employeeNumber: employeeNumber.trim() || undefined,
        departmentId: departmentId === "" ? undefined : Number(departmentId),
        contactNumber: contactNumber.trim() || undefined,
        email: email.trim() || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["custodians"] });
      onSelect(res.data);
      setShowAddForm(false);
      setFirstName("");
      setMiddleName("");
      setLastName("");
      setEmployeeNumber("");
      setDepartmentId("");
      setContactNumber("");
      setEmail("");
    },
  });

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[color:var(--border-hairline)] px-3 py-2.5">
        <Avatar person={selected} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{fullName(selected)}</p>
          <p className="truncate text-xs text-ink-muted">
            {[selected.departments?.label, selected.employee_number ? `#${selected.employee_number}` : null]
              .filter(Boolean)
              .join(" · ") || "No department or employee number on file"}
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={() => onSelect(null)}>
          Change
        </Button>
      </div>
    );
  }

  const canCreate = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, employee #, or email…"
          className={fieldInputClass}
          autoComplete="off"
        />
      </div>

      {!showAddForm ? (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-[color:var(--border-hairline)]">
          {searchQuery.data?.data.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => onSelect(c)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
            >
              <Avatar person={c} size={24} className="text-[10px]" />
              <span className="min-w-0 flex-1 truncate text-ink">{fullName(c)}</span>
              <span className="shrink-0 text-xs text-ink-muted">{c.departments?.label ?? "—"}</span>
            </button>
          ))}
          {searchQuery.data && searchQuery.data.data.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-muted">
              {search ? `No custodians match "${search}".` : "No custodians on file yet."}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setShowAddForm(true);
              // If they were mid-search, carry a plausible name over so
              // they're not retyping what they just searched for.
              const [maybeFirst, ...rest] = search.trim().split(/\s+/);
              if (maybeFirst) setFirstName((current) => current || maybeFirst);
              if (rest.length > 0) setLastName((current) => current || rest.join(" "));
            }}
            className="flex w-full items-center gap-1.5 border-t border-[color:var(--border-hairline)] px-3 py-2 text-left text-sm font-medium text-series-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
          >
            + Add new custodian
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-[color:var(--border-hairline)] p-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First name" htmlFor="custodian-first-name" required>
              <input
                id="custodian-first-name"
                className={fieldInputClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
              />
            </FormField>
            <FormField label="Last name" htmlFor="custodian-last-name" required>
              <input
                id="custodian-last-name"
                className={fieldInputClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Middle name" htmlFor="custodian-middle-name">
              <input
                id="custodian-middle-name"
                className={fieldInputClass}
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
              />
            </FormField>
            <FormField label="Employee # (optional)" htmlFor="custodian-employee-number">
              <input
                id="custodian-employee-number"
                className={fieldInputClass}
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Department" htmlFor="custodian-department">
            <Combobox
              id="custodian-department"
              value={departmentId}
              onChange={(v) => setDepartmentId(v ?? "")}
              options={(departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: d.label }))}
              placeholder="No department"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contact number" htmlFor="custodian-contact">
              <input
                id="custodian-contact"
                className={fieldInputClass}
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </FormField>
            <FormField label="Email" htmlFor="custodian-email">
              <input
                id="custodian-email"
                type="email"
                className={fieldInputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
          </div>
          {createMutation.isError ? (
            <p className="text-xs text-critical">{(createMutation.error as Error).message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!canCreate || createMutation.isPending} onClick={() => createMutation.mutate()}>
              Add & select
            </Button>
          </div>
        </div>
      )}

      {error ? <p className="text-xs text-critical">{error}</p> : null}
    </div>
  );
}
