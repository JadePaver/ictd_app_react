import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { departmentsApi } from "../../lib/resources";
import type { Department } from "../../types/api";

const inputClass =
  "w-full rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";
const labelClass = "text-xs font-medium text-ink-muted";

/** Create/edit form for a department — same shape as AnnouncementFormModal
 * (single modal handles both, keyed off whether `department` is passed). */
export function DepartmentFormModal({ department, onClose }: { department?: Department; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!department;

  const [label, setLabel] = useState(department?.label ?? "");
  const [code, setCode] = useState(department?.code ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedLabel = label.trim();
      const trimmedCode = code.trim();
      if (isEdit) {
        await departmentsApi.update(department!.id, { label: trimmedLabel, code: trimmedCode || null });
      } else {
        await departmentsApi.create({ label: trimmedLabel, code: trimmedCode || undefined });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reference", "departments"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      onClose();
    },
  });

  const canSubmit = label.trim().length > 0;

  return (
    <Modal title={isEdit ? "Edit department" : "Add department"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
      >
        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="dept-label">
            Label
          </label>
          <input
            id="dept-label"
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Human Resources"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="dept-code">
            Code (optional)
          </label>
          <input
            id="dept-code"
            className={inputClass}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. HR"
          />
        </div>

        {mutation.isError ? <p className="text-xs text-critical">{(mutation.error as Error).message}</p> : null}

        <div className="flex justify-end gap-2 border-t border-[color:var(--border-hairline)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || mutation.isPending}>
            {isEdit ? "Save changes" : "Add department"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
