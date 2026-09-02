import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Modal } from "../../components/ui/Modal";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { PageSpinner } from "../../components/ui/Spinner";
import { referenceApi, usersApi } from "../../lib/resources";
import { fullName, formatDate } from "../../lib/format";
import { isSelfDemotion, roleLabelFor } from "../../lib/roleChange";
import { useAuth } from "../../context/AuthContext";
import { RoleToggle } from "./RoleToggle";

function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort((x, y) => x - y);
  return [...a].sort((x, y) => x - y).every((id, i) => id === sortedB[i]);
}

/**
 * A user's account profile — identity header, an access-level switch, and
 * their assigned-department chips, opened from a UsersPage row. Fetches its
 * own data (the *DetailModal convention every other list page follows)
 * because the list row only has enough to render a table cell, not this
 * full picture.
 */
export function UserDetailModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [pendingDepartmentIds, setPendingDepartmentIds] = useState<number[] | null>(null);
  const [pendingRoleId, setPendingRoleId] = useState<number | null>(null);
  const [guardMessage, setGuardMessage] = useState<string | null>(null);

  const query = useQuery({ queryKey: ["users", userId], queryFn: () => usersApi.get(userId) });
  const departmentsQuery = useQuery({ queryKey: ["reference", "departments"], queryFn: referenceApi.departments });
  const user = query.data?.data;

  const currentRoleId = user?.user_roles?.[0]?.role_id ?? null;
  const currentDepartmentIds = (user?.employee_assigned_offices ?? []).map((o) => o.department_id);
  const departmentIds = pendingDepartmentIds ?? currentDepartmentIds;
  const departmentsDirty = pendingDepartmentIds !== null && !sameIds(pendingDepartmentIds, currentDepartmentIds);

  const roleMutation = useMutation({
    mutationFn: (roleId: number) => usersApi.setRole(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setPendingRoleId(null);
    },
  });

  const departmentsMutation = useMutation({
    mutationFn: (ids: number[]) => usersApi.setDepartments(userId, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setPendingDepartmentIds(null);
    },
  });

  function handleRoleChange(roleId: number) {
    if (isSelfDemotion(userId, profile?.publicUserId, roleId)) {
      setGuardMessage("You can't remove your own operator access from here.");
      return;
    }
    setGuardMessage(null);
    setPendingRoleId(roleId);
  }

  function toggleDepartment(id: number) {
    setPendingDepartmentIds((current) => {
      const base = current ?? currentDepartmentIds;
      return base.includes(id) ? base.filter((d) => d !== id) : [...base, id];
    });
  }

  return (
    <Modal title="User profile" onClose={onClose}>
      {query.isLoading || !user ? (
        <PageSpinner />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar person={user} size={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-ink">{fullName(user, user.username ?? `User #${user.id}`)}</p>
              <p className="truncate text-sm text-ink-muted">{user.username ? `@${user.username}` : `User #${user.id}`}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">Access level</span>
            <RoleToggle value={currentRoleId} onChange={handleRoleChange} disabled={roleMutation.isPending} />
            {guardMessage ? <p className="text-xs text-critical">{guardMessage}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">
              Assigned departments · {departmentIds.length} of {departmentsQuery.data?.data.length ?? 0} selected
            </span>
            {departmentsQuery.isLoading ? (
              <PageSpinner />
            ) : (departmentsQuery.data?.data.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {departmentsQuery.data!.data.map((d) => {
                  const active = departmentIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDepartment(d.id)}
                      className={clsx(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-series-1 bg-series-1/10 text-series-1"
                          : "border-[color:var(--border-hairline)] text-ink-secondary hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No departments to assign.</p>
            )}
          </div>

          {departmentsMutation.isError ? (
            <p className="text-xs text-critical">{(departmentsMutation.error as Error).message}</p>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-[color:var(--border-hairline)] pt-4">
            <span className="text-xs text-ink-muted">Account created {formatDate(user.created_at)}</span>
            {departmentsDirty ? (
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setPendingDepartmentIds(null)}>
                  Discard
                </Button>
                <Button
                  type="button"
                  onClick={() => departmentsMutation.mutate(departmentIds)}
                  disabled={departmentsMutation.isPending}
                >
                  Save departments
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {pendingRoleId != null ? (
        <ConfirmModal
          title="Change access level"
          description={`Set this user's role to "${roleLabelFor(pendingRoleId)}"?`}
          confirmLabel="Set role"
          loading={roleMutation.isPending}
          onConfirm={() => roleMutation.mutate(pendingRoleId)}
          onCancel={() => setPendingRoleId(null)}
        />
      ) : null}
    </Modal>
  );
}
