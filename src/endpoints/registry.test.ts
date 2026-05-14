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

  it("matches Workers service read with client v4 prefix and extracts script name", () => {
    const match = matchEndpoint("GET", "/client/v4/accounts/acct_1/workers/services/script-a");
    expect(match?.definition.id).toBe("workers.service.get");
    expect(match?.definition.requiredCapability).toBe("workers.service.read");
    expect(match?.resources).toEqual([
      { type: "account", id: "acct_1" },
      { type: "workers_script", id: "script-a" }
    ]);
    expect(match?.upstreamPath).toBe("/client/v4/accounts/acct_1/workers/services/script-a");
  });

  it("matches Workers service read without client v4 prefix and maps upstream path", () => {
    const match = matchEndpoint("GET", "/accounts/acct_1/workers/services/script-a");
    expect(match?.definition.id).toBe("workers.service.get.raw");
    expect(match?.definition.requiredCapability).toBe("workers.service.read");
    expect(match?.resources).toEqual([
      { type: "account", id: "acct_1" },
      { type: "workers_script", id: "script-a" }
    ]);
    expect(match?.upstreamPath).toBe("/client/v4/accounts/acct_1/workers/services/script-a");
  });

  it("matches Workers script deployments read with client v4 prefix and extracts script name", () => {
    const match = matchEndpoint("GET", "/client/v4/accounts/acct_1/workers/scripts/script-a/deployments");
    expect(match?.definition.id).toBe("workers.script.deployments.list");
    expect(match?.definition.requiredCapability).toBe("workers.script.deployments.read");
    expect(match?.resources).toEqual([
      { type: "account", id: "acct_1" },
      { type: "workers_script", id: "script-a" }
    ]);
    expect(match?.upstreamPath).toBe("/client/v4/accounts/acct_1/workers/scripts/script-a/deployments");
  });

  it("matches Workers script deployments read without client v4 prefix and maps upstream path", () => {
    const match = matchEndpoint("GET", "/accounts/acct_1/workers/scripts/script-a/deployments");
    expect(match?.definition.id).toBe("workers.script.deployments.list.raw");
    expect(match?.definition.requiredCapability).toBe("workers.script.deployments.read");
    expect(match?.resources).toEqual([
      { type: "account", id: "acct_1" },
      { type: "workers_script", id: "script-a" }
    ]);
    expect(match?.upstreamPath).toBe("/client/v4/accounts/acct_1/workers/scripts/script-a/deployments");
  });

  it("matches account read", () => {
    const match = matchEndpoint("GET", "/client/v4/accounts/acct_1");
    expect(match?.definition.id).toBe("account.get");
    expect(match?.resources).toEqual([{ type: "account", id: "acct_1" }]);
  });

  it("matches R2 temporary credentials", () => {
    const match = matchEndpoint("POST", "/client/v4/accounts/acct_1/r2/temp-access-credentials");
    expect(match?.definition.id).toBe("r2.temp_access_credentials.create");
    expect(match?.resources).toEqual([{ type: "account", id: "acct_1" }]);
  });
});
