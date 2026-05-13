import { afterEach, describe, expect, it, vi } from "vitest";
import app from "./index";
import { hashProxySecret } from "./keys/key-store";

type MockDbState = {
  keyRow?: Record<string, unknown> | null;
  grantRows?: Record<string, unknown>[];
};

function createMockDb(state: MockDbState): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM proxy_keys")) {
                return state.keyRow ?? null;
              }
              return null;
            },
            async all() {
              if (sql.includes("FROM grants")) {
                return { results: state.grantRows ?? [] };
              }
              return { results: [] };
            }
          };
        }
      };
    }
  } as unknown as D1Database;
}

function createEnv(state: MockDbState) {
  return {
    CLOUDFLARE_API_TOKEN: "cf_token",
    DB: createMockDb(state)
  };
}

describe("app", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 without authorization", async () => {
    const res = await app.request("/client/v4/accounts/acct_1/d1/database/db_1/query", {
      method: "POST"
    }, createEnv({}));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it("returns 404 for unsupported endpoints", async () => {
    const res = await app.request("/client/v4/accounts/acct_1/d1/database", {
      method: "GET",
      headers: { Authorization: "Bearer fgk_123.secret" }
    }, createEnv({}));

    expect(res.status).toBe(404);
  });

  it("returns 401 for invalid proxy keys", async () => {
    const res = await app.request("/client/v4/accounts/acct_1/d1/database/db_1/query", {
      method: "POST",
      headers: { Authorization: "Bearer fgk_123.secret" }
    }, createEnv({ keyRow: null }));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it("returns 403 when the key has no matching grant", async () => {
    const secretHash = await hashProxySecret("secret");
    const res = await app.request("/client/v4/accounts/acct_1/d1/database/db_1/query", {
      method: "POST",
      headers: { Authorization: "Bearer fgk_123.secret" }
    }, createEnv({
      keyRow: {
        id: "fgk_123",
        account_id: "acct_1",
        secret_hash: secretHash,
        status: "active",
        expires_at: null
      },
      grantRows: []
    }));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it("forwards supported requests when key and grant match", async () => {
    const secretHash = await hashProxySecret("secret");
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/client/v4/accounts/acct_1/d1/database/db_1/query", {
      method: "POST",
      headers: { Authorization: "Bearer fgk_123.secret" }
    }, createEnv({
      keyRow: {
        id: "fgk_123",
        account_id: "acct_1",
        secret_hash: secretHash,
        status: "active",
        expires_at: null
      },
      grantRows: [{
        id: "grant_1",
        key_id: "fgk_123",
        capability: "d1.database.write",
        resource_type: "d1_database",
        resource_id: "db_1",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
