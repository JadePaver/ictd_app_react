import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { AlertBanner } from "../../components/ui/AlertBanner";
import { FormField, TextInput } from "../../components/ui/FormField";
import { ErrorState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/toastContext";
import { InfoIcon, ReturnIcon, XIcon } from "../../components/ui/icons";
import { inventoryItemsApi, type RemovalStatus } from "../../lib/resources";
import { REMOVAL_STATUSES, itemDisplayName, placementText, sortParts } from "../../lib/inventory";
import { itemStatusTone, toneDotClass } from "../../lib/statusStyles";
import type { InventoryItem } from "../../types/api";
import { CategoryTag, CategoryTile, DueLabel, ItemStatusBadge, SerialTag } from "./InventoryAtoms";
import { PartsPicker } from "./PartsPicker";

/**
 * Install or remove parts on one PC (form F6). Changes are staged here and
 * applied together in one transaction, which also writes the installation
 * log on the PC and each part. On an issued PC the MR isn't edited: parts
 * added are covered through the PC, and parts removed leave it (rule 21).
 */
export function ManagePartsModal({ hostId, onClose }: { hostId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [removals, setRemovals] = useState<Map<number, RemovalStatus>>(new Map());
  const [adding, setAdding] = useState<InventoryItem[]>([]);
  const [notes, setNotes] = useState("");

  const detailQuery = useQuery({
    queryKey: ["inventory-items", hostId],
    queryFn: () => inventoryItemsApi.get(hostId),
  });
  const pc = detailQuery.data?.data;

  const changeCount = removals.size + adding.length;
  const hostBlocked = pc && ["missing", "decommissioned"].includes(pc.item_statuses?.code ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      inventoryItemsApi.updateParts(hostId, {
        install: adding.map((p) => p.id),
        remove: [...removals].map(([partId, status]) => ({ partId, status })),
        notes: notes.trim() || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["custodians"] });
      queryClient.invalidateQueries({ queryKey: ["mr"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      const { installed, removed } = res.data;
      toast({
        title: `PC #${hostId} parts updated`,
        description: [installed ? `${installed} added` : null, removed ? `${removed} removed` : null].filter(Boolean).join(" · "),
      });
      onClose();
    },
  });

  function toggleRemoval(partId: number) {
    setRemovals((prev) => {
      const next = new Map(prev);
      if (next.has(partId)) next.delete(partId);
      else next.set(partId, "in_storage");
      return next;
    });
  }

  const custody = pc?.currentCustody;
  const summary = [adding.length ? `${adding.length} to add` : null, removals.size ? `${removals.size} to remove` : null].filter(Boolean).join(" · ");

  return (
    <Modal
      title="Manage parts"
      subtitle={pc ? `PC #${pc.id} · ${itemDisplayName(pc)}` : `PC #${hostId}`}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <>
          {mutation.isError ? <p className="w-full text-sm text-critical">{(mutation.error as Error).message}</p> : null}
          {summary ? <p className="text-sm font-medium text-ink-secondary">{summary}</p> : <p className="text-sm text-ink-muted">No changes yet</p>}
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={changeCount === 0 || mutation.isPending}>
            {mutation.isPending ? "Saving…" : changeCount === 0 ? "Save changes" : `Save ${changeCount} change${changeCount === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      {detailQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : detailQuery.isError || !pc ? (
        <ErrorState message={(detailQuery.error as Error | null)?.message ?? "PC not found"} />
      ) : (
        <div className="flex flex-col gap-5">
          {/* PC card */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[color:var(--border-hairline)] p-4">
            <CategoryTile code={pc.item_categories?.code} assembled={pc.is_assembled} size={44} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-ink-muted">ICTD INVENTORY #{pc.id}</p>
              <p className="truncate text-base font-semibold text-ink">{itemDisplayName(pc)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <SerialTag value={pc.serial_number} />
                <ItemStatusBadge status={pc.item_statuses} />
                <span className="text-xs text-ink-secondary">{placementText(pc)}</span>
                {custody ? <DueLabel mr={{ status: "active", expected_return_at: custody.expectedReturnAt }} /> : null}
              </div>
            </div>
          </div>

          {custody ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-series-1/25 bg-series-1/[0.06] px-3 py-2.5 text-sm text-ink-secondary">
              <InfoIcon size={16} className="mt-0.5 shrink-0 text-series-1" />
              <p>
                Parts added here are covered by <span className="font-mono font-medium text-ink">{custody.mrNumber}</span> through this PC. Removed
                parts leave it. The MR itself isn't changed; the PC's history records the swap.
              </p>
            </div>
          ) : null}
          {hostBlocked ? (
            <AlertBanner title="Parts can only go into a computer that isn't missing or decommissioned.">
              You can still take parts out of it.
            </AlertBanner>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="text-sm font-semibold text-ink">
                In this PC <span className="font-normal text-ink-muted">· {pc.parts.length}</span>
              </h3>
              {pc.parts.length === 0 && adding.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[color:var(--border-hairline)] px-4 py-6 text-center text-sm text-ink-muted">
                  No parts inside yet. Add some from the list.
                </p>
              ) : (
                <ul className="divide-y divide-[color:var(--gridline)] rounded-lg border border-[color:var(--border-hairline)]">
                  {sortParts(pc.parts).map((part) => {
                    const leaving = removals.get(part.id);
                    return (
                      <li key={part.id} className={clsx("flex flex-col gap-2 px-3 py-2.5", leaving && "bg-critical/[0.04]")}>
                        <div className="flex items-center gap-3">
                          <CategoryTile code={part.item_categories?.code} size={28} className={leaving ? "opacity-50" : undefined} />
                          <div className={clsx("min-w-0 flex-1", leaving && "opacity-60")}>
                            <p className={clsx("truncate text-sm font-medium text-ink", leaving && "line-through decoration-critical/60")}>{itemDisplayName(part)}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <CategoryTag label={part.item_categories?.code === "storage" ? "Storage" : part.item_categories?.code} />
                              <SerialTag value={part.serial_number} />
                            </div>
                          </div>
                          {leaving ? (
                            <Button type="button" variant="ghost" onClick={() => toggleRemoval(part.id)} className="px-2 py-1 text-xs">
                              <ReturnIcon size={13} />
                              Undo
                            </Button>
                          ) : (
                            <Button type="button" variant="secondary" onClick={() => toggleRemoval(part.id)} className="px-2 py-1 text-xs">
                              Remove
                            </Button>
                          )}
                        </div>
                        {leaving ? (
                          <div className="flex flex-wrap items-center gap-1.5 pl-10">
                            <span className="text-xs font-medium text-ink-muted">After removal</span>
                            {REMOVAL_STATUSES.map((s) => (
                              <button
                                key={s.code}
                                type="button"
                                aria-pressed={leaving === s.code}
                                onClick={() => setRemovals((prev) => new Map(prev).set(part.id, s.code))}
                                className={clsx(
                                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                                  leaving === s.code
                                    ? "border-ink/60 bg-black/[0.06] text-ink dark:border-white/60 dark:bg-white/[0.1]"
                                    : "border-[color:var(--border-hairline)] text-ink-secondary hover:text-ink",
                                )}
                              >
                                <span className={clsx("h-1.5 w-1.5 rounded-full", toneDotClass(itemStatusTone(s.code)))} />
                                {s.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                  {adding.map((part) => (
                    <li key={part.id} className="flex items-center gap-3 bg-series-1/[0.05] px-3 py-2.5">
                      <CategoryTile code={part.item_categories?.code} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{itemDisplayName(part)}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <CategoryTag label={part.item_categories?.code === "storage" ? "Storage" : part.item_categories?.code} />
                          <SerialTag value={part.serial_number} />
                        </div>
                      </div>
                      <span className="rounded-full bg-series-1/15 px-2 py-0.5 text-[11px] font-semibold text-series-1">Adding</span>
                      <button
                        type="button"
                        aria-label={`Don't add ${itemDisplayName(part)}`}
                        onClick={() => setAdding((prev) => prev.filter((p) => p.id !== part.id))}
                        className="rounded-md p-1 text-ink-muted hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/[0.08]"
                      >
                        <XIcon size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {changeCount > 0 ? (
                <FormField label="Notes" htmlFor="parts-notes" hint="Kept on the installation log, e.g. why a part came out.">
                  <TextInput
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Fan failed, sent to supplier"
                  />
                </FormField>
              ) : null}
            </section>

            <section className="flex min-w-0 flex-col gap-2 lg:border-l lg:border-[color:var(--border-hairline)] lg:pl-6">
              <h3 className="text-sm font-semibold text-ink">Add parts</h3>
              <PartsPicker selected={adding} onChange={setAdding} hostId={pc.id} disabled={!!hostBlocked} />
            </section>
          </div>
        </div>
      )}
    </Modal>
  );
}
