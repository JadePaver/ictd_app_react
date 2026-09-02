export interface DashboardUser {
  authId: string;
  email: string;
  publicUserId: number;
  roleId: number | null;
  firstName: string | null;
  lastName: string | null;
}

export interface RequestType {
  id: number;
  label: string | null;
}

export interface Department {
  id: number;
  label: string | null;
  code: string | null;
}

export interface DepartmentStats {
  id: number;
  employeeCount: number;
  inventoryItemCount: number;
  custodianCount: number;
  activeMrCount: number;
}

export interface RepairStatusRef {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
}

export interface RequestStatusRef {
  id: number;
  code: string | null;
  label: string | null;
}

export interface Role {
  id: number;
  code: string | null;
  label: string | null;
}

export interface NamedUserRef {
  first_name: string | null;
  last_name: string | null;
  auth_id?: string | null;
  username?: string | null;
}

export interface TechnicalRequestActivity {
  id: number;
  status_id: number | null;
  set_by: number | null;
  set_at: string | null;
  message: string | null;
  created_at: string;
  updated_at: string | null;
  technical_request_id: number;
  request_statuses: { label: string | null; code: string | null } | null;
  set_by_user: { first_name: string | null; last_name: string | null } | null;
}

export interface TechnicalRequest {
  id: number;
  request_type_id: number | null;
  description: string | null;
  look_for: string | null;
  url: string | null;
  department_location_id: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
  responded_by: number | null;
  cancelled_by: number | null;
  request_types: RequestType | null;
  departments: Department | null;
  created_by_user: NamedUserRef | null;
  responded_by_user: NamedUserRef | null;
  cancelled_by_user: NamedUserRef | null;
  technical_request_activity: TechnicalRequestActivity[];
  latestStatusId: number | null;
}

export type RequestStatusFilter = "all" | "pending" | "accepted" | "completed" | "denied";

export interface RepairLog {
  id: number;
  repair_item_id: number;
  repair_status_id: number;
  logged_by: number;
  log_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  logged_by_user: { id: number; first_name: string | null; middle_name: string | null; last_name: string | null } | null;
  repair_statuses: { id: number; name: string; color: string | null } | null;
}

export interface RepairItemCounts {
  all: number;
  active: number;
  done: number;
  /** `received_at` of the longest-waiting active item, or null if none. */
  oldestActiveReceivedAt: string | null;
}

export interface RepairItem {
  id: number;
  item_name: string;
  description: string | null;
  owner: string | null;
  owner_user_id: number | null;
  owner_contact: string | null;
  condition_on_receive: string | null;
  condition_on_release: string | null;
  status_id: number | null;
  received_at: string | null;
  received_by: number | null;
  released_at: string | null;
  serial_number: string | null;
  created_at: string;
  updated_at: string | null;
  owner_user: { id: number; user_id: string; auth_id: string | null; first_name: string | null; middle_name: string | null; last_name: string | null } | null;
  received_by_user: { id: number; first_name: string | null; middle_name: string | null; last_name: string | null } | null;
  repair_statuses: RepairStatusRef | null;
  logs?: RepairLog[];
}

export interface Announcement {
  id: number;
  title: string | null;
  content: string | null;
  created_by: number | null;
  broadcast_all: boolean | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string | null;
  users: { first_name: string | null; last_name: string | null } | null;
  departmentLabels: string[];
  departments?: Department[];
}

export interface UserDirectoryEntry {
  id: number;
  username: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  created_at: string;
  user_roles: { role_id: number; roles: Role | null }[] | null;
  employee_assigned_offices: { department_id: number; departments: Department | null }[] | null;
}

export interface DashboardStats {
  days: number;
  technicalRequests: {
    total: number;
    byStatus: { statusId: number; label: string; count: number }[];
    byDepartment: { label: string; count: number }[];
    trend: { date: string; count: number }[];
    /** Average hours between a request's creation and its first non-pending activity. Null if no requests have been responded to yet. */
    avgResponseHours: number | null;
  };
  repairItems: {
    total: number;
    active: number;
    done: number;
    byStatus: { statusId: number; label: string; color: string; count: number }[];
    trend: { date: string; count: number }[];
    byOwnerDepartment: { label: string; count: number }[];
    /** Average days between received_at and released_at. Null if no items have been released yet. */
    avgTurnaroundDays: number | null;
  };
  announcements: {
    total: number;
    broadcastCount: number;
    targetedCount: number;
    trend: { date: string; count: number }[];
  };
  users: {
    total: number;
    operators: number;
    clients: number;
    unassigned: number;
  };
  departments: {
    total: number;
  };
  inventory: {
    total: number;
    byStatus: { statusId: number; label: string; color: string; count: number }[];
    byCategory: { label: string; count: number }[];
    /** Currently-open MRs (status "active"), all-time — not scoped to `days`. */
    activeMrCount: number;
    /** Active MRs whose expected_return_at has passed. Always 0 if no MR has one set. */
    overdueMrCount: number;
  };
}

