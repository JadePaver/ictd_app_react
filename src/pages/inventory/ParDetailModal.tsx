import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { ErrorState } from "../../components/ui/EmptyState";
import { PageSpinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/toastContext";
import { ChevronRightIcon, PencilIcon, PlusIcon, TrashIcon } from "../../components/ui/icons";
import { parsApi } from "../../lib/resources";
import { formatCalendarDate, formatDateTime, fullName } from "../../lib/format";
import { formatPeso, groupCategories, itemDisplayName } from "../../lib/inventory";
import type { InventoryItem } from "../../types/api";
import { CategoryTile, Field, Figure, ItemStatusBadge, PlacementChip, Section, SerialTag } from "./InventoryAtoms";
import { ParFormModal, type RegisterMode } from "./ParFormModal";
import { RegisterItemsModal } from "./RegisterItemsModal";

/**
 * One PAR: the delivery's paperwork, and every item that came in it grouped
 * by category, each showing where it sits now (context doc v2, 10.1).
 */
export function ParDetailModal({ id, onClose, onOpenItem }: { id: number; onClose: () => void; onOpenItem?: (id: number) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ["pars", "detail", id], queryFn: () => parsApi.get(id) });
  const [editing, setEditing] = useState(false);
  const [registering, setRegistering] = useState<RegisterMode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const par = query.data?.data;

  const groups = useMemo(() => {
    if (!par) return [];
    const byCode = new Map<string, { code: string; label: string; items: InventoryItem[] }>();
    for (const item of par.items) {
      const code = item.item_categories?.code ?? "other";
      const group = byCode.get(code) ?? { code, label: item.item_categories?.label ?? "Other", items: [] };
      group.items.push(item);
      byCode.set(code, group);
    }
    const order = groupCategories(
      [...byCode.values()].map((g) => ({ code: g.code, label: g.label, is_part: par.items.find((i) => i.item_categories?.code === g.code)?.item_categories?.is_part })),
    );
    return [...order.units, ...order.parts].map((c) => byCode.get(c.code)!);
  }, [par]);

  const deleteMutation = useMutation({
    mutationFn: () => parsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pars"] });
      toast({ title: "PAR deleted", description: par?.par_code });
      onClose();
    },
  });

  const hasItems = (par?.itemCount ?? 0) > 0;

  return (
    <Modal
      title={par ? <span className="font-mono">{par.par_code}</span> : "PAR"}
      subtitle={par ? [par.supplier || "No supplier on record", `received ${formatCalendarDate(par.date_received)}`].join(" · ") : undefined}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        par ? (
          <>
            {deleteMutation.isError ? <p className="w-full text-xs text-critical">{(deleteMutation.error as Error).message}</p> : null}
            <Button
              variant="ghost"
              className="text-critical hover:bg-critical/10 dark:hover:bg-critical/15"
              onClick={() => setConfirmDelete(true)}
              disabled={hasItems || deleteMutation.isPending}
              title={hasItems ? "This PAR has items and can't be deleted." : undefined}
            >
              <TrashIcon size={14} />
              Delete
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <PencilIcon size={14} />
                Edit
              </Button>
              <Button onClick={() => setRegistering("single")}>
                <PlusIcon size={14} />
                Register items
              </Button>
            </div>
          </>
        ) : undefined
      }
    >
      {query.isLoading ? (
        <PageSpinner />
      ) : query.isError || !par ? (
        <ErrorState message={(query.error as Error | null)?.message ?? "PAR not found"} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 divide-[color:var(--gridline)] rounded-xl border border-[color:var(--border-hairline)] sm:grid-cols-3 sm:divide-x">
            <Figure label="Items" value={par.itemCount} hint={par.byCategory.map((c) => `${c.count} ${c.label}`).join(" · ") || "None yet"} />
            <Figure label="Amount" value={formatPeso(par.amount) ?? <span className="text-ink-muted">Not recorded</span>} />
            <Figure label="Date received" value={formatCalendarDate(par.date_received)} />
          </div>

          <Section title="Delivery">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="PO / reference no.">{par.reference_no ? <span className="font-mono">{par.reference_no}</span> : <span className="text-ink-muted">None</span>}</Field>
              <Field label="Supplier">{par.supplier || <span className="text-ink-muted">None</span>}</Field>
              <Field label="Received by">{par.received_by || <span className="text-ink-muted">Not recorded</span>}</Field>
              <Field label="Recorded by">
                {fullName(par.created_by_user)}
                <span className="block text-xs text-ink-muted">{formatDateTime(par.created_at)}</span>
              </Field>
              {par.remarks ? (
                <Field label="Remarks" className="sm:col-span-2">
                  <span className="whitespace-pre-line">{par.remarks}</span>
                </Field>
              ) : null}
            </div>
          </Section>

          <Section title="Items from this PAR" aside={hasItems ? <span className="text-xs text-ink-muted">By category</span> : null}>
            {!hasItems ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[color:var(--border-hairline)] px-4 py-6 text-center">
                <p className="text-sm text-ink-muted">No items linked yet. Register what came in this delivery.</p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setRegistering("single")}>
                    One at a time
                  </Button>
                  <Button variant="secondary" onClick={() => setRegistering("bulk")}>
                    In bulk
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {groups.map((group) => (
                  <div key={group.code} className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-ink-secondary">
                      {group.label} <span className="text-ink-muted">· {group.items.length}</span>
                    </p>
                    <ul className="divide-y divide-[color:var(--gridline)] overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => onOpenItem?.(item.id)}
                            disabled={!onOpenItem}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.025] disabled:cursor-default dark:hover:bg-white/[0.04]"
                          >
                            <CategoryTile code={item.item_categories?.code} assembled={item.is_assembled} size={28} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">{itemDisplayName(item)}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <SerialTag value={item.serial_number} />
                                {item.installed_in_item_id ? (
                                  <PlacementChip hostId={item.installed_in_item_id} label={`In PC #${item.installed_in_item_id}`} />
                                ) : item.partCount ? (
                                  <span className="text-[11px] text-ink-muted">
                                    {item.partCount} part{item.partCount === 1 ? "" : "s"}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <ItemStatusBadge status={item.item_statuses} />
                            {onOpenItem ? <ChevronRightIcon size={14} className="text-ink-muted" /> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {editing && par ? (
        <ParFormModal
          par={par}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            toast({ title: "PAR updated", description: saved.par_code });
          }}
        />
      ) : null}
      {registering && par ? (
        <RegisterItemsModal
          initialMode={registering}
          initialPar={par}
          onClose={() => setRegistering(null)}
          onOpenItem={onOpenItem}
          onRegistered={(items) =>
            toast({ title: `${items.length} item${items.length === 1 ? "" : "s"} registered`, description: `Under ${par.par_code}` })
          }
        />
      ) : null}
      {confirmDelete && par ? (
        <ConfirmModal
          title={`Delete ${par.par_code}?`}
          description="No items link to it, so nothing else changes. Delete it only if it was recorded by mistake."
          confirmLabel="Delete PAR"
          tone="danger"
          loading={deleteMutation.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            deleteMutation.mutate();
          }}
        />
      ) : null}
    </Modal>
  );
}
