import { api, buildQuery } from "./apiClient";
import type {
  Announcement,
  Custodian,
  CustodianDetail,
  CustodianStats,
  DashboardStats,
  DashboardUser,
  Department,
  DepartmentStats,
  ActivityEvent,
  InventoryItem,
  InventoryItemDetail,
  InventorySummary,
  ItemAvailability,
  ItemRef,
  Par,
  ParDetail,
  Placement,
  ItemCategory,
  ItemStatusRef,
  MemorandumReceipt,
  MemorandumReceiptDetail,
  MrSegment,
  MrStatusFilter,
  MrSummary,
  Paginated,
  RepairItem,
  RepairItemCounts,
  RepairStatusRef,
  RequestStatusFilter,
  RequestStatusRef,
  ReportPeriodKey,
  RequestType,
  Role,
  TechnicalRequest,
  TechnicianReport,
  TechnicianRosterEntry,
  UserDirectoryEntry,
  WorkloadEntry,
} from "../types/api";

export const authApi = {
  me: () => api.get<{ data: DashboardUser }>("/auth/me"),
};

export const dashboardApi = {
  stats: (days = 14) => api.get<{ data: DashboardStats }>(`/dashboard/stats${buildQuery({ days })}`),
  activity: (limit = 15) => api.get<{ data: ActivityEvent[] }>(`/dashboard/activity${buildQuery({ limit })}`),
  workload: (limit = 10) => api.get<{ data: WorkloadEntry[] }>(`/dashboard/workload${buildQuery({ limit })}`),
};

export interface TechnicianReportParams {
  period: ReportPeriodKey;
  /** Required for "month" and "year"; ignored for "all". */
  year?: number;
  /** 1-12. Required for "month" only. */
  month?: number;
}

export const reportsApi = {
  technicians: () => api.get<{ data: TechnicianRosterEntry[] }>("/reports/technicians"),
  /**
   * Period boundaries are cut in the *browser's* timezone, not UTC, so
   * "September" means the operator's September, hence `tzOffset` riding
   * along on every call. `getTimezoneOffset()` is minutes behind UTC, which
   * is exactly what the API expects.
   */
  technician: (userId: number, params: TechnicianReportParams) =>
    api.get<{ data: TechnicianReport }>(
      `/reports/technicians/${userId}${buildQuery({ ...params, tzOffset: new Date().getTimezoneOffset() })}`,
    ),
};

export type RequestSortBy = "createdAt" | "updatedAt" | "department" | "status" | "type";
export type SortDir = "asc" | "desc";

