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

  it("forwards Workers service reads from Wrangler raw account paths when the script grant matches", async () => {
    const secretHash = await hashProxySecret("secret");
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/accounts/acct_1/workers/services/script-a", {
      method: "GET",
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
        capability: "workers.service.read",
        resource_type: "workers_script",
        resource_id: "script-a",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("forwards Workers script updates from Wrangler raw account paths when the script grant matches", async () => {
    const secretHash = await hashProxySecret("secret");
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/accounts/acct_1/workers/scripts/script-a", {
      method: "PUT",
      headers: {
        Authorization: "Bearer fgk_123.secret",
        "Content-Type": "multipart/form-data; boundary=----form"
      },
      body: "------form\r\n------form--\r\n"
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
        capability: "workers.script.update_content",
        resource_type: "workers_script",
        resource_id: "script-a",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("forwards Workers script deployments reads from Wrangler raw account paths when the script grant matches", async () => {
    const secretHash = await hashProxySecret("secret");
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/accounts/acct_1/workers/scripts/script-a/deployments", {
      method: "GET",
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
        capability: "workers.script.deployments.read",
        resource_type: "workers_script",
        resource_id: "script-a",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("filters Workers scripts list responses to script read grants", async () => {
    const secretHash = await hashProxySecret("secret");
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      errors: [],
      messages: [],
      result: [
        { id: "script-a", created_on: "2026-05-14T00:00:00Z" },
        { id: "script-b", created_on: "2026-05-14T00:00:00Z" }
      ],
      result_info: {
        count: 2,
        total_count: 2
      }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/accounts/acct_1/workers/scripts", {
      method: "GET",
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
        capability: "workers.script.read",
        resource_type: "workers_script",
        resource_id: "script-a",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      result: [{ id: "script-a" }],
      result_info: {
        count: 1,
        total_count: 1
      }
    });
  });

  it("forwards Workers assets upload session creates from Wrangler raw account paths when the script grant matches", async () => {
    const secretHash = await hashProxySecret("secret");
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/accounts/acct_1/workers/scripts/script-a/assets-upload-session", {
      method: "POST",
      headers: {
        Authorization: "Bearer fgk_123.secret",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ manifest: {} })
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
        capability: "workers.assets.upload_session.create",
        resource_type: "workers_script",
        resource_id: "script-a",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("forwards Workers assets uploads from Wrangler raw account paths when the account grant matches", async () => {
    const secretHash = await hashProxySecret("secret");
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/accounts/acct_1/workers/assets/upload?base64=true", {
      method: "POST",
      headers: {
        Authorization: "Bearer fgk_123.secret",
        "Content-Type": "application/json"
      },
      body: JSON.stringify([{ key: "/index.html", value: "PGh0bWw+" }])
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
        capability: "workers.assets.upload",
        resource_type: "account",
        resource_id: "acct_1",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("forwards Workers assets uploads with Cloudflare upload session JWT authorization", async () => {
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/accounts/acct_1/workers/assets/upload?base64=true", {
      method: "POST",
      headers: {
        Authorization: "Bearer header.payload.signature",
        "Content-Type": "multipart/form-data; boundary=----form"
      },
      body: "------form\r\n------form--\r\n"
    }, createEnv({}));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const init = calls[0]?.[1];
    expect(init).toBeDefined();
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer header.payload.signature");
  });

  it("forwards Workers subdomain reads from Wrangler raw account paths when the account grant matches", async () => {
    const secretHash = await hashProxySecret("secret");
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/accounts/acct_1/workers/subdomain", {
      method: "GET",
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
        capability: "workers.subdomain.read",
        resource_type: "account",
        resource_id: "acct_1",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns 422 for R2 temporary credentials with unsupported permission", async () => {
    const secretHash = await hashProxySecret("secret");
    const res = await app.request("/client/v4/accounts/acct_1/r2/temp-access-credentials", {
      method: "POST",
      headers: {
        Authorization: "Bearer fgk_123.secret",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bucket: "bucket-a",
        parentAccessKeyId: "parent-key",
        permission: "admin-read-write",
        ttlSeconds: 900
      })
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
        capability: "r2.bucket.object.write",
        resource_type: "r2_bucket",
        resource_id: "bucket-a",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it("forwards R2 temporary credentials when bucket grant matches", async () => {
    const secretHash = await hashProxySecret("secret");
    const fetchMock = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/client/v4/accounts/acct_1/r2/temp-access-credentials", {
      method: "POST",
      headers: {
        Authorization: "Bearer fgk_123.secret",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bucket: "bucket-a",
        parentAccessKeyId: "parent-key",
        permission: "object-read-write",
        ttlSeconds: 900
      })
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
        capability: "r2.bucket.object.write",
        resource_type: "r2_bucket",
        resource_id: "bucket-a",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns 422 for R2 temporary credentials without parent access key id", async () => {
    const secretHash = await hashProxySecret("secret");
    const res = await app.request("/client/v4/accounts/acct_1/r2/temp-access-credentials", {
      method: "POST",
      headers: {
        Authorization: "Bearer fgk_123.secret",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bucket: "bucket-a",
        permission: "object-read-write",
        ttlSeconds: 900
      })
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
        capability: "r2.bucket.object.write",
        resource_type: "r2_bucket",
        resource_id: "bucket-a",
        constraints_json: "{}"
      }]
    }));

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ success: false });
  });
});
