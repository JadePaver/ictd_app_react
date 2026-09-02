import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { announcementsApi, referenceApi } from "../../lib/resources";
import type { Announcement } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { PageSpinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { BuildingIcon, ClockIcon, MegaphoneIcon } from "../../components/ui/icons";
import { formatCountdown, formatDateTime, formatRelativeTime } from "../../lib/format";
import { AnnouncementFormModal } from "./AnnouncementFormModal";

/**
 * Announcements aren't a workflow with states to triage — they're
 * publishing. Nothing here is "pending" or "denied"; it's either live or
 * scheduled. So instead of status tabs (which would borrow a decision-queue
 * metaphor that doesn't apply), scheduled posts get their own preview rail
 * — a small content calendar, not a filter — and audience is a reach bar
 * instead of a name-listing badge, since "how much of the org does this
 * reach" is the thing worth seeing at a glance.
 */

function isScheduledForFuture(a: Announcement): boolean {
  return !!a.scheduled_at && new Date(a.scheduled_at) > new Date();
}

/** How much of a card's content to show before offering "Show more" —
 * roughly 3 lines at this font size, matching the `line-clamp-3` below. */
const CONTENT_PREVIEW_THRESHOLD = 220;

function ReachIndicator({ announcement, totalDepartments }: { announcement: Announcement; totalDepartments: number }) {
  if (announcement.broadcast_all) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-series-1">
        <BuildingIcon size={12} />
        All departments
      </span>
    );
  }
  const count = announcement.departmentLabels.length;
  const pct = totalDepartments > 0 ? Math.min(100, Math.round((count / totalDepartments) * 100)) : 0;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <BuildingIcon size={12} className="shrink-0 text-ink-muted" />
      <span className="shrink-0 text-xs text-ink-secondary">
        {count}/{totalDepartments || "?"}
      </span>
      <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
        <div className="h-full rounded-full bg-series-1" style={{ width: `${pct}%` }} />
      </div>
      <span className="min-w-0 truncate text-xs text-ink-muted" title={announcement.departmentLabels.join(", ")}>
        {announcement.departmentLabels.join(", ") || "Targeted"}
      </span>
    </div>
  );
}

export function AnnouncementsListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ["announcements", { search }],
    queryFn: () => announcementsApi.list(search || undefined),
  });
  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const totalDepartments = departmentsQuery.data?.data.length ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => announcementsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setConfirmDeleteId(null);
    },
  });

  const all = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
  const hasSearch = search.trim() !== "";

  // Outside search, scheduled posts live exclusively in the rail below —
  // the main feed is "what's actually live." While searching, everything
  // matching (live or scheduled) surfaces in one combined list instead, so
  // a specific upcoming post can still be found by title.
  const scheduledUpcoming = useMemo(
    () =>
      hasSearch
        ? []
        : [...all].filter(isScheduledForFuture).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()),
    [all, hasSearch],
  );
  const feedRows = useMemo(() => (hasSearch ? all : all.filter((a) => !isScheduledForFuture(a))), [all, hasSearch]);

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Announcements</h1>
          <p className="text-sm text-ink-muted">Broadcast to all departments or target specific ones.</p>
        </div>
        <Button onClick={() => setCreating(true)}>New announcement</Button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search title, content, creator…"
        className="rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15"
      />

      {listQuery.isLoading ? (
        <PageSpinner />
      ) : listQuery.isError ? (
        <ErrorState message={(listQuery.error as Error).message} />
      ) : (
        <>
          {scheduledUpcoming.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Upcoming</h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {scheduledUpcoming.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setEditing(a)}
                    className="flex w-56 shrink-0 flex-col gap-1.5 rounded-xl border border-warning/30 bg-warning/5 p-3 text-left transition-colors hover:border-warning/60"
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8a5a00] dark:text-warning">
                      <ClockIcon size={12} />
                      {formatCountdown(a.scheduled_at)}
                    </span>
                    <p className="line-clamp-1 text-sm font-medium text-ink">{a.title}</p>
                    <p className="line-clamp-2 text-xs text-ink-secondary">{a.content}</p>
                    <p className="text-[11px] text-ink-muted">{formatDateTime(a.scheduled_at)}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {feedRows.length > 0 ? (
            <div className="flex flex-col gap-3">
              {feedRows.map((a) => {
                const isFuture = isScheduledForFuture(a);
                const isExpanded = expandedIds.has(a.id);
                const isLong = (a.content?.length ?? 0) > CONTENT_PREVIEW_THRESHOLD;
                const wasEdited = a.updated_at && a.updated_at !== a.created_at;
                return (
                  <Card key={a.id} className={clsx("flex flex-col gap-2 p-4", isFuture && "border-warning/40 bg-warning/5")}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-ink">{a.title}</p>
                          {isFuture ? <Badge tone="warning">Scheduled — {formatCountdown(a.scheduled_at)}</Badge> : null}
                        </div>
                        <p
                          className={clsx(
                            "mt-1 text-sm whitespace-pre-line text-ink-secondary",
                            !isExpanded && isLong && "line-clamp-3",
                          )}
                        >
                          {a.content}
                        </p>
                        {isLong ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(a.id)}
                            className="mt-1 text-xs font-medium text-series-1 hover:underline"
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="secondary" onClick={() => setEditing(a)}>
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => setConfirmDeleteId(a.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <ReachIndicator announcement={a} totalDepartments={totalDepartments} />
                      <span className="shrink-0">
                        by {`${a.users?.first_name ?? ""} ${a.users?.last_name ?? ""}`.trim() || "Unknown"} ·{" "}
                        <span title={formatDateTime(a.created_at)}>{formatRelativeTime(a.created_at)}</span>
                        {wasEdited ? <> · edited {formatRelativeTime(a.updated_at)}</> : null}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={MegaphoneIcon}
              title={hasSearch ? "No announcements found" : "No published announcements yet"}
              hint={
                hasSearch
                  ? "Try a different search term."
                  : scheduledUpcoming.length > 0
                    ? `You have ${scheduledUpcoming.length} scheduled — see Upcoming above.`
                    : "Create one to notify departments."
              }
            />
          )}
        </>
      )}

      {creating ? <AnnouncementFormModal onClose={() => setCreating(false)} /> : null}
      {editing ? <AnnouncementFormModal announcement={editing} onClose={() => setEditing(null)} /> : null}

      {confirmDeleteId != null ? (
        <Modal title="Delete announcement?" onClose={() => setConfirmDeleteId(null)} width="max-w-sm">
          <p className="mb-4 text-sm text-ink-secondary">This can't be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(confirmDeleteId)}>
              Delete
            </Button>
          </div>
          {deleteMutation.isError ? (
            <p className="mt-2 text-right text-xs text-critical">{(deleteMutation.error as Error).message}</p>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
