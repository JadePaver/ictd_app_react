import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { repairItemsApi, usersApi } from "../../lib/resources";
import { fullName } from "../../lib/format";
import type { UserDirectoryEntry } from "../../types/api";

const inputClass =
  "w-full rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";
const labelClass = "text-xs font-medium text-ink-muted";

export function BookInModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [isSystemUser, setIsSystemUser] = useState(true);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerUserId, setOwnerUserId] = useState<number | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<UserDirectoryEntry | null>(null);
  const [customOwnerName, setCustomOwnerName] = useState("");
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [conditionOnReceive, setConditionOnReceive] = useState("");

  const usersQuery = useQuery({
    queryKey: ["users", "search", ownerSearch],
    queryFn: () => usersApi.list({ search: ownerSearch || undefined, pageSize: 15 }),
    enabled: isSystemUser,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      repairItemsApi.create({
        itemName: itemName.trim(),
        description: description.trim() || undefined,
        ownerUserId: isSystemUser ? ownerUserId : null,
        owner: isSystemUser ? undefined : customOwnerName.trim(),
        ownerContact: ownerContact.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        conditionOnReceive: conditionOnReceive.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repair-items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  const canSubmit = itemName.trim().length > 0 && (isSystemUser ? ownerUserId != null : customOwnerName.trim().length > 0);

  return (
    <Modal title="Book in a repair item" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) createMutation.mutate();
        }}
      >
        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="item-name">
            Item name
          </label>
          <input id="item-name" className={inputClass} value={itemName} onChange={(e) => setItemName(e.target.value)} required />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="item-description">
            Description
          </label>
          <textarea
            id="item-description"
            className={inputClass}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsSystemUser(true)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              isSystemUser ? "border-series-1 bg-series-1/10 text-series-1" : "border-[color:var(--border-hairline)] text-ink-secondary"
            }`}
          >
            App user
          </button>
          <button
            type="button"
            onClick={() => setIsSystemUser(false)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              !isSystemUser ? "border-series-1 bg-series-1/10 text-series-1" : "border-[color:var(--border-hairline)] text-ink-secondary"
            }`}
          >
            Custom owner
          </button>
        </div>

        {isSystemUser ? (
          selectedOwner ? (
            // Same "picked" pattern as CustodianPicker — collapse the search
            // list to a confirmation row so it's unambiguous who's selected
            // instead of leaving a re-filterable list open with a faint highlight.
            <div className="flex items-center gap-3 rounded-lg border border-[color:var(--border-hairline)] px-3 py-2.5">
              <Avatar person={selectedOwner} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{fullName(selectedOwner) || selectedOwner.username}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOwnerUserId(null);
                  setSelectedOwner(null);
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="owner-search">
                Owner (search app users)
              </label>
              <input
                id="owner-search"
                className={inputClass}
                value={ownerSearch}
                onChange={(e) => setOwnerSearch(e.target.value)}
                placeholder="Type a name…"
                autoFocus
              />
              <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-[color:var(--border-hairline)]">
                {usersQuery.data?.data.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => {
                      setOwnerUserId(u.id);
                      setSelectedOwner(u);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                  >
                    <Avatar person={u} size={24} className="text-[10px]" />
                    <span className="truncate">{fullName(u) || u.username}</span>
                  </button>
                ))}
                {usersQuery.data && usersQuery.data.data.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-ink-muted">No matches</p>
                ) : null}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="custom-owner">
              Owner name
            </label>
            <input
              id="custom-owner"
              className={inputClass}
              value={customOwnerName}
              onChange={(e) => setCustomOwnerName(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="owner-contact">
              Owner contact
            </label>
            <input id="owner-contact" className={inputClass} value={ownerContact} onChange={(e) => setOwnerContact(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="serial-number">
              Serial number
            </label>
            <input id="serial-number" className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="condition-receive">
            Condition on receipt
          </label>
          <textarea
            id="condition-receive"
            className={inputClass}
            rows={2}
            value={conditionOnReceive}
            onChange={(e) => setConditionOnReceive(e.target.value)}
          />
        </div>

        {createMutation.isError ? <p className="text-xs text-critical">{(createMutation.error as Error).message}</p> : null}

        <div className="flex justify-end gap-2 border-t border-[color:var(--border-hairline)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || createMutation.isPending}>
            Book in
          </Button>
        </div>
      </form>
    </Modal>
  );
}
