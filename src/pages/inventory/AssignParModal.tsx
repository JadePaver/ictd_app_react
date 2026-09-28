import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { FormProblems } from "../../components/ui/FormField";
import { focusFirstProblem } from "../../components/ui/formFieldContext";
import { SearchInput } from "../../components/ui/SearchInput";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/toastContext";
import { inventoryItemsApi } from "../../lib/resources";
import { itemDisplayName } from "../../lib/inventory";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { CategoryTile, ItemStatusBadge, SerialTag } from "./InventoryAtoms";
import { ParField } from "./ParField";
import { useParLookup } from "./useParLookup";

/**
 * Assign PAR (context doc v2, 15.7): items registered before PARs keep a
 * blank PAR until someone matches them to their delivery. Tick the ones
 * from one PAR and link them in one go. Items that already have a PAR are
 * never touched here; that is changed from the item's own edit form.
 */
export function AssignParModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [parCode, setParCode] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const parLookup = useParLookup(parCode);
  const debounced = useDebouncedValue(search.trim());

  const listQuery = useQuery({
    queryKey: ["inventory-items", "list", "without-par", debounced],
    queryFn: () => inventoryItemsApi.list({ parId: "none", search: debounced || undefined, pageSize: 200, sortBy: "createdAt", sortDir: "asc" }),
    placeholderData: keepPreviousData,
  });
  const rows = listQuery.data?.data ?? [];
  const allVisiblePicked = rows.length > 0 && rows.every((r) => picked.has(r.id));

  const problems = [
    parLookup.status !== "found" ? { label: "PAR code", target: "assign-par" } : null,
    picked.size === 0 ? { label: "Items", target: "assign-items" } : null,
  ].filter((p) => p !== null);

  const mutation = useMutation({
    mutationFn: () => inventoryItemsApi.assignPar([...picked], parLookup.par!.id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["pars"] });
      toast({
        title: `${parLookup.par!.par_code} assigned`,
        description: `${res.data.updated} item${res.data.updated === 1 ? "" : "s"} now linked to it.`,
      });
      onClose();
    },
  });

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal
      title="Assign PAR"
      subtitle="Link items registered before PARs to the delivery they came in."
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          {mutation.isError ? <p className="w-full text-sm text-critical">{(mutation.error as Error).message}</p> : null}
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => {
              setSubmitted(true);
              if (problems.length === 0) mutation.mutate();
              else focusFirstProblem(document.getElementById("assign-par")?.closest<HTMLElement>("[role=dialog]") ?? null);
            }}
          >
            {mutation.isPending ? "Assigning…" : picked.size > 0 ? `Assign to ${picked.size} item${picked.size === 1 ? "" : "s"}` : "Assign PAR"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {submitted && problems.length > 0 ? <FormProblems problems={problems} /> : null}
        <ParField
          id="assign-par"
          code={parCode}
          onCodeChange={setParCode}
          lookup={parLookup}
          required
          error={submitted && parLookup.status !== "found" ? "Select the PAR these items came in" : undefined}
          autoFocus
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              id="assign-items"
              value={search}
              onChange={setSearch}
              placeholder="Search serial, brand, model…"
              className="min-w-48 flex-1"
              ariaLabel="Search items without a PAR"
              invalid={submitted && picked.size === 0}
            />
            <Button
              type="button"
              variant="ghost"
              disabled={rows.length === 0}
              onClick={() =>
                setPicked((prev) => {
                  const next = new Set(prev);
                  for (const r of rows) {
                    if (allVisiblePicked) next.delete(r.id);
                    else next.add(r.id);
                  }
                  return next;
                })
              }
              className="text-xs"
            >
              {allVisiblePicked ? "Clear these" : `Select all ${rows.length}`}
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            {listQuery.data ? `${listQuery.data.total} item${listQuery.data.total === 1 ? "" : "s"} without a PAR` : "Loading…"}
            {picked.size > 0 ? ` · ${picked.size} selected` : ""}
          </p>
          <div className={clsx("overflow-hidden rounded-lg border border-[color:var(--border-hairline)]", listQuery.isPlaceholderData && "opacity-60")}>
            {listQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                {debounced ? "No items without a PAR match this search." : "Every item has a PAR. Nothing to assign."}
              </p>
            ) : (
              <ul className="max-h-[22rem] divide-y divide-[color:var(--gridline)] overflow-y-auto">
                {rows.map((item) => (
                  <li key={item.id}>
                    <label className={clsx("flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-black/[0.025] dark:hover:bg-white/[0.04]", picked.has(item.id) && "bg-series-1/[0.06]")}>
                      <input type="checkbox" checked={picked.has(item.id)} onChange={() => toggle(item.id)} className="h-4 w-4 shrink-0 accent-[var(--series-1)]" />
                      <CategoryTile code={item.item_categories?.code} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{itemDisplayName(item)}</span>
                        <SerialTag value={item.serial_number} />
                      </span>
                      <ItemStatusBadge status={item.item_statuses} />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
