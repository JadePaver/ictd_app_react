import { REQUEST_STATUS } from "./constants";
import type { TechnicalRequestActivity } from "../types/api";

/** Earliest activity that moved a technical request off "pending", relative
 * to creation — mirrors dashboard.routes.ts's avgResponseHours calculation
 * so this per-request readout is directly comparable to that org-wide
 * average. Shared by RequestDetailModal and the triage board's Completed
 * column. */
export function responseHoursFor(request: {
  created_at: string;
  technical_request_activity: TechnicalRequestActivity[];
}): number | null {
  let earliestMs = Infinity;
  for (const activity of request.technical_request_activity) {
    if (activity.status_id == null || activity.status_id === REQUEST_STATUS.PENDING) continue;
    const at = new Date(activity.created_at).getTime();
    if (!Number.isNaN(at) && at < earliestMs) earliestMs = at;
  }
  const createdMs = new Date(request.created_at).getTime();
  return Number.isFinite(earliestMs) && earliestMs >= createdMs ? (earliestMs - createdMs) / 3_600_000 : null;
}

/** Most recent denial activity, if any — used to surface the reason both in
 * the detail modal's callout and as a one-line excerpt on the board's
 * Denied cards, without a second round trip. */
export function latestDenialActivity(activities: TechnicalRequestActivity[]): TechnicalRequestActivity | undefined {
  return [...activities]
    .filter((a) => a.status_id === REQUEST_STATUS.DENIED)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
}
