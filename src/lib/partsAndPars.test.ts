import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeFromParts, formatPeso, groupCategories, partBlockReason, registerStatusOptions, splitSerials } from "./inventory.ts";
import { partAtIssueLabel } from "./mrMetrics.ts";
import type { InventoryItem } from "../types/api";

const cat = (code: string, label: string, is_part = false) => ({ id: code.length, code, label, is_part });

function part(overrides: Partial<InventoryItem> & { status?: string; category?: string }): InventoryItem {
  const { status = "in_storage", category = "gpu", ...rest } = overrides;
  return {
    id: 216,
    brand: "MSI",
    model: "GeForce RTX 3060 Ventus 2X",
    serial_number: "602-V397-8KSB2211",
    item_categories: { id: 1, code: category, label: category.toUpperCase(), is_part: category !== "monitor" },
    item_statuses: { id: 1, code: status, label: status === "under_repair" ? "Under repair" : "In storage", color: null },
    installed_in_item_id: null,
    currentCustody: null,
    ...rest,
  } as InventoryItem;
}

describe("splitSerials", () => {
  it("keeps line order, trims, and drops blanks", () => {
    assert.deepEqual(splitSerials("  A1 \n\nB2\r\n  \nC3"), ["A1", "B2", "C3"]);
  });
  it("accepts a spreadsheet column or a comma list", () => {
    assert.deepEqual(splitSerials("A1\tB2,C3"), ["A1", "B2", "C3"]);
  });
  it("keeps repeats so the form can point at them", () => {
    assert.deepEqual(splitSerials("A1\na1\nA1"), ["A1", "a1", "A1"]);
  });
});

describe("groupCategories", () => {
  it("puts units first and parts in CPU, GPU, RAM, Storage order", () => {
    const { units, parts } = groupCategories([
      cat("storage", "Storage", true),
      cat("printer", "Printer"),
      cat("ram", "RAM", true),
      cat("computer", "Computer"),
      cat("cpu", "CPU", true),
      cat("gpu", "GPU", true),
    ]);
    assert.deepEqual(units.map((c) => c.code), ["computer", "printer"]);
    assert.deepEqual(parts.map((c) => c.code), ["cpu", "gpu", "ram", "storage"]);
  });
});

describe("registerStatusOptions", () => {
  it("never offers In use", () => {
    const codes = registerStatusOptions([{ code: "in_storage" }, { code: "in_use" }, { code: "missing" }]).map((s) => s.code);
    assert.deepEqual(codes, ["in_storage", "missing"]);
  });
});

describe("describeFromParts", () => {
  it("lists CPU, GPU, RAM, storage in that order, by model", () => {
    const text = describeFromParts([
      { brand: "Samsung", model: "980 500GB NVMe", item_categories: cat("storage", "Storage", true) },
      { brand: "Kingston", model: "Fury Beast 16GB DDR4", item_categories: cat("ram", "RAM", true) },
      { brand: "AMD", model: "Ryzen 5 5600", item_categories: cat("cpu", "CPU", true) },
      { brand: "MSI", model: "GeForce RTX 3060", item_categories: cat("gpu", "GPU", true) },
    ]);
    assert.equal(text, "Ryzen 5 5600 / GeForce RTX 3060 / Fury Beast 16GB DDR4 / 980 500GB NVMe");
  });
  it("is empty without parts", () => {
    assert.equal(describeFromParts([]), "");
  });
});

describe("partBlockReason", () => {
  it("lets a loose part in storage through", () => {
    assert.equal(partBlockReason(part({})), null);
  });
  it("names the PC a part is already in", () => {
    const r = partBlockReason(part({ installed_in_item_id: 102 }));
    assert.equal(r?.tag, "In PC #102");
    assert.equal(r?.message, "MSI GeForce RTX 3060 Ventus 2X (#216) is installed in PC #102. Remove it there first.");
  });
  it("says when it's already in this PC", () => {
    assert.equal(partBlockReason(part({ installed_in_item_id: 223 }), 223)?.message, "MSI GeForce RTX 3060 Ventus 2X is already in this PC.");
  });
  it("refuses parts that aren't in storage", () => {
    assert.equal(
      partBlockReason(part({ status: "under_repair" }))?.message,
      "MSI GeForce RTX 3060 Ventus 2X is under repair. Only parts in storage can be installed.",
    );
  });
  it("refuses units", () => {
    assert.equal(partBlockReason(part({ category: "monitor" }))?.tag, "Not a part");
  });
});

describe("formatPeso", () => {
  it("formats numbers and numeric strings with 2 decimals", () => {
    assert.equal(formatPeso(248600), "₱248,600.00");
    assert.equal(formatPeso("248600.5"), "₱248,600.50");
    assert.equal(formatPeso("1,250"), "₱1,250.00");
  });
  it("is null for nothing", () => {
    assert.equal(formatPeso(null), null);
    assert.equal(formatPeso(""), null);
  });
});

describe("partAtIssueLabel", () => {
  it("reads like the printed MR line", () => {
    assert.equal(
      partAtIssueLabel({
        id: 216,
        serial_number: "602-V397-8KSB2211",
        brand: "MSI",
        model: "GeForce RTX 3060 Ventus 2X",
        item_categories: { code: "gpu", label: "GPU" },
      }),
      "GPU · MSI GeForce RTX 3060 Ventus 2X · 602-V397-8KSB2211",
    );
  });
});
