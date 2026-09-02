import type { Custodian } from "../types/api";

/**
 * The text a scanner reads off a custodian's ID badge — mirrors
 * inventoryQrPayload's shape (plain human-readable lines) so both this
 * app's printed artifacts read the same way when scanned: identity fields
 * only, no live accountability data (item counts change constantly; the
 * badge doesn't).
 */
export function custodianQrPayload(custodian: Custodian): string {
  const name = [custodian.first_name, custodian.middle_name, custodian.last_name].filter(Boolean).join(" ");
  const lines = [
    `ICTD CUSTODIAN #${custodian.id}`,
    `Name: ${name || "Unknown"}`,
    custodian.employee_number ? `Employee #: ${custodian.employee_number}` : null,
    custodian.departments?.label ? `Department: ${custodian.departments.label}` : null,
    custodian.contact_number ? `Contact: ${custodian.contact_number}` : null,
    custodian.email ? `Email: ${custodian.email}` : null,
  ];
  return lines.filter((line): line is string => line != null).join("\n");
}
