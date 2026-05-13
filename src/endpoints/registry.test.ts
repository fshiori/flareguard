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

  it("matches KV key write and extracts namespace", () => {
    const match = matchEndpoint("PUT", "/client/v4/accounts/acct_1/storage/kv/namespaces/ns_1/values/key-a");
    expect(match?.definition.id).toBe("kv.key.put");
    expect(match?.resources).toContainEqual({ type: "kv_namespace", id: "ns_1" });
  });

  it("matches Workers script update and extracts script name", () => {
    const match = matchEndpoint("PUT", "/client/v4/accounts/acct_1/workers/scripts/script-a");
    expect(match?.definition.id).toBe("workers.script.put");
    expect(match?.resources).toContainEqual({ type: "workers_script", id: "script-a" });
  });

  it("matches account read", () => {
    const match = matchEndpoint("GET", "/client/v4/accounts/acct_1");
    expect(match?.definition.id).toBe("account.get");
    expect(match?.resources).toEqual([{ type: "account", id: "acct_1" }]);
  });
});
