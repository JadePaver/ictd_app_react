import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { PageSpinner } from "../../components/ui/Spinner";
import { AlertTriangleIcon } from "../../components/ui/icons";
import { technicalRequestsApi } from "../../lib/resources";
import { REQUEST_STATUS } from "../../lib/constants";
import { requestStatusTone, toneDotClass } from "../../lib/statusStyles";
import { fullName, formatDateTime, formatHours, formatRelativeDateTime } from "../../lib/format";
import { latestDenialActivity, responseHoursFor } from "../../lib/requestMetrics";

function statusLabel(statusId: number | null): string {
  switch (statusId) {
    case REQUEST_STATUS.ACCEPTED:
      return "Accepted";
    case REQUEST_STATUS.COMPLETED:
      return "Completed";
    case REQUEST_STATUS.DENIED:
      return "Denied";
    default:
      return "Pending";
  }
}

export function RequestDetailModal({
  id,
  onClose,
  initialShowDenyForm,
}: {
  id: number;
  onClose: () => void;
  /** Opens straight to the deny form — used by the triage board's Deny
   * quick-action, which can't collect the required reason inline. */
  initialShowDenyForm?: boolean;
}) {
  const queryClient = useQueryClient();
  const [denyReason, setDenyReason] = useState("");
  const [showDenyForm, setShowDenyForm] = useState(initialShowDenyForm ?? false);

  const query = useQuery({
    queryKey: ["technical-requests", id],
    queryFn: () => technicalRequestsApi.get(id),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["technical-requests"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const acceptMutation = useMutation({
    mutationFn: () => technicalRequestsApi.accept(id),
    onSuccess: invalidate,
  });
  const completeMutation = useMutation({
    mutationFn: () => technicalRequestsApi.complete(id),
    onSuccess: invalidate,
  });
  const denyMutation = useMutation({
    mutationFn: (reason: string) => technicalRequestsApi.deny(id, reason),
    onSuccess: () => {
      invalidate();
      setShowDenyForm(false);
      setDenyReason("");
    },
  });

  const request = query.data?.data;
  const isPending = request?.latestStatusId === REQUEST_STATUS.PENDING || request?.latestStatusId == null;
  const isAccepted = request?.latestStatusId === REQUEST_STATUS.ACCEPTED;
  const isDenied = request?.latestStatusId === REQUEST_STATUS.DENIED;

  const sortedActivities = useMemo(
    () =>
      request
        ? [...request.technical_request_activity].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
        : [],
    [request],
  );

  const denialActivity = isDenied ? latestDenialActivity(sortedActivities) : undefined;
  const responseHours = request ? responseHoursFor(request) : null;

  return (
    <Modal title={`Request #${id}`} onClose={onClose} width="max-w-2xl">
      {query.isLoading || !request ? (
        <PageSpinner />
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={requestStatusTone(request.latestStatusId)}>{statusLabel(request.latestStatusId)}</Badge>
              <Badge tone="neutral">{request.request_types?.label ?? "Unknown type"}</Badge>
              {request.departments ? <Badge tone="neutral">{request.departments.label}</Badge> : null}
            </div>
            <p className="mt-1.5 text-xs text-ink-muted" title={formatDateTime(request.created_at)}>
              Requested {formatRelativeDateTime(request.created_at)}
            </p>
          </div>

          {isDenied ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-critical/30 bg-critical/10 p-3">
              <AlertTriangleIcon size={16} className="mt-0.5 shrink-0 text-critical" />
              <div>
                <p className="text-sm font-medium text-critical">
                  Denied{denialActivity ? ` by ${fullName(denialActivity.set_by_user)}` : ""}
                </p>
                <p className="mt-0.5 text-sm text-ink-secondary">{denialActivity?.message || "No reason given."}</p>
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-medium text-ink-muted">Description</p>
            <p className="text-sm text-ink">{request.description || "—"}</p>
          </div>

          {request.look_for ? (
            <div>
              <p className="text-xs font-medium text-ink-muted">Looking for</p>
              <p className="text-sm text-ink">{request.look_for}</p>
            </div>
          ) : null}

          {request.url ? (
            <div>
              <p className="text-xs font-medium text-ink-muted">Reference link</p>
              <a href={request.url} target="_blank" rel="noreferrer" className="text-sm text-series-1 underline">
                {request.url}
              </a>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-ink-muted">Requested by</p>
              <p className="text-ink">{fullName(request.created_by_user)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Responded by</p>
              <p className="text-ink">{fullName(request.responded_by_user)}</p>
              {responseHours != null ? (
                <p className="text-xs text-ink-muted">Responded after {formatHours(responseHours)}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Requested on</p>
              <p className="text-ink">{formatDateTime(request.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Last updated</p>
              <p className="text-ink">{formatDateTime(request.updated_at ?? request.created_at)}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">Activity</p>
            {sortedActivities.length === 0 ? (
              <p className="text-sm text-ink-muted">No activity yet.</p>
            ) : (
              <ul className="flex flex-col">
                {sortedActivities.map((activity, index) => (
                  <li key={activity.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {/* The segment takes its own dot's tone, so the thread
                        descends out of each status in that status's color
                        rather than in `--gridline`, which is the chart-grid
                        token — the faintest line in the palette, and invisible
                        as a 2px rule on a near-white surface. `opacity-60`
                        keeps the 10px dot the anchor and the thread the
                        connection between them.

                        Geometry: `left-1 w-0.5` sits on whole pixels, centered
                        under the dot (a 1px rule at 4.5px straddles two pixel
                        columns and antialiases to half strength). It spans the
                        dot's bottom edge (`top-4`) to the next dot's top edge —
                        `-bottom-1.5` clears this row's `pb-4` and the next
                        dot's `mt-1.5`. */}
                    {index < sortedActivities.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "absolute top-4 -bottom-1.5 left-1 w-0.5 rounded-full opacity-60",
                          toneDotClass(requestStatusTone(activity.status_id)),
                        )}
                      />
                    ) : null}
                    <span
                      className={clsx(
                        "relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        toneDotClass(requestStatusTone(activity.status_id)),
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={requestStatusTone(activity.status_id)}>{statusLabel(activity.status_id)}</Badge>
                        {/* Absolute, always — the log is read as an audit
                            trail ("who accepted this, and when"), where two
                            entries on the same day have to be tellable apart.
                            The board's cards keep the relative form; that's
                            the triage view, this is the record. */}
                        <span className="shrink-0 text-xs whitespace-nowrap tabular-nums text-ink-muted">
                          {formatDateTime(activity.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-secondary">
                        by {fullName(activity.set_by_user)}
                        {activity.message ? ` — ${activity.message}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {showDenyForm ? (
            <div className="flex flex-col gap-2 rounded-lg border border-[color:var(--border-hairline)] p-3">
              <label className="text-xs font-medium text-ink-muted" htmlFor="deny-reason">
                Reason for denial
              </label>
              <textarea
                id="deny-reason"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                rows={3}
                autoFocus
                className="rounded-lg border border-[color:var(--border-hairline)] bg-transparent p-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowDenyForm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={!denyReason.trim() || denyMutation.isPending}
                  onClick={() => denyMutation.mutate(denyReason.trim())}
                >
                  Confirm deny
                </Button>
              </div>
              {denyMutation.isError ? (
                <p className="text-xs text-critical">{(denyMutation.error as Error).message}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--border-hairline)] pt-4">
              {isPending ? (
                <>
                  <Button variant="secondary" onClick={() => setShowDenyForm(true)}>
                    Deny
                  </Button>
                  <Button disabled={acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>
                    Accept
                  </Button>
                </>
              ) : null}
              {isAccepted ? (
                <Button disabled={completeMutation.isPending} onClick={() => completeMutation.mutate()}>
                  Mark completed
                </Button>
              ) : null}
              {acceptMutation.isError ? (
                <p className="w-full text-right text-xs text-critical">{(acceptMutation.error as Error).message}</p>
              ) : null}
              {completeMutation.isError ? (
                <p className="w-full text-right text-xs text-critical">{(completeMutation.error as Error).message}</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
