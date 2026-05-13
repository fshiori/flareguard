import { describe, expect, it } from "vitest";
import app from "./index";

const env = {
  CLOUDFLARE_API_TOKEN: "cf_token",
  DB: {} as D1Database
};

describe("app", () => {
  it("returns 401 without authorization", async () => {
    const res = await app.request("/client/v4/accounts/acct_1/d1/database/db_1/query", {
      method: "POST"
    }, env);

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it("returns 404 for unsupported endpoints", async () => {
    const res = await app.request("/client/v4/accounts/acct_1/d1/database", {
      method: "GET",
      headers: { Authorization: "Bearer fgk_123.secret" }
    }, env);

    expect(res.status).toBe(404);
  });
});
