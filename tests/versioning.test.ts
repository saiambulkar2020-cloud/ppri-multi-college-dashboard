import { describe, expect, it } from "vitest";
import { activateVersion } from "../lib/versioning";

describe("dataset version activation", () => {
  it("activates the ready target and deactivates the current version", () => {
    const result = activateVersion([{ id: "old", collegeId: "A", active: true, status: "ready", recordCount: 40 }, { id: "new", collegeId: "A", active: false, status: "ready", recordCount: 42 }, { id: "other", collegeId: "B", active: true, status: "ready", recordCount: 25 }], "A", "new");
    expect(result.find((item) => item.id === "old")?.active).toBe(false);
    expect(result.find((item) => item.id === "new")?.active).toBe(true);
    expect(result.find((item) => item.id === "other")?.active).toBe(true);
  });
  it("rejects failed or empty versions", () => expect(() => activateVersion([{ id: "bad", collegeId: "A", active: false, status: "failed", recordCount: 0 }], "A", "bad")).toThrow());
  it("rejects a version from another college", () => expect(() => activateVersion([{ id: "other", collegeId: "B", active: false, status: "ready", recordCount: 40 }], "A", "other")).toThrow());
});
