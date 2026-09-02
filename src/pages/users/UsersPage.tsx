import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { referenceApi, usersApi } from "../../lib/resources";
import { Card } from "../../components/ui/Card";
import { Combobox } from "../../components/ui/Combobox";
import { Pagination } from "../../components/ui/Pagination";
import { PageSpinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Avatar } from "../../components/ui/Avatar";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { SnackbarStack, type SnackbarData } from "../../components/ui/Snackbar";
import { AlertTriangleIcon, UsersIcon } from "../../components/ui/icons";
import { fullName } from "../../lib/format";
import { isSelfDemotion, roleLabelFor } from "../../lib/roleChange";
import { useAuth } from "../../context/AuthContext";
import { RoleToggle } from "./RoleToggle";
import { UserDetailModal } from "./UserDetailModal";

const PAGE_SIZE = 20;

export function UsersPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [pendingChange, setPendingChange] = useState<{ id: number; name: string; roleId: number } | null>(null);
  const [toasts, setToasts] = useState<SnackbarData[]>([]);

  const rolesQuery = useQuery({ queryKey: ["reference", "roles"], queryFn: referenceApi.roles });
  const listQuery = useQuery({
    queryKey: ["users", { search, roleId, page }],
    queryFn: () => usersApi.list({ search: search || undefined, roleId, page, pageSize: PAGE_SIZE }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, roleId }: { id: number; roleId: number }) => usersApi.setRole(id, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setPendingChange(null);
    },
  });

  function handleRoleChange(userId: number, name: string, roleId: number) {
    if (isSelfDemotion(userId, profile?.publicUserId, roleId)) {
      setToasts((prev) => [
        {
          id: Date.now(),
          title: "Can't change your own access",
          description: "You can't remove your own operator access from here.",
          icon: AlertTriangleIcon,
        },
        ...prev,
      ]);
      return;
    }
    setPendingChange({ id: userId, name, roleId });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Users</h1>
        <p className="text-sm text-ink-muted">ICTD App accounts and their role (client / operator).</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search name or username…"
          className="flex-1 rounded-lg border border-[color:var(--border-hairline)] bg-transparent px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-series-1 focus:ring-2 focus:ring-series-1/15"
        />
        <Combobox
          value={roleId}
          onChange={(value) => {
            setRoleId(value);
            setPage(0);
          }}
          options={(rolesQuery.data?.data ?? []).map((r) => ({ value: r.id, label: r.label }))}
          placeholder="All roles"
          className="sm:w-44"
        />
      </div>

      <Card className="overflow-x-auto">
        {listQuery.isLoading ? (
          <PageSpinner />
        ) : listQuery.isError ? (
          <ErrorState message={(listQuery.error as Error).message} />
        ) : listQuery.data && listQuery.data.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--gridline)] text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Departments</th>
                <th className="px-4 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.data.data.map((u) => {
                const currentRoleId = u.user_roles?.[0]?.role_id;
                return (
                  <tr
                    key={u.id}
                    onClick={() => setDetailUserId(u.id)}
                    className="cursor-pointer border-b border-[color:var(--gridline)] last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar person={u} size={30} />
                        <div className="min-w-0">
                          <p className="truncate text-ink">{fullName(u, u.username ?? `User #${u.id}`)}</p>
                          {u.username ? <p className="truncate text-xs text-ink-muted">@{u.username}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      {(u.employee_assigned_offices ?? []).map((o) => o.departments?.label).filter(Boolean).join(", ") ||
                        "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <RoleToggle
                        value={currentRoleId}
                        onChange={(roleId) => handleRoleChange(u.id, fullName(u, u.username ?? `User #${u.id}`), roleId)}
                        disabled={roleMutation.isPending}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={UsersIcon} title="No users found" hint="Try a different search term or role filter." />
        )}
      </Card>

      {listQuery.data ? (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={listQuery.data.total}
          onPageChange={setPage}
          itemLabel="users"
        />
      ) : null}

      {detailUserId != null ? <UserDetailModal userId={detailUserId} onClose={() => setDetailUserId(null)} /> : null}

      {pendingChange ? (
        <ConfirmModal
          title="Change access level"
          description={`Set ${pendingChange.name}'s role to "${roleLabelFor(pendingChange.roleId)}"?`}
          confirmLabel="Set role"
          loading={roleMutation.isPending}
          onConfirm={() => roleMutation.mutate({ id: pendingChange.id, roleId: pendingChange.roleId })}
          onCancel={() => setPendingChange(null)}
        />
      ) : null}

      <SnackbarStack items={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} className="md:left-60" />
    </div>
  );
}
