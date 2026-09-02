import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { announcementsApi, referenceApi } from "../../lib/resources";
import { formatDateTime } from "../../lib/format";
import type { Announcement } from "../../types/api";

const inputClass =
  "w-full rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15";
const labelClass = "text-xs font-medium text-ink-muted";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Explains what "schedule for later" actually does — there's no
 * server-side job that fires when the date arrives. Per
 * ictd_app/lib/providers/announcements_provider.dart's `submit` and
 * dashboard_provider.dart's feed filter: a future date just hides the post
 * from everyone but its creator until that time passes, at which point it
 * quietly appears next time a reader opens the app — no push notification
 * fires when it goes live. And per announcements.routes.ts's PATCH handler,
 * *editing* never (re-)notifies at all, regardless of this date. Without
 * this hint, "schedule" reads like an ordinary delayed-send, which it isn't.
 */
function scheduleHint(scheduledAt: string, isEdit: boolean): string {
  if (isEdit) {
    return "Editing never sends a notification, regardless of this date — it only controls when this becomes visible to everyone but you.";
  }
  if (!scheduledAt) return "Publishes and notifies recipients immediately.";
  const dueMs = new Date(scheduledAt).getTime();
  if (Number.isNaN(dueMs) || dueMs <= Date.now()) {
    return "This time has already passed — saving will publish and notify immediately.";
  }
  return `No notification will fire at that time — there's no scheduler. Only you'll see it until ${formatDateTime(scheduledAt)} passes, then it quietly appears for everyone else next time they open the app.`;
}

export function AnnouncementFormModal({
  announcement,
  onClose,
}: {
  announcement?: Announcement;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!announcement;

  const [title, setTitle] = useState(announcement?.title ?? "");
  const [content, setContent] = useState(announcement?.content ?? "");
  const [broadcastAll, setBroadcastAll] = useState(announcement?.broadcast_all ?? true);
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(announcement?.scheduled_at ?? null));

  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const detailQuery = useQuery({
    queryKey: ["announcements", announcement?.id],
    queryFn: () => announcementsApi.get(announcement!.id),
    enabled: isEdit,
  });

  const preselected = detailQuery.data?.data.departments?.map((d) => d.id) ?? [];
  const effectiveDepartmentIds = departmentIds.length > 0 || !isEdit ? departmentIds : preselected;
  const allDepartments = departmentsQuery.data?.data ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        content: content.trim(),
        broadcastAll,
        departmentIds: broadcastAll ? [] : effectiveDepartmentIds,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      };
      if (isEdit) {
        await announcementsApi.update(announcement!.id, body);
      } else {
        await announcementsApi.create(body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  function toggleDepartment(id: number) {
    setDepartmentIds((current) => {
      const base = current.length > 0 || !isEdit ? current : preselected;
      return base.includes(id) ? base.filter((d) => d !== id) : [...base, id];
    });
  }

  const canSubmit =
    title.trim().length > 0 && content.trim().length > 0 && (broadcastAll || effectiveDepartmentIds.length > 0);

  return (
    <Modal title={isEdit ? "Edit announcement" : "Create announcement"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
      >
        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="ann-title">
            Title
          </label>
          <input id="ann-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="ann-content">
            Content
          </label>
          <textarea
            id="ann-content"
            className={inputClass}
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Audience</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBroadcastAll(true)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                broadcastAll ? "border-series-1 bg-series-1/10 text-series-1" : "border-[color:var(--border-hairline)] text-ink-secondary"
              }`}
            >
              All departments
            </button>
            <button
              type="button"
              onClick={() => setBroadcastAll(false)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                !broadcastAll ? "border-series-1 bg-series-1/10 text-series-1" : "border-[color:var(--border-hairline)] text-ink-secondary"
              }`}
            >
              Specific departments
            </button>
          </div>
        </div>

        {!broadcastAll ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className={labelClass}>
                Target departments · {effectiveDepartmentIds.length} of {allDepartments.length} selected
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  className="font-medium text-series-1 hover:underline disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => setDepartmentIds(allDepartments.map((d) => d.id))}
                  disabled={effectiveDepartmentIds.length === allDepartments.length}
                >
                  Select all
                </button>
                <span className="text-ink-muted">·</span>
                <button
                  type="button"
                  className="font-medium text-series-1 hover:underline disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => setDepartmentIds([])}
                  disabled={effectiveDepartmentIds.length === 0}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-[color:var(--border-hairline)] p-2">
              {allDepartments.map((d) => (
                <label key={d.id} className="flex items-center gap-2 py-1 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={effectiveDepartmentIds.includes(d.id)}
                    onChange={() => toggleDepartment(d.id)}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="ann-schedule">
            Schedule for later (optional)
          </label>
          <input
            id="ann-schedule"
            type="datetime-local"
            className={inputClass}
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <p className="text-xs text-ink-muted">{scheduleHint(scheduledAt, isEdit)}</p>
        </div>

        {mutation.isError ? <p className="text-xs text-critical">{(mutation.error as Error).message}</p> : null}

        <div className="flex justify-end gap-2 border-t border-[color:var(--border-hairline)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || mutation.isPending}>
            {isEdit ? "Save changes" : "Publish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
