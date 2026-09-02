/** Mirrors ictd_app_express/src/config/constants.ts */
export const ROLE = {
  CLIENT: 1,
  OPERATOR: 2,
} as const;

export const REQUEST_STATUS = {
  PENDING: 1,
  ACCEPTED: 2,
  COMPLETED: 3,
  DENIED: 4,
} as const;

export const REPAIR_STATUS = {
  RECEIVED: 1,
  READY_FOR_RELEASE: 8,
  RELEASED: 9,
} as const;

export const REPAIR_DONE_STATUS_IDS = [8, 9, 10, 11];
