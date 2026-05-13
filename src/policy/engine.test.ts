import { describe, expect, it } from "vitest";
import { isGrantAllowed } from "./engine";
import type { Grant, ResourceRef } from "./types";

const grant: Grant = {
  id: "grant_1",
  keyId: "fgk_123",
  capability: "d1.database.write",
  resourceType: "d1_database",
  resourceId: "db_1",
  constraints: {}
};

describe("isGrantAllowed", () => {
  it("allows matching capability and resource", () => {
    const resource: ResourceRef = { type: "d1_database", id: "db_1" };
    expect(isGrantAllowed(grant, "d1.database.write", [resource])).toBe(true);
  });

  it("denies mismatched resources", () => {
    const resource: ResourceRef = { type: "d1_database", id: "db_2" };
    expect(isGrantAllowed(grant, "d1.database.write", [resource])).toBe(false);
  });

  it("denies mismatched capabilities", () => {
    const resource: ResourceRef = { type: "d1_database", id: "db_1" };
    expect(isGrantAllowed(grant, "d1.database.read", [resource])).toBe(false);
  });
});
