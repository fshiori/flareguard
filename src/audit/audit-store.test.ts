import { describe, expect, it } from "vitest";
import { auditEventParams } from "./audit-store";

describe("auditEventParams", () => {
  it("serializes resources", () => {
    expect(auditEventParams({
      id: "audit_1",
      keyId: "fgk_123",
      endpointId: "d1.query",
      method: "POST",
      path: "/client/v4/accounts/acct_1/d1/database/db_1/query",
      resources: [{ type: "d1_database", id: "db_1" }],
      decision: "allow",
      upstreamStatus: 200
    })).toEqual([
      "audit_1",
      "fgk_123",
      "d1.query",
      "POST",
      "/client/v4/accounts/acct_1/d1/database/db_1/query",
      "[{\"type\":\"d1_database\",\"id\":\"db_1\"}]",
      "allow",
      200
    ]);
  });
});