export interface TechnicalRequestListParams {
  status?: RequestStatusFilter;
  departmentId?: number;
  typeId?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: RequestSortBy;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

export const technicalRequestsApi = {
  list: (params: TechnicalRequestListParams = {}) =>
    api.get<Paginated<TechnicalRequest>>(`/technical-requests${buildQuery(params)}`),
  get: (id: number) => api.get<{ data: TechnicalRequest }>(`/technical-requests/${id}`),
  accept: (id: number) => api.post<{ ok: true }>(`/technical-requests/${id}/accept`),
  deny: (id: number, reason: string) => api.post<{ ok: true }>(`/technical-requests/${id}/deny`, { reason }),
  complete: (id: number) => api.post<{ ok: true }>(`/technical-requests/${id}/complete`),
  updateStatus: (id: number, statusId: number, message?: string) =>
    api.patch<{ ok: true }>(`/technical-requests/${id}/status`, { statusId, message }),
};

export type RepairSortBy = "createdAt" | "updatedAt" | "itemName" | "status" | "receivedAt";

export interface RepairItemListParams {
  status?: "all" | "active" | "done";
  statusId?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  receivedBy?: number;
  sortBy?: RepairSortBy;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

export const repairItemsApi = {
  list: (params: RepairItemListParams = {}) => api.get<Paginated<RepairItem>>(`/repair-items${buildQuery(params)}`),
  /** All/Active/Done tab counts — scoped by `receivedBy` only, same
   * reasoning as technicalRequestsApi.counts. */
  counts: (params: { receivedBy?: number } = {}) =>
    api.get<{ data: RepairItemCounts }>(`/repair-items/counts${buildQuery(params)}`),
  get: (id: number) => api.get<{ data: RepairItem }>(`/repair-items/${id}`),
  create: (body: {
    itemName: string;
    description?: string;
    ownerUserId?: number | null;
    owner?: string;
    ownerContact?: string;
    serialNumber?: string;
    conditionOnReceive?: string;
  }) => api.post<{ data: { id: number } }>("/repair-items", body),
  update: (
    id: number,
    body: Partial<{
      itemName: string;
      description: string | null;
      owner: string | null;
      ownerUserId: number | null;
      ownerContact: string | null;
      serialNumber: string | null;
      conditionOnReceive: string | null;
      conditionOnRelease: string | null;
    }>,
  ) => api.patch<{ ok: true }>(`/repair-items/${id}`, body),
  updateStatus: (id: number, statusId: number, notes?: string) =>
    api.patch<{ ok: true }>(`/repair-items/${id}/status`, { statusId, notes }),
  remove: (id: number) => api.delete<{ ok: true }>(`/repair-items/${id}`),
};

export const announcementsApi = {
  list: (search?: string) => api.get<{ data: Announcement[] }>(`/announcements${buildQuery({ search })}`),
  get: (id: number) => api.get<{ data: Announcement }>(`/announcements/${id}`),
  create: (body: { title: string; content: string; broadcastAll: boolean; departmentIds: number[]; scheduledAt: string | null }) =>
    api.post<{ data: { id: number } }>("/announcements", body),
  update: (
    id: number,
    body: { title: string; content: string; broadcastAll: boolean; departmentIds: number[]; scheduledAt: string | null },
  ) => api.patch<{ ok: true }>(`/announcements/${id}`, body),
  remove: (id: number) => api.delete<{ ok: true }>(`/announcements/${id}`),
};

export interface DepartmentEmployee {
  id: number;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  username: string | null;
}

export const departmentsApi = {
  list: () => api.get<{ data: Department[] }>("/departments"),
  stats: () => api.get<{ data: DepartmentStats[] }>("/departments/stats"),
  employees: (id: number) => api.get<{ data: DepartmentEmployee[] }>(`/departments/${id}/employees`),
  create: (body: { label: string; code?: string }) => api.post<{ data: Department }>("/departments", body),
  update: (id: number, body: { label?: string; code?: string | null }) =>
    api.patch<{ data: Department }>(`/departments/${id}`, body),
};

export interface UserListParams {
  search?: string;
  roleId?: number;
  page?: number;
  pageSize?: number;
}

export const usersApi = {
  list: (params: UserListParams = {}) => api.get<Paginated<UserDirectoryEntry>>(`/users${buildQuery(params)}`),
  get: (id: number) => api.get<{ data: UserDirectoryEntry }>(`/users/${id}`),
  setRole: (id: number, roleId: number) => api.patch<{ ok: true }>(`/users/${id}/role`, { roleId }),
  setDepartments: (id: number, departmentIds: number[]) =>
    api.patch<{ ok: true }>(`/users/${id}/departments`, { departmentIds }),
};

export const referenceApi = {
  departments: () => api.get<{ data: Department[] }>("/reference/departments"),
  requestTypes: () => api.get<{ data: RequestType[] }>("/reference/request-types"),
  requestStatuses: () => api.get<{ data: RequestStatusRef[] }>("/reference/request-statuses"),
  repairStatuses: () => api.get<{ data: RepairStatusRef[] }>("/reference/repair-statuses"),
  roles: () => api.get<{ data: Role[] }>("/reference/roles"),
  itemCategories: () => api.get<{ data: ItemCategory[] }>("/reference/item-categories"),
  itemStatuses: () => api.get<{ data: ItemStatusRef[] }>("/reference/item-statuses"),
};

export type InventorySortBy = "createdAt" | "updatedAt" | "serialNumber" | "brand" | "status";

export interface InventoryFilterParams {
  search?: string;
  categoryId?: number;
  statusId?: number;
  departmentId?: number;
  /** "available": not on any active MR and not inside a PC. "issued": on one. */
  availability?: ItemAvailability;
  /** A PAR id, or "none" for items registered before PARs. */
  parId?: number | "none";
  placement?: Placement;
  /** Units or parts (CPU, GPU, RAM, Storage). */
  kind?: "unit" | "part";
}

/** Shared fields for registering one item or many under a PAR. */
export interface RegisterFields {
  parId: number;
  categoryId: number;
  statusId?: number;
  brand?: string;
  model?: string;
  departmentId?: number | null;
  description?: string;
}

export interface AssembleBody {
  assetTag: string;
  partIds: number[];
  brand?: string;
  model?: string;
  departmentId?: number | null;
  parId?: number | null;
  description?: string;
}

export type RemovalStatus = "in_storage" | "under_repair" | "missing" | "decommissioned";

export interface InventoryItemListParams extends InventoryFilterParams {
  sortBy?: InventorySortBy;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

export const inventoryItemsApi = {
  list: (params: InventoryItemListParams = {}) =>
    api.get<Paginated<InventoryItem>>(`/inventory-items${buildQuery(params)}`),
  /** Faceted counts for the same filters (each facet ignores its own). */
  summary: (params: InventoryFilterParams = {}) =>
    api.get<{ data: InventorySummary }>(`/inventory-items/summary${buildQuery(params)}`),
  get: (id: number) => api.get<{ data: InventoryItemDetail }>(`/inventory-items/${id}`),
  /** One item under a PAR (rule 16). */
  create: (body: RegisterFields & { serialNumber: string }) => api.post<{ data: InventoryItem }>("/inventory-items", body),
  /** Many serials, shared details, all or nothing (rule 24). */
  bulk: (body: RegisterFields & { serialNumbers: string[] }) => api.post<{ data: InventoryItem[] }>("/inventory-items/bulk", body),
  /** Which of these serials are already registered, any letter case. */
  checkSerials: (serials: string[]) =>
    api.post<{ data: { serial: string; item: ItemRef }[] }>("/inventory-items/check-serials", { serials }),
  assignPar: (itemIds: number[], parId: number) =>
    api.post<{ data: { updated: number } }>("/inventory-items/assign-par", { itemIds, parId }),
  nextPcTag: () => api.get<{ data: { assetTag: string } }>("/inventory-items/next-pc-tag"),
  assemble: (body: AssembleBody) => api.post<{ data: { id: number } }>("/inventory-items/assemble", body),
  updateParts: (hostId: number, body: { install: number[]; remove: { partId: number; status: RemovalStatus }[]; notes?: string }) =>
    api.post<{ data: { installed: number; removed: number } }>(`/inventory-items/${hostId}/parts`, body),
  update: (
    id: number,
    body: Partial<{
      categoryId: number;
      brand: string | null;
      model: string | null;
      serialNumber: string;
      departmentId: number | null;
      statusId: number;
      description: string | null;
      parId: number | null;
    }>,
  ) => api.patch<{ data: InventoryItem }>(`/inventory-items/${id}`, body),
  remove: (id: number) => api.delete<{ ok: true }>(`/inventory-items/${id}`),
};

export type MrSortBy = "issuedAt" | "dueAt" | "status" | "mrNumber" | "custodian";

export interface MrScopeParams {
  custodianId?: number;
  departmentId?: number;
  search?: string;
}

export interface MrListParams extends MrScopeParams {
  segment?: MrSegment;
  /** Legacy raw-status filter; ignored when `segment` is set. */
  status?: MrStatusFilter;
  /** Omit to let the API pick: soonest-due first for urgency segments,
   * newest issued first otherwise. */
  sortBy?: MrSortBy;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

export interface MrIssueBody {
  mrNumber: string;
  custodianId: number;
  departmentId?: number | null;
  itemIds: number[];
  /** ISO timestamp; the end of the chosen day in the operator's timezone. */
  expectedReturnAt?: string;
  notes?: string;
}

export interface MrTransferBody {
  mrNumber: string;
  custodianId: number;
  departmentId?: number | null;
  expectedReturnAt?: string;
  notes?: string;
  /** Subset of the MR's active items to move. Omit to move all of them. */
  itemIds?: number[];
}

export const mrApi = {
  list: (params: MrListParams = {}) =>
    api.get<Paginated<MemorandumReceipt> & { sortBy: MrSortBy; sortDir: SortDir }>(`/mr${buildQuery(params)}`),
  summary: (params: MrScopeParams = {}) => api.get<{ data: MrSummary }>(`/mr/summary${buildQuery(params)}`),
  get: (id: number) => api.get<{ data: MemorandumReceiptDetail }>(`/mr/${id}`),
  nextNumber: () => api.get<{ data: { mrNumber: string } }>("/mr/next-number"),
  issue: (body: MrIssueBody) => api.post<{ data: { id: number } }>("/mr", body),
  return: (id: number, notes?: string) => api.post<{ ok: true }>(`/mr/${id}/return`, { notes }),
  transfer: (id: number, body: MrTransferBody) =>
    api.post<{ data: { id: number; isFullTransfer: boolean } }>(`/mr/${id}/transfer`, body),
};

export type CustodianSortBy = "name" | "employeeNumber" | "department" | "activeItems" | "accountability";

export interface CustodianListParams {
  search?: string;
  departmentId?: number;
  /** Custodians currently sitting on at least one overdue item. */
  overdueOnly?: boolean;
  /** Custodians holding anything right now. */
  holdingOnly?: boolean;
  sortBy?: CustodianSortBy;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

export const custodiansApi = {
  list: (params: CustodianListParams = {}) => api.get<Paginated<Custodian>>(`/custodians${buildQuery(params)}`),
  stats: () => api.get<{ data: CustodianStats }>("/custodians/stats"),
  get: (id: number) => api.get<{ data: CustodianDetail }>(`/custodians/${id}`),
  create: (body: {
    firstName: string;
    middleName?: string;
    lastName: string;
    employeeNumber?: string;
    departmentId?: number;
    contactNumber?: string;
    email?: string;
    notes?: string;
  }) => api.post<{ data: Custodian }>("/custodians", body),
  update: (
    id: number,
    body: Partial<{
      firstName: string;
      middleName: string | null;
      lastName: string;
      employeeNumber: string | null;
      departmentId: number | null;
      contactNumber: string | null;
      email: string | null;
      notes: string | null;
    }>,
  ) => api.patch<{ data: Custodian }>(`/custodians/${id}`, body),
  remove: (id: number) => api.delete<{ ok: true }>(`/custodians/${id}`),
};

export interface ParListParams {
  search?: string;
  /** Exact code, ignoring case. */
  code?: string;
  sortBy?: "dateReceived" | "parCode" | "createdAt";
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

export interface ParBody {
  parCode: string;
  /** YYYY-MM-DD */
  dateReceived: string;
  referenceNo?: string | null;
  supplier?: string | null;
  /** "248,600.00" or a number; blank for none. */
  amount?: string | number | null;
  receivedBy?: string | null;
  remarks?: string | null;
}

export const parsApi = {
  list: (params: ParListParams = {}) => api.get<Paginated<Par>>(`/pars${buildQuery(params)}`),
  get: (id: number) => api.get<{ data: ParDetail }>(`/pars/${id}`),
  create: (body: ParBody) => api.post<{ data: Par }>("/pars", body),
  update: (id: number, body: Partial<ParBody>) => api.patch<{ data: Par }>(`/pars/${id}`, body),
  remove: (id: number) => api.delete<{ ok: true }>(`/pars/${id}`),
};
