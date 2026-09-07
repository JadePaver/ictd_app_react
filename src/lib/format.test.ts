import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toCsv, slugify } from "./csv.ts";
import { formatDays, formatHours } from "./format.ts";

describe("formatHours", () => {
  it("reports sub-hour durations in minutes rather than as 0.0 hrs", () => {
    // The old behaviour rounded a two-minute reply to "0.0 hrs", which reads
    // as no data rather than as good news.
    assert.equal(formatHours(0.033), "2 min");
    assert.equal(formatHours(0.7), "42 min");
    assert.equal(formatHours(0.99), "59 min");
  });

  it("never claims zero minutes for a real duration", () => {
    assert.equal(formatHours(0.001), "<1 min");
    assert.equal(formatHours(0), "<1 min");
  });

  it("rounds a near-hour up into hours rather than saying 60 min", () => {
    assert.equal(formatHours(0.999), "1.0 hrs");
  });

  it("uses hours in the middle band and days past two", () => {
    assert.equal(formatHours(1), "1.0 hrs");
    assert.equal(formatHours(26.8), "26.8 hrs");
    assert.equal(formatHours(47.9), "47.9 hrs");
    assert.equal(formatHours(48), "2.0 days");
    assert.equal(formatHours(216), "9.0 days");
  });

  it("renders a missing figure as an em dash, not as zero", () => {
    assert.equal(formatHours(null), "—");
    assert.equal(formatHours(undefined), "—");
  });
});

describe("formatDays", () => {
  it("drops to the hours scale below a day", () => {
    assert.equal(formatDays(0.4), "9.6 hrs");
    assert.equal(formatDays(0.02), "29 min");
  });

  it("stays in days at or above one", () => {
    assert.equal(formatDays(1), "1.0 days");
    assert.equal(formatDays(4.2), "4.2 days");
  });

  it("renders a missing figure as an em dash", () => {
    assert.equal(formatDays(null), "—");
  });
});

describe("toCsv", () => {
  it("quotes every field and doubles embedded quotes", () => {
    assert.equal(toCsv([["a", 'say "hi"']]), '"a","say ""hi"""');
  });

  it("separates rows with CRLF, which is what Excel on Windows expects", () => {
    assert.equal(toCsv([["a"], ["b"]]), '"a"\r\n"b"');
  });

  it("writes an empty field for null and undefined", () => {
    assert.equal(toCsv([[null, undefined, ""]]), '"","",""');
  });

  it("neutralises text a spreadsheet would run as a formula", () => {
    // Quoting alone does not stop this: the quotes are stripped before the
    // spreadsheet decides whether the value is a formula.
    for (const trigger of ["=1+1", "+1", "-1+1", "@SUM(A1)", "=HYPERLINK(\"http://x\")"]) {
      const out = toCsv([[trigger]]);
      assert.ok(out.startsWith("\"'"), `${trigger} should be forced to text, got ${out}`);
    }
  });

  it("leaves ordinary text alone", () => {
    assert.equal(toCsv([["Hardware"]]), '"Hardware"');
    assert.equal(toCsv([["Jade Paver"]]), '"Jade Paver"');
  });

  it("does not turn a negative number into text", () => {
    // Deltas reach the sheet as numbers; prefixing them would stop them
    // being numbers in the spreadsheet.
    assert.equal(toCsv([[-3]]), '"-3"');
    assert.equal(toCsv([[0]]), '"0"');
  });
});

describe("slugify", () => {
  it("builds a filesystem-safe name", () => {
    assert.equal(slugify("Jade Paver"), "jade-paver");
    assert.equal(slugify("August 2026"), "august-2026");
    assert.equal(slugify("Ramón  O'Neill"), "ramon-oneill");
  });

  it("falls back rather than producing an empty name", () => {
    assert.equal(slugify("///"), "report");
    assert.equal(slugify(""), "report");
  });
});
