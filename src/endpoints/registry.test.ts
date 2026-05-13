import { describe, expect, it } from "vitest";
import { matchEndpoint } from "./registry";

describe("matchEndpoint", () => {
  it("matches D1 query and extracts database resource", () => {
    const match = matchEndpoint("POST", "/client/v4/accounts/acct_1/d1/database/db_1/query");
    expect(match?.definition.id).toBe("d1.query");
    expect(match?.resources).toEqual([
      { type: "account", id: "acct_1" },
      { type: "d1_database", id: "db_1" }
    ]);
  });

  it("does not match unsupported list endpoints", () => {
    expect(matchEndpoint("GET", "/client/v4/accounts/acct_1/d1/database")).toBeNull();
  });
});
