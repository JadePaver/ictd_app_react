import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Combobox } from "../../components/ui/Combobox";
import { FormField, FormSection, fieldInputClass } from "../../components/ui/FormField";
import { inventoryItemsApi, referenceApi } from "../../lib/resources";
import type { InventoryItem } from "../../types/api";

/** Create/edit form for an inventory item — same shape as
 * DepartmentFormModal / AnnouncementFormModal (one modal, keyed off
 * whether `item` is passed). */
export function ItemFormModal({ item, onClose }: { item?: InventoryItem; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!item;

  const [categoryId, setCategoryId] = useState<number | "">(item?.category_id ?? "");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [brand, setBrand] = useState(item?.brand ?? "");
  const [model, setModel] = useState(item?.model ?? "");
  const [serialNumber, setSerialNumber] = useState(item?.serial_number ?? "");
  const [serialTouched, setSerialTouched] = useState(false);
  const [departmentId, setDepartmentId] = useState<number | "">(item?.department_id ?? "");
  const [statusId, setStatusId] = useState<number | "">(item?.status_id ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [submitted, setSubmitted] = useState(false);

  const categoriesQuery = useQuery({ queryKey: ["reference", "item-categories"], queryFn: referenceApi.itemCategories });
  const statusesQuery = useQuery({ queryKey: ["reference", "item-statuses"], queryFn: referenceApi.itemStatuses });
  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });

  const mutation = useMutation({
    mutationFn: async () => {
      const categoryIdNum = Number(categoryId);
      const statusIdNum = statusId === "" ? undefined : Number(statusId);
      const trimmedBrand = brand.trim();
      const trimmedModel = model.trim();
      const trimmedSerial = serialNumber.trim();
      const trimmedDescription = description.trim();

      if (isEdit) {
        await inventoryItemsApi.update(item!.id, {
          categoryId: categoryIdNum,
          brand: trimmedBrand || null,
          model: trimmedModel || null,
          serialNumber: trimmedSerial,
          departmentId: departmentId === "" ? null : Number(departmentId),
          statusId: statusIdNum,
          description: trimmedDescription || null,
        });
      } else {
        await inventoryItemsApi.create({
          categoryId: categoryIdNum,
          brand: trimmedBrand || undefined,
          model: trimmedModel || undefined,
          serialNumber: trimmedSerial,
          departmentId: departmentId === "" ? undefined : Number(departmentId),
          statusId: statusIdNum,
          description: trimmedDescription || undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      onClose();
    },
  });

  const categoryError = categoryId === "" ? "Category is required" : undefined;
  const serialError = serialNumber.trim().length === 0 ? "Serial number is required" : undefined;
  const canSubmit = !categoryError && !serialError;

  return (
    <Modal title={isEdit ? "Edit item" : "Add item"} onClose={onClose}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          setCategoryTouched(true);
          setSerialTouched(true);
          if (canSubmit) mutation.mutate();
        }}
      >
        <FormSection title="Classification" description="What kind of item this is, and its current condition.">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Category"
              htmlFor="item-category"
              required
              error={categoryTouched || submitted ? categoryError : undefined}
            >
              <Combobox
                id="item-category"
                value={categoryId}
                onChange={(v) => setCategoryId(v ?? "")}
                onBlur={() => setCategoryTouched(true)}
                autoFocus={!isEdit}
                options={(categoriesQuery.data?.data ?? []).map((c) => ({ value: c.id, label: c.label }))}
                placeholder="Select…"
              />
            </FormField>
            <FormField label="Status" htmlFor="item-status" hint={isEdit ? undefined : "Defaults to “In storage”"}>
              <Combobox
                id="item-status"
                value={statusId}
                onChange={(v) => setStatusId(v ?? "")}
                options={(statusesQuery.data?.data ?? []).map((s) => ({ value: s.id, label: s.label }))}
                placeholder="Default (in storage)"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Identification" description="Serial number is how this item gets matched on future lookups — keep it exact.">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Brand" htmlFor="item-brand">
              <input id="item-brand" className={fieldInputClass} value={brand} onChange={(e) => setBrand(e.target.value)} />
            </FormField>
            <FormField label="Model" htmlFor="item-model">
              <input id="item-model" className={fieldInputClass} value={model} onChange={(e) => setModel(e.target.value)} />
            </FormField>
          </div>
          <FormField
            label="Serial number"
            htmlFor="item-serial"
            required
            error={serialTouched || submitted ? serialError : undefined}
            hint={!serialError ? "Must be unique across all items." : undefined}
          >
            <input
              id="item-serial"
              className={`${fieldInputClass} font-mono`}
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              onBlur={() => setSerialTouched(true)}
              placeholder="e.g. SN-2026-00123"
            />
          </FormField>
        </FormSection>

        <FormSection title="Assignment">
          <FormField label="Department" htmlFor="item-department">
            <Combobox
              id="item-department"
              value={departmentId}
              onChange={(v) => setDepartmentId(v ?? "")}
              options={(departmentsQuery.data?.data ?? []).map((d) => ({ value: d.id, label: d.label }))}
              placeholder="No department"
            />
          </FormField>
          <FormField label="Description / specs (optional)" htmlFor="item-description">
            <textarea
              id="item-description"
              className={fieldInputClass}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </FormSection>

        {mutation.isError ? <p className="text-xs text-critical">{(mutation.error as Error).message}</p> : null}

        <div className="flex justify-end gap-2 border-t border-[color:var(--border-hairline)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {isEdit ? "Save changes" : "Add item"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
