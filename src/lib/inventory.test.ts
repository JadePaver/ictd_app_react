import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountabilityTag, itemDisplayName, officeName } from "./inventory.ts";
import { dateInputToDueIso, dueInfo, dueState, isoToDateInput } from "./mrMetrics.ts";

describe("officeName", () => {
  const cases: [string, string | null, string][] = [
    ["OFFICE OF THE PROVINCIAL ACCOUNTANT", "ACCT", "Office of the Provincial Accountant"],
    ["INFORMATION & COMMUNICATION TECHNOLOGY DIVISION", "ICTD", "Information & Communication Technology Division"],
    ["PHO - NEGROS FIRST PROVINCIAL BLOOD CENTER", "NFBC", "PHO - Negros First Provincial Blood Center"],
    ["PSWDO - NEGROS OCCIDENTAL WOMEN & CHILDREN CENTER", "NOWC", "PSWDO - Negros Occidental Women & Children Center"],
    ["PEO-CONSTRUCTION AND MAINTENANCE", "PEOC", "PEO-Construction and Maintenance"],
    ["OPA - ON-FARM MECHANIZATION", "OPA2", "OPA - On-Farm Mechanization"],
    ["PHO - GOV. VALERIANO M. GATUSLAO HOSPITAL", "VGAT", "PHO - Gov. Valeriano M. Gatuslao Hospital"],
    ["ASSISTANCE TO INDIVIDUAL'S IN CRISIS SITUATION (AICS)", "AICS", "Assistance to Individual's in Crisis Situation (AICS)"],
    ["PROVINCIAL LAND USE COMMITTEE", "PPDO3", "Provincial Land Use Committee"],
    ["PVO - OPERATION OF NEGROS FIRST RANCH/FARMS", "VET1", "PVO - Operation of Negros First Ranch/Farms"],
    ["PHO - PROVINCIAL  NUTRITION  ACTION  PLANS", "PNAP", "PHO - Provincial Nutrition Action Plans"],
    ["Accounting Office", null, "Accounting Office"],
  ];
  for (const [label, code, expected] of cases) {
    it(label, () => assert.equal(officeName({ label, code }), expected));
  }
  it("falls back when there is no label", () => assert.equal(officeName(null), "No office"));
});

describe("itemDisplayName", () => {
  it("prefers brand and model", () => assert.equal(itemDisplayName({ brand: "Dell", model: "P2422H" }), "Dell P2422H"));
  it("falls back to the category, then Item", () => {
    assert.equal(itemDisplayName({ brand: null, model: "", item_categories: { label: "Keyboard" } }), "Keyboard");
    assert.equal(itemDisplayName({}), "Item");
  });
});

describe("accountabilityTag", () => {
  it("overdue wins over on loan", () =>
    assert.deepEqual(accountabilityTag({ activeItemCount: 3, overdueItemCount: 1 }), { label: "1 OVERDUE", tone: "critical" }));
  it("on loan", () => assert.deepEqual(accountabilityTag({ activeItemCount: 2 }), { label: "2 ON LOAN", tone: "accent" }));
  it("clear", () => assert.deepEqual(accountabilityTag({}), { label: "CLEAR", tone: "neutral" }));
});

describe("due dates", () => {
  const now = Date.parse("2026-09-27T06:00:00Z");
  const at = (days: number) => new Date(now + days * 86_400_000).toISOString();

  it("closed MRs are never late", () =>
    assert.equal(dueState({ status: "returned", expected_return_at: at(-5) }, now), "closed"));
  it("overdue reads in whole days late", () =>
    assert.deepEqual(dueInfo({ status: "active", expected_return_at: at(-12.5) }, now), {
      state: "overdue",
      tone: "critical",
      label: "Overdue",
      detail: "12 days late",
    }));
  it("due soon inside three days", () => assert.equal(dueState({ status: "active", expected_return_at: at(2) }, now), "dueSoon"));
  it("no due date is never late", () => assert.equal(dueState({ status: "active", expected_return_at: null }, now), "noDueDate"));

  it("a picked day becomes the end of that local day, and reads back as the same day", () => {
    const iso = dateInputToDueIso("2026-10-30")!;
    const local = new Date(iso);
    assert.equal([local.getFullYear(), local.getMonth() + 1, local.getDate(), local.getHours()].join("-"), "2026-10-30-23");
    assert.equal(isoToDateInput(iso), "2026-10-30");
  });
  it("rejects anything that isn't a calendar day", () => assert.equal(dateInputToDueIso("30/10/2026"), undefined));
});
