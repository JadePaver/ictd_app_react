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
    /** Active MRs due within the next three days. */
    dueSoonMrCount: number;
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
//
// Three vocabularies that must never be blurred (context doc 3.3, 3.5, 3.6):
//  - ItemStatusCode: an item's physical condition (In use, In storage, ...).
//  - MrStatus: a memorandum receipt's lifecycle (active, returned, transferred).
//  - A line's MrStatus: what happened to one item on one MR.

export interface ItemCategory {
  id: number;
  code: string;
  label: string;
  /** CPU, GPU, RAM, Storage: goes inside a computer (context doc v2, 3.3). */
  is_part?: boolean;
  /** Computer: can hold parts. */
  can_host_parts?: boolean;
}

/** A purchase delivery, under the code printed on its paper PAR. */
export interface Par {
  id: number;
  par_code: string;
  /** Calendar day, YYYY-MM-DD. */
  date_received: string;
  reference_no: string | null;
  supplier: string | null;
  /** PAR total in pesos. PostgREST sends numeric as a number or a string. */
  amount: number | string | null;
  received_by: string | null;
  remarks: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
  created_by_user: NamedUserRef | null;
  itemCount?: number;
}

export interface ParDetail extends Par {
  itemCount: number;
  byCategory: { code: string; label: string; count: number }[];
  items: InventoryItem[];
}

/** The short form of a PAR carried on each item. */
export interface ParRef {
  id: number;
  par_code: string;
  supplier: string | null;
  date_received: string;
}

/** Enough to name an item in a chip or a message. */
export interface ItemRef {
  id: number;
  serial_number: string;
  name: string;
}

/** Where an item sits (context doc v2, 5.3). Not a status. */
export type Placement = "all" | "top_level" | "loose" | "installed" | "host";

export type ItemStatusCode = "in_storage" | "in_use" | "under_repair" | "decommissioned" | "missing";

export interface ItemStatusRef {
  id: number;
  code: string;
  label: string;
  color: string | null;
}

export type MrStatus = "active" | "returned" | "transferred";

/** The MR ledger's segments. On track / Due soon / Overdue partition the
 * active MRs; Closed is every returned or transferred one. */
export type MrSegment = "all" | "active" | "onTrack" | "dueSoon" | "overdue" | "closed";

/** Legacy raw-status filter, still accepted by `GET /mr`. */
export type MrStatusFilter = "all" | MrStatus | "closed";

export type ItemAvailability = "all" | "available" | "issued";

/** How a person is doing on what they hold. Computed by the API from active
 * MRs, never stored. */
export interface Accountability {
  activeItemCount: number;
  overdueItemCount: number;
  activeMrCount: number;
  overdueMrCount: number;
  /** Earliest due date across their active MRs. */
  nextDueAt: string | null;
  /** Parts inside the PCs they hold. A PC counts once in activeItemCount. */
  activeInstalledPartCount: number;
}

/** A person who can hold custody of equipment on an MR. Deliberately
 * separate from `users`: most custodians are staff without a dashboard
 * login. */
export interface Custodian extends Partial<Accountability> {
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
}

export interface CustodianHolding {
  lineId: number;
  /** When this item came onto the MR it is on now. */
  since: string;
  overdue: boolean;
  item: {
    id: number;
    brand: string | null;
    model: string | null;
    serial_number: string;
    is_assembled?: boolean;
    item_categories: ItemCategory | null;
    item_statuses: ItemStatusRef | null;
  };
  mr: { id: number; mr_number: string; expected_return_at: string | null };
  /** Parts inside it, when the holding is a PC. */
  partCount: number;
}

export interface CustodianDetail extends Omit<Custodian, keyof Accountability>, Accountability {
  totalMrCount: number;
  holdings: CustodianHolding[];
}

export interface CustodianStats {
  totalCustodians: number;
  activeCustodians: number;
  totalActiveItems: number;
  custodiansWithOverdueItems: number;
  totalOverdueItems: number;
}

/** Narrow custodian shape used wherever only a name is needed. */
export interface CustodianRef {
  id: number;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  employee_number?: string | null;
}

/** Who holds an item right now. Null means it is with ICTD. */
export interface CurrentCustody {
  mrId: number;
  mrNumber: string;
  /** When this unit came onto that MR (for a split, the split). */
  since: string;
  expectedReturnAt: string | null;
  custodian: CustodianRef | null;
  /** Set when this is an installed part: the custody is its PC's. */
  via: ItemRef | null;
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
  par_id: number | null;
  /** True for computers built by ICTD with Assemble PC; their serial is the asset tag. */
  is_assembled: boolean;
  /** The PC this part is inside right now. */
  installed_in_item_id: number | null;
  par: ParRef | null;
  /** Present on list and detail responses. */
  currentCustody?: CurrentCustody | null;
  /** Parts installed in it right now (hosts only). */
  partCount?: number;
  /** The PC it is inside, when installed. */
  installedIn?: ItemRef | null;
}

