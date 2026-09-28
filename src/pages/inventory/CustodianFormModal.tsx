import { useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { FormField, FormProblems, FormSection, TextArea, TextInput } from "../../components/ui/FormField";
import { focusFirstProblem } from "../../components/ui/formFieldContext";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/toastContext";
import { custodiansApi, referenceApi } from "../../lib/resources";
import { fullName } from "../../lib/format";
import { officeName } from "../../lib/inventory";
import type { Custodian } from "../../types/api";
import { useEmployeeNumberCheck } from "./useEmployeeNumberCheck";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Add or edit a custodian (context doc 6.7). CustodianPicker has a lighter
 * inline version of the same form for use mid-MR. */
export function CustodianFormModal({
  custodian,
  onClose,
  onSaved,
}: {
  custodian?: Custodian;
  onClose: () => void;
  onSaved?: (custodian: Custodian) => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!custodian;

  const [firstName, setFirstName] = useState(custodian?.first_name ?? "");
  const [middleName, setMiddleName] = useState(custodian?.middle_name ?? "");
  const [lastName, setLastName] = useState(custodian?.last_name ?? "");
  const [employeeNumber, setEmployeeNumber] = useState(custodian?.employee_number ?? "");
  const [departmentId, setDepartmentId] = useState<number | "">(custodian?.department_id ?? "");
  const [contactNumber, setContactNumber] = useState(custodian?.contact_number ?? "");
  const [email, setEmail] = useState(custodian?.email ?? "");
  const [notes, setNotes] = useState(custodian?.notes ?? "");
  const [submitted, setSubmitted] = useState(false);
  // Checked once the operator leaves the field, not after every letter.
  const [emailTouched, setEmailTouched] = useState(false);
  const employeeCheck = useEmployeeNumberCheck(employeeNumber, custodian?.id);

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const departmentOptions = useMemo(
    () => (departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: officeName(d) })),
    [departmentsQuery.data],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        employeeNumber: employeeNumber.trim(),
        contactNumber: contactNumber.trim(),
        email: email.trim(),
        notes: notes.trim(),
      };
      if (isEdit) {
        return custodiansApi.update(custodian!.id, {
          firstName: trimmed.firstName,
          lastName: trimmed.lastName,
          middleName: trimmed.middleName || null,
          employeeNumber: trimmed.employeeNumber || null,
          departmentId: departmentId === "" ? null : Number(departmentId),
          contactNumber: trimmed.contactNumber || null,
          email: trimmed.email || null,
          notes: trimmed.notes || null,
        });
      }
      return custodiansApi.create({
        firstName: trimmed.firstName,
        lastName: trimmed.lastName,
        middleName: trimmed.middleName || undefined,
        employeeNumber: trimmed.employeeNumber || undefined,
        departmentId: departmentId === "" ? undefined : Number(departmentId),
        contactNumber: trimmed.contactNumber || undefined,
        email: trimmed.email || undefined,
        notes: trimmed.notes || undefined,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["custodians"] });
      queryClient.invalidateQueries({ queryKey: ["mr"] });
      toast({ title: isEdit ? "Changes saved" : "Custodian added", description: fullName(res.data) });
      if (onSaved) onSaved(res.data);
      else onClose();
    },
  });

  const firstNameError = firstName.trim() ? undefined : "First name is required";
  const lastNameError = lastName.trim() ? undefined : "Last name is required";
  const emailError = email.trim() && !EMAIL.test(email.trim()) ? "Enter a valid email address, like juan@example.gov" : undefined;
  const problems = [
    firstNameError ? { label: "First name", target: "custodian-form-first" } : null,
    lastNameError ? { label: "Last name", target: "custodian-form-last" } : null,
    employeeCheck.error ? { label: "Employee #", target: "custodian-form-employee" } : null,
    emailError ? { label: "Email", target: "custodian-form-email" } : null,
  ].filter((p) => p !== null);

  return (
    <Modal
      title={isEdit ? "Edit custodian" : "Add custodian"}
      subtitle={isEdit ? fullName(custodian) : "A person who can sign for and hold ICTD equipment."}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          {mutation.isError ? <p className="w-full text-sm text-critical">{(mutation.error as Error).message}</p> : null}
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add custodian"}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        id={formId}
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (problems.length === 0 && !employeeCheck.checking) mutation.mutate();
          else focusFirstProblem(formRef.current);
        }}
      >
        {submitted ? <FormProblems problems={problems} /> : null}
        <FormSection title="Name">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="First name" htmlFor="custodian-form-first" required error={submitted ? firstNameError : undefined}>
              <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus={!isEdit} autoComplete="off" />
            </FormField>
            <FormField label="Middle name" htmlFor="custodian-form-middle">
              <TextInput value={middleName} onChange={(e) => setMiddleName(e.target.value)} autoComplete="off" />
            </FormField>
            <FormField label="Last name" htmlFor="custodian-form-last" required error={submitted ? lastNameError : undefined}>
              <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Assignment" description="Doesn't need a dashboard login. This is just a custody record.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Employee #" htmlFor="custodian-form-employee" error={employeeCheck.error} hint="Optional, but unique when given.">
              <TextInput
                mono
                trailing={employeeCheck.checking ? <Spinner className="h-3.5 w-3.5" /> : null}
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="e.g. EMP-00421"
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>
            <FormField label="Works in" htmlFor="custodian-form-department" hint="Their own office. MRs default to it.">
              <Combobox
                id="custodian-form-department"
                value={departmentId}
                onChange={(v) => setDepartmentId(v ?? "")}
                options={departmentOptions}
                placeholder="No office"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Contact">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Contact number" htmlFor="custodian-form-contact">
              <TextInput
                type="tel"
                autoComplete="off"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g. 0917 555 0142"
              />
            </FormField>
            <FormField
              label="Email"
              htmlFor="custodian-form-email"
              error={submitted || emailTouched ? emailError : undefined}
              hint="Enables Email custodian on overdue MRs."
            >
              <TextInput
                type="email"
                autoComplete="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="e.g. juan@example.gov"
              />
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="custodian-form-notes">
            <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </FormSection>
      </form>
    </Modal>
  );
}