export interface WorkloadEntry {
  userId: number;
  name: string;
  requestsHandled: number;
  repairsHandled: number;
  total: number;
}

export interface ActivityEvent {
  kind: "technical_request" | "repair_item" | "announcement";
  id: number;
  title: string | null;
  subtitle?: string;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- Computer & Computer Parts Tracking (inventory + MR) ----

export interface ItemCategory {
  id: number;
  code: string;
  label: string;
}

export interface ItemStatusRef {
  id: number;
  code: string;
  label: string;
  color: string | null;
}

export type MrStatus = "active" | "returned" | "transferred";
/** "closed" is a UI/query-level grouping ("returned or transferred"), never
 * a real `status` column value on an MR row. */
export type MrStatusFilter = "all" | MrStatus | "closed";

/** A person who can hold custody of equipment on an MR. Deliberately
 * separate from `users` — most custodians are staff without a dashboard
 * login (see the 20260711130000 migration's header comment for why). */
export interface Custodian {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  employee_number: string | null;
  department_id: number | null;
  contact_number: string | null;
  email: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
  departments: Department | null;
  /** How many items are currently out under this custodian's active MRs,
   * and how many of those are overdue for return. Only populated by the
   * list endpoint (CustodiansPage) — undefined wherever a bare `Custodian`
   * comes from a context that doesn't compute it (CustodianPicker's search
   * results, an MR's embedded custodian). */
  activeItemCount?: number;
  overdueItemCount?: number;
}

export interface CustodianStats {
  totalCustodians: number;
  activeCustodians: number;
  totalActiveItems: number;
  custodiansWithOverdueItems: number;
  totalOverdueItems: number;
}

/** Narrow custodian shape returned wherever an MR only needs to display who
 * held an item, not their full record (item custody history, MR list rows). */
export interface CustodianRef {
  id: number;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
}

export interface InventoryItem {
  id: number;
  category_id: number;
  brand: string | null;
  model: string | null;
  serial_number: string;
  department_id: number | null;
  status_id: number;
  description: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
  item_categories: ItemCategory | null;
  item_statuses: ItemStatusRef | null;
  departments: Department | null;
  created_by_user: NamedUserRef | null;
}

export interface MrCustodyHistoryEntry {
  id: number;
  status: MrStatus;
  created_at: string;
  updated_at: string | null;
  memorandum_receipts: {
    id: number;
    mr_number: string;
    status: MrStatus;
    issued_at: string;
    returned_at: string | null;
    custodian: CustodianRef | null;
    issued_by_user: NamedUserRef | null;
    returned_by_user: NamedUserRef | null;
  } | null;
}

export interface InventoryItemDetail extends InventoryItem {
  custodyHistory: MrCustodyHistoryEntry[];
}

export interface MrItemEntry {
  id: number;
  mr_id: number;
  item_id: number;
  status: MrStatus;
  created_at: string;
  updated_at: string | null;
  inventory_items: {
    id: number;
    brand: string | null;
    model: string | null;
    serial_number: string;
    item_categories: ItemCategory | null;
  } | null;
}

export interface MemorandumReceipt {
  id: number;
  mr_number: string;
  custodian_id: number;
  department_id: number | null;
  issued_by: number;
  issued_at: string;
  status: MrStatus;
  returned_at: string | null;
  returned_by: number | null;
  superseded_by: number | null;
  notes: string | null;
  /** Nullable — MRs have no due date unless the operator sets one when issuing/transferring. */
  expected_return_at: string | null;
  created_at: string;
  updated_at: string | null;
  custodian: (CustodianRef & { employee_number: string | null; contact_number: string | null; email: string | null }) | null;
  departments: Department | null;
  issued_by_user: NamedUserRef | null;
  returned_by_user: NamedUserRef | null;
}

export interface MemorandumReceiptDetail extends MemorandumReceipt {
  items: MrItemEntry[];
  /** The MR that closed out *into* this one via a full transfer, if any —
   * the mirror image of `superseded_by` (which lives on the *old* MR).
   * Null for a fresh issue, or for the *origin* side of a partial transfer
   * (which stays active and was never "superseded"). */
  precededBy: { id: number; mr_number: string } | null;
}