export interface InventorySummary {
  /** Items matching every active filter. */
  total: number;
  /** Of those, how many are on an active MR. */
  issued: number;
  /** Status facet: honours every filter except status. */
  byStatus: (ItemStatusRef & { count: number })[];
  /** Category facet: honours every filter except category. */
  byCategory: (ItemCategory & { count: number })[];
  /** Unfiltered: feeds the standing missing-items banner. */
  missing: { count: number; serials: string[] };
  /** Items registered before PARs, waiting for Assign PAR. */
  withoutPar: number;
}

export interface MrCustodyHistoryEntry {
  /** A line id, or "via-{installation}-{line}" for custody through a PC. */
  id: number | string;
  status: MrStatus;
  created_at: string;
  updated_at: string | null;
  memorandum_receipts: {
    id: number;
    mr_number: string;
    status: MrStatus;
    issued_at: string;
    returned_at: string | null;
    expected_return_at: string | null;
    transferred_from_id: number | null;
    superseded_by: number | null;
    custodian: CustodianRef | null;
    issued_by_user: NamedUserRef | null;
    returned_by_user: NamedUserRef | null;
  } | null;
  /** Set when the custody came through the PC this part was inside. */
  via: ItemRef | null;
  /** For custody through a PC: what closed the window. "removed" means the
   * part was taken out of the PC; "mr" means the PC's MR closed. */
  endedBy: "mr" | "removed" | null;
}

/** One part-in-PC record, seen from the item's side. */
export interface InstallationEntry {
  id: number;
  /** "part": this item went into `other`. "host": `other` went into this item. */
  role: "part" | "host";
  part_item_id: number;
  host_item_id: number;
  installed_at: string;
  removed_at: string | null;
  notes: string | null;
  installed_by_user: NamedUserRef | null;
  removed_by_user: NamedUserRef | null;
  status_after: { code: string; label: string } | null;
  other: (ItemRef & { category: { code: string; label: string } | null }) | null;
}

export interface InventoryItemDetail extends InventoryItem {
  currentCustody: CurrentCustody | null;
  /** Every MR line this item has had, and its custody through PCs, newest first. */
  custodyHistory: MrCustodyHistoryEntry[];
  /** Install and removal records, as part and as PC, newest first. */
  installations: InstallationEntry[];
  /** Parts inside it now (PCs only). */
  parts: InventoryItem[];
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
    department_id: number | null;
    is_assembled?: boolean;
    item_categories: ItemCategory | null;
    item_statuses: ItemStatusRef | null;
  } | null;
  /** MR detail only: for a PC line, the parts inside it when this MR took it. */
  partsAtIssue?: { id: number; serial_number: string; brand: string | null; model: string | null; item_categories: { code: string; label: string } | null }[];
  /** Parts went in or came out while the PC was on this MR. */
  partsChangedSinceIssue?: boolean;
  partsChangedAt?: string | null;
  /** Parts inside the PC right now; they go wherever it goes. */
  partsNow?: number;
}

export interface MrCustodian extends CustodianRef {
  employee_number: string | null;
  contact_number: string | null;
  email: string | null;
  department_id: number | null;
  departments: Department | null;
}

export interface MemorandumReceipt {
  id: number;
  mr_number: string;
  custodian_id: number;
  /** The office this MR is filed under (not the custodian's, not the item's). */
  department_id: number | null;
  issued_by: number;
  issued_at: string;
  status: MrStatus;
  returned_at: string | null;
  returned_by: number | null;
  superseded_by: number | null;
  /** The MR this one was transferred out of, for full transfers and splits. */
  transferred_from_id: number | null;
  notes: string | null;
  /** Written at return time; never overwrites `notes`. */
  return_notes: string | null;
  /** Null means the MR can never be due soon or overdue. */
  expected_return_at: string | null;
  created_at: string;
  updated_at: string | null;
  custodian: MrCustodian | null;
  departments: Department | null;
  issued_by_user: NamedUserRef | null;
  returned_by_user: NamedUserRef | null;
  /** List responses only: every item the MR listed, and how many are still out. */
  itemCount?: number;
  activeItemCount?: number;
}

export interface MrLineageLink {
  id: number;
  mr_number: string;
  /** "transfer": the whole MR moved (superseded_by). "split": some items did. */
  kind: "transfer" | "split";
}

export interface MrSuccessor extends MrLineageLink {
  status: MrStatus;
  issued_at: string;
  custodian: CustodianRef | null;
  /** The items that moved onto it. */
  itemIds: number[];
}

