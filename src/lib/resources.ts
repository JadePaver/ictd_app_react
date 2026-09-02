import { api, buildQuery } from "./apiClient";
import type {
  Announcement,
  Custodian,
  CustodianStats,
  DashboardStats,
  DashboardUser,
  Department,
  DepartmentStats,
  ActivityEvent,
  InventoryItem,
  InventoryItemDetail,
  ItemCategory,
  ItemStatusRef,
  MemorandumReceipt,
  MemorandumReceiptDetail,
  MrStatusFilter,
  Paginated,
  RepairItem,
  RepairItemCounts,
  RepairStatusRef,
  RequestStatusFilter,
  RequestStatusRef,
  RequestType,
  Role,
  TechnicalRequest,
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

export interface InventoryItemListParams {
  search?: string;
  categoryId?: number;
  statusId?: number;
  departmentId?: number;
  sortBy?: InventorySortBy;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

export const inventoryItemsApi = {
  list: (params: InventoryItemListParams = {}) =>
    api.get<Paginated<InventoryItem>>(`/inventory-items${buildQuery(params)}`),
  get: (id: number) => api.get<{ data: InventoryItemDetail }>(`/inventory-items/${id}`),
  create: (body: {
    categoryId: number;
    brand?: string;
    model?: string;
    serialNumber: string;
    departmentId?: number;
    statusId?: number;
    description?: string;
  }) => api.post<{ data: InventoryItem }>("/inventory-items", body),
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
    }>,
  ) => api.patch<{ data: InventoryItem }>(`/inventory-items/${id}`, body),
  remove: (id: number) => api.delete<{ ok: true }>(`/inventory-items/${id}`),
};

export type MrSortBy = "issuedAt" | "status" | "mrNumber";

export interface MrListParams {
  status?: MrStatusFilter;
  custodianId?: number;
  departmentId?: number;
  overdue?: boolean;
  search?: string;
  sortBy?: MrSortBy;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

export const mrApi = {
  list: (params: MrListParams = {}) => api.get<Paginated<MemorandumReceipt>>(`/mr${buildQuery(params)}`),
  get: (id: number) => api.get<{ data: MemorandumReceiptDetail }>(`/mr/${id}`),
  nextNumber: () => api.get<{ data: { mrNumber: string } }>("/mr/next-number"),
  issue: (body: {
    mrNumber: string;
    custodianId: number;
    departmentId?: number;
    itemIds: number[];
    expectedReturnAt?: string;
    notes?: string;
  }) => api.post<{ data: { id: number } }>("/mr", body),
  return: (id: number, notes?: string) => api.post<{ ok: true }>(`/mr/${id}/return`, { notes }),
  transfer: (
    id: number,
    body: {
      mrNumber: string;
      custodianId: number;
      departmentId?: number;
      expectedReturnAt?: string;
      notes?: string;
      /** Subset of the MR's active items to move — omit to transfer all of them. */
      itemIds?: number[];
    },
  ) => api.post<{ data: { id: number; isFullTransfer: boolean } }>(`/mr/${id}/transfer`, body),
};

export type CustodianSortBy = "name" | "employeeNumber" | "department" | "activeItems";

export interface CustodianListParams {
  search?: string;
  departmentId?: number;
  /** Custodians currently sitting on at least one overdue item. */
  overdueOnly?: boolean;
  sortBy?: CustodianSortBy;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

export const custodiansApi = {
  list: (params: CustodianListParams = {}) => api.get<Paginated<Custodian>>(`/custodians${buildQuery(params)}`),
  stats: () => api.get<{ data: CustodianStats }>("/custodians/stats"),
  get: (id: number) => api.get<{ data: Custodian }>(`/custodians/${id}`),
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
