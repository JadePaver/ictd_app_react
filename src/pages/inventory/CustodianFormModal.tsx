import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { FormField, FormSection, fieldInputClass } from "../../components/ui/FormField";
import { custodiansApi, referenceApi } from "../../lib/resources";
import type { Custodian } from "../../types/api";

/** Create/edit form for a custodian — same shape as ItemFormModal /
 * DepartmentFormModal (one modal, keyed off whether `custodian` is passed).
 * Also the form CustodianPicker's inline "+ Add new custodian" is a
 * lighter-weight duplicate of, for contexts where a full page navigation
 * would be overkill. */
export function CustodianFormModal({ custodian, onClose }: { custodian?: Custodian; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!custodian;

  const [firstName, setFirstName] = useState(custodian?.first_name ?? "");
  const [middleName, setMiddleName] = useState(custodian?.middle_name ?? "");
  const [lastName, setLastName] = useState(custodian?.last_name ?? "");
  const [lastNameTouched, setLastNameTouched] = useState(false);
  const [employeeNumber, setEmployeeNumber] = useState(custodian?.employee_number ?? "");
  const [departmentId, setDepartmentId] = useState<number | "">(custodian?.department_id ?? "");
  const [contactNumber, setContactNumber] = useState(custodian?.contact_number ?? "");
  const [email, setEmail] = useState(custodian?.email ?? "");
  const [notes, setNotes] = useState(custodian?.notes ?? "");
  const [submitted, setSubmitted] = useState(false);

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        employeeNumber: employeeNumber.trim() || undefined,
        departmentId: departmentId === "" ? undefined : Number(departmentId),
        contactNumber: contactNumber.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (isEdit) {
        await custodiansApi.update(custodian!.id, {
          ...body,
          middleName: body.middleName ?? null,
          employeeNumber: body.employeeNumber ?? null,
          departmentId: body.departmentId ?? null,
          contactNumber: body.contactNumber ?? null,
          email: body.email ?? null,
          notes: body.notes ?? null,
        });
      } else {
        await custodiansApi.create(body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custodians"] });
      onClose();
    },
  });

  const firstNameError = firstName.trim().length === 0 ? "First name is required" : undefined;
  const lastNameError = lastName.trim().length === 0 ? "Last name is required" : undefined;
  const canSubmit = !firstNameError && !lastNameError;

  return (
    <Modal title={isEdit ? "Edit custodian" : "Add custodian"} onClose={onClose}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          setLastNameTouched(true);
          if (canSubmit) mutation.mutate();
        }}
      >
        <FormSection title="Name">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First name" htmlFor="custodian-form-first" required error={submitted ? firstNameError : undefined}>
              <input
                id="custodian-form-first"
                className={fieldInputClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus={!isEdit}
              />
            </FormField>
            <FormField
              label="Last name"
              htmlFor="custodian-form-last"
              required
              error={lastNameTouched || submitted ? lastNameError : undefined}
            >
              <input
                id="custodian-form-last"
                className={fieldInputClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={() => setLastNameTouched(true)}
              />
            </FormField>
          </div>
          <FormField label="Middle name (optional)" htmlFor="custodian-form-middle">
            <input
              id="custodian-form-middle"
              className={fieldInputClass}
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
            />
          </FormField>
        </FormSection>

        <FormSection title="Assignment" description="Doesn't need a dashboard login — this is just a custody record.">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Employee # (optional)" htmlFor="custodian-form-employee">
              <input
                id="custodian-form-employee"
                className={fieldInputClass}
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
              />
            </FormField>
            <FormField label="Department (optional)" htmlFor="custodian-form-department">
              <Combobox
                id="custodian-form-department"
                value={departmentId}
                onChange={(v) => setDepartmentId(v ?? "")}
                options={(departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: d.label }))}
                placeholder="No department"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Contact">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contact number (optional)" htmlFor="custodian-form-contact">
              <input
                id="custodian-form-contact"
                className={fieldInputClass}
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </FormField>
            <FormField label="Email (optional)" htmlFor="custodian-form-email">
              <input
                id="custodian-form-email"
                type="email"
                className={fieldInputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Notes (optional)" htmlFor="custodian-form-notes">
            <textarea id="custodian-form-notes" className={fieldInputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </FormSection>

        {mutation.isError ? <p className="text-xs text-critical">{(mutation.error as Error).message}</p> : null}

        <div className="flex justify-end gap-2 border-t border-[color:var(--border-hairline)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {isEdit ? "Save changes" : "Add custodian"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