export interface MemorandumReceiptDetail extends MemorandumReceipt {
  items: MrItemEntry[];
  /** Where this MR came from, if it was born from a transfer. */
  precededBy: MrLineageLink | null;
  /** MRs later transferred out of this one, oldest first. */
  successors: MrSuccessor[];
}

export interface MrSummary {
  all: number;
  active: number;
  onTrack: number;
  dueSoon: number;
  overdue: number;
  closed: number;
  itemsOut: number;
  overdueItems: number;
}

// ---- Technician performance reports ----

export type ReportPeriodKey = "month" | "year" | "all";

/** One row of the report page's technician picker. */
export interface TechnicianRosterEntry {
  id: number;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  /** Display name, already falling back to username / "User #id" server-side. */
  name: string;
  username: string | null;
  joinedAt: string;
  roleLabel: string | null;
  departments: Department[];
  /** False for someone who has attributable work but no current operator role. */
  isOperator: boolean;
  /** All-time action count, so the picker can say how much there is to look at. */
  totalActions: number;
}

/**
 * Every countable thing one technician did inside one period.
 *
 * `totalActions` is the sum of three attributed streams: request status
 * updates, repair log entries, and announcements published. Inventory and
 * custody bookkeeping is deliberately out of scope (see `SUMMARY_SOURCES`
 * on the API side). `repairsReceived` and `repairsReleased` are views *into*
 * `repairUpdates`, not additions to it, since booking an item in also writes
 * a repair log.
 */
export interface TechnicianSummary {
  totalActions: number;
  activeDays: number;
  busiestDay: { date: string; count: number } | null;

  requestUpdates: number;
  requestsHandled: number;
  requestsAccepted: number;
  requestsCompleted: number;
  requestsDenied: number;
  firstResponses: number;
  avgFirstResponseHours: number | null;
  /** Request raised to this technician's completion of it: the time-per-task figure. */
  avgResolutionHours: number | null;
  slowestResolutionHours: number | null;
  fastestResolutionHours: number | null;

  repairUpdates: number;
  repairItemsTouched: number;
  repairsReceived: number;
  repairsReleased: number;
  avgRepairTurnaroundDays: number | null;

  announcementsPosted: number;
}

export interface TechnicianTrendPoint {
  /** "2026-09-14" (daily) or "2026-09" (monthly). */
  key: string;
  /** Axis label: "14", "Sep", or "Sep 25" when the span crosses years. */
  label: string;
  requests: number;
  repairs: number;
  announcements: number;
  total: number;
}

/** Per request type: how many they touched, how many they closed, how long it took. */
export interface RequestTypeBreakdown {
  typeId: number | null;
  label: string;
  handled: number;
  completed: number;
  denied: number;
  avgResolutionHours: number | null;
}

/** Per repair stage: log entries written, and distinct items that reached it. */
export interface RepairStageBreakdown {
  statusId: number;
  label: string;
  color: string;
  updates: number;
  items: number;
}

/** What actually happened in one recorded action, so the sheet can pick an icon. */
export type ReportOutcome =
  | "accepted"
  | "completed"
  | "denied"
  | "updated"
  | "received"
  | "released"
  | "published";

export interface TechnicianReportHighlight {
  kind: "request" | "repair" | "announcement";
  title: string;
  subtitle: string;
  outcome: ReportOutcome;
  at: string;
  /** Hours from the request being raised to this action, where meaningful. */
  elapsedHours: number | null;
}

export interface TechnicianRanking {
  /** 1-based, competition-ranked (equal totals share a rank). */
  rank: number;
  peerCount: number;
  percentile: number;
  teamTotal: number;
  teamAverage: number;
  leaderTotal: number;
}

export interface TechnicianReport {
  technician: {
    id: number;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    name: string;
    username: string | null;
    joinedAt: string;
    roleLabel: string | null;
    departments: Department[];
  };
  period: {
    key: ReportPeriodKey;
    label: string;
    /** Null only on the all-time report. */
    from: string | null;
    to: string | null;
    granularity: "day" | "month";
    previousLabel: string | null;
  };
  summary: TechnicianSummary;
  /** The same period one step back. Null on the all-time report. */
  previous: TechnicianSummary | null;
  trend: TechnicianTrendPoint[];
  breakdowns: {
    workMix: { key: string; label: string; count: number }[];
    requestTypes: RequestTypeBreakdown[];
    /** The same per-type figures one period back, for the type table's comparison column. */
    previousRequestTypes: RequestTypeBreakdown[] | null;
    requestsByDepartment: { label: string; count: number }[];
    /** In pipeline order (by status id), not by volume: a repair flow reads as a sequence. */
    repairStages: RepairStageBreakdown[];
  };
  /** Null when nobody on the team logged anything in the period. */
  ranking: TechnicianRanking | null;
  highlights: TechnicianReportHighlight[];
  generatedAt: string;
}
