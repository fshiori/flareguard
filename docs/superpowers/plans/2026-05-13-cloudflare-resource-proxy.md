# Cloudflare Resource Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Cloudflare Workers proxy that authenticates proxy-issued keys and enforces resource-level grants for selected Cloudflare API endpoints.

**Architecture:** Use Hono on Cloudflare Workers with an explicit endpoint registry and policy engine. Store proxy key hashes, grants, and audit events in D1; keep the upstream Cloudflare API token in Worker Secrets.

**Tech Stack:** TypeScript, Cloudflare Workers, Hono, Zod, Vitest, Miniflare or Wrangler test runtime, D1.

---

## File Structure

- Create `package.json`: project scripts and dependencies.
- Create `tsconfig.json`: TypeScript compiler settings for Workers.
- Create `vitest.config.ts`: unit test config.
- Create `wrangler.toml`: Worker entrypoint and D1 binding.
- Create `migrations/0001_initial.sql`: D1 schema for keys, grants, and audit events.
- Create `src/index.ts`: Worker entrypoint and Hono app wiring.
- Create `src/cloudflare/upstream.ts`: upstream Cloudflare fetch wrapper.
- Create `src/http/errors.ts`: Cloudflare-like error responses.
- Create `src/http/request.ts`: request parsing helpers.
- Create `src/keys/key-store.ts`: proxy key lookup and secret hash verification.
- Create `src/policy/types.ts`: core policy types.
- Create `src/policy/engine.ts`: grant evaluation.
- Create `src/endpoints/registry.ts`: supported endpoint definitions.
- Create `src/audit/audit-store.ts`: audit event writer.
- Create `src/env.ts`: Worker binding types.
- Create tests under `src/**/*.test.ts` next to the implementation files.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `wrangler.toml`
- Create: `src/env.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Create project config**

Create `package.json`:

```json
{
  "name": "flareguard",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.7.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260513.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0",
    "wrangler": "^4.15.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"],
    "noEmit": true
  },
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

Create `wrangler.toml`:

```toml
name = "flareguard"
main = "src/index.ts"
compatibility_date = "2026-05-13"

[[d1_databases]]
binding = "DB"
database_name = "flareguard"
database_id = "00000000-0000-0000-0000-000000000000"
```

- [ ] **Step 2: Create Worker binding types**

Create `src/env.ts`:

```ts
export type Env = {
  DB: D1Database;
  CLOUDFLARE_API_TOKEN: string;
};
```

- [ ] **Step 3: Create a minimal Worker**

Create `src/index.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 4: Run verification**

Run: `pnpm install`

Expected: dependencies install successfully.

Run: `pnpm test`

Expected: PASS with no tests found or an empty test suite result accepted by Vitest.

Run: `pnpm typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts wrangler.toml src/env.ts src/index.ts
git commit -m "chore: scaffold workers project"
```

## Task 2: Database Schema

**Files:**
- Create: `migrations/0001_initial.sql`
- Create: `src/keys/key-store.ts`
- Test: `src/keys/key-store.test.ts`

- [ ] **Step 1: Create D1 schema**

Create `migrations/0001_initial.sql`:

```sql
CREATE TABLE proxy_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grants (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES proxy_keys(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  constraints_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX grants_key_capability_resource_idx
ON grants (key_id, capability, resource_type, resource_id);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  key_id TEXT,
  endpoint_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  resources_json TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
  upstream_status INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: Write failing key-store tests**

Create `src/keys/key-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { splitProxyKey } from "./key-store";

describe("splitProxyKey", () => {
  it("splits a proxy key into key id and secret", () => {
    expect(splitProxyKey("fgk_abc.def")).toEqual({ keyId: "fgk_abc", secret: "def" });
  });

  it("rejects malformed keys", () => {
    expect(() => splitProxyKey("fgk_abc")).toThrow("invalid proxy key format");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test src/keys/key-store.test.ts`

Expected: FAIL because `src/keys/key-store.ts` does not exist.

- [ ] **Step 4: Implement key parsing**

Create `src/keys/key-store.ts`:

```ts
export type ProxyKeyParts = {
  keyId: string;
  secret: string;
};

export function splitProxyKey(value: string): ProxyKeyParts {
  const [keyId, secret, extra] = value.split(".");
  if (!keyId || !secret || extra !== undefined) {
    throw new Error("invalid proxy key format");
  }
  return { keyId, secret };
}
```

- [ ] **Step 5: Run verification**

Run: `pnpm test src/keys/key-store.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add migrations/0001_initial.sql src/keys/key-store.ts src/keys/key-store.test.ts
git commit -m "feat: add proxy key schema and parser"
```

## Task 3: Policy Types and Engine

**Files:**
- Create: `src/policy/types.ts`
- Create: `src/policy/engine.ts`
- Test: `src/policy/engine.test.ts`

- [ ] **Step 1: Write failing policy tests**

Create `src/policy/engine.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/policy/engine.test.ts`

Expected: FAIL because policy files do not exist.

- [ ] **Step 3: Implement policy types**

Create `src/policy/types.ts`:

```ts
export type ResourceRef = {
  type: string;
  id: string;
};

export type Grant = {
  id: string;
  keyId: string;
  capability: string;
  resourceType: string;
  resourceId: string;
  constraints: Record<string, unknown>;
};

export type PolicyDecision =
  | { allowed: true; grant: Grant }
  | { allowed: false; reason: string };
```

- [ ] **Step 4: Implement policy engine**

Create `src/policy/engine.ts`:

```ts
import type { Grant, PolicyDecision, ResourceRef } from "./types";

export function isGrantAllowed(
  grant: Grant,
  capability: string,
  resources: ResourceRef[]
): boolean {
  return (
    grant.capability === capability &&
    resources.some((resource) => resource.type === grant.resourceType && resource.id === grant.resourceId)
  );
}

export function decidePolicy(
  grants: Grant[],
  capability: string,
  resources: ResourceRef[]
): PolicyDecision {
  const grant = grants.find((candidate) => isGrantAllowed(candidate, capability, resources));
  if (!grant) {
    return { allowed: false, reason: "no matching grant" };
  }
  return { allowed: true, grant };
}
```

- [ ] **Step 5: Run verification**

Run: `pnpm test src/policy/engine.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/policy/types.ts src/policy/engine.ts src/policy/engine.test.ts
git commit -m "feat: add grant policy engine"
```

## Task 4: Endpoint Registry

**Files:**
- Create: `src/endpoints/registry.ts`
- Test: `src/endpoints/registry.test.ts`

- [ ] **Step 1: Write failing registry tests**

Create `src/endpoints/registry.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/endpoints/registry.test.ts`

Expected: FAIL because registry does not exist.

- [ ] **Step 3: Implement endpoint registry**

Create `src/endpoints/registry.ts`:

```ts
import type { ResourceRef } from "../policy/types";

export type EndpointDefinition = {
  id: string;
  method: string;
  pattern: RegExp;
  requiredCapability: string;
  extractResources: (match: RegExpMatchArray) => ResourceRef[];
  upstreamPath: (match: RegExpMatchArray) => string;
};

export type EndpointMatch = {
  definition: EndpointDefinition;
  resources: ResourceRef[];
  upstreamPath: string;
};

export const endpoints: EndpointDefinition[] = [
  {
    id: "d1.get",
    method: "GET",
    pattern: /^\/client\/v4\/accounts\/([^/]+)\/d1\/database\/([^/]+)$/,
    requiredCapability: "d1.database.read",
    extractResources: (match) => [
      { type: "account", id: match[1] },
      { type: "d1_database", id: match[2] }
    ],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/d1/database/${match[2]}`
  },
  {
    id: "d1.query",
    method: "POST",
    pattern: /^\/client\/v4\/accounts\/([^/]+)\/d1\/database\/([^/]+)\/query$/,
    requiredCapability: "d1.database.write",
    extractResources: (match) => [
      { type: "account", id: match[1] },
      { type: "d1_database", id: match[2] }
    ],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/d1/database/${match[2]}/query`
  },
  {
    id: "d1.raw",
    method: "POST",
    pattern: /^\/client\/v4\/accounts\/([^/]+)\/d1\/database\/([^/]+)\/raw$/,
    requiredCapability: "d1.database.write",
    extractResources: (match) => [
      { type: "account", id: match[1] },
      { type: "d1_database", id: match[2] }
    ],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/d1/database/${match[2]}/raw`
  }
];

export function matchEndpoint(method: string, pathname: string): EndpointMatch | null {
  for (const definition of endpoints) {
    if (definition.method !== method.toUpperCase()) {
      continue;
    }
    const match = pathname.match(definition.pattern);
    if (!match) {
      continue;
    }
    return {
      definition,
      resources: definition.extractResources(match),
      upstreamPath: definition.upstreamPath(match)
    };
  }
  return null;
}
```

- [ ] **Step 4: Run verification**

Run: `pnpm test src/endpoints/registry.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/registry.ts src/endpoints/registry.test.ts
git commit -m "feat: add supported endpoint registry"
```

## Task 5: HTTP Errors and Upstream Fetch

**Files:**
- Create: `src/http/errors.ts`
- Create: `src/cloudflare/upstream.ts`
- Test: `src/http/errors.test.ts`

- [ ] **Step 1: Write failing error response test**

Create `src/http/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cloudflareErrorBody } from "./errors";

describe("cloudflareErrorBody", () => {
  it("builds a Cloudflare-like error envelope", () => {
    expect(cloudflareErrorBody(10000, "access denied")).toEqual({
      success: false,
      errors: [{ code: 10000, message: "access denied" }],
      messages: [],
      result: null
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/http/errors.test.ts`

Expected: FAIL because `src/http/errors.ts` does not exist.

- [ ] **Step 3: Implement error helper**

Create `src/http/errors.ts`:

```ts
export function cloudflareErrorBody(code: number, message: string) {
  return {
    success: false,
    errors: [{ code, message }],
    messages: [],
    result: null
  };
}
```

- [ ] **Step 4: Implement upstream fetch wrapper**

Create `src/cloudflare/upstream.ts`:

```ts
export type UpstreamRequest = {
  method: string;
  path: string;
  search: string;
  headers: Headers;
  body: BodyInit | null;
};

export function buildCloudflareUrl(path: string, search: string): string {
  return `https://api.cloudflare.com${path}${search}`;
}

export async function fetchCloudflare(
  token: string,
  request: UpstreamRequest
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.delete("Host");

  return fetch(buildCloudflareUrl(request.path, request.search), {
    method: request.method,
    headers,
    body: request.body
  });
}
```

- [ ] **Step 5: Run verification**

Run: `pnpm test src/http/errors.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/http/errors.ts src/http/errors.test.ts src/cloudflare/upstream.ts
git commit -m "feat: add cloudflare response helpers"
```

## Task 6: Worker Authorization Pipeline

**Files:**
- Modify: `src/index.ts`
- Test: `src/index.test.ts`

- [ ] **Step 1: Write failing HTTP tests**

Create `src/index.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/index.test.ts`

Expected: FAIL because the app currently only implements `/health`.

- [ ] **Step 3: Wire authorization skeleton**

Replace `src/index.ts` with:

```ts
import { Hono } from "hono";
import { fetchCloudflare } from "./cloudflare/upstream";
import { matchEndpoint } from "./endpoints/registry";
import type { Env } from "./env";
import { cloudflareErrorBody } from "./http/errors";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

app.all("/client/v4/*", async (c) => {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return c.json(cloudflareErrorBody(10001, "missing proxy key"), 401);
  }

  const url = new URL(c.req.url);
  const match = matchEndpoint(c.req.method, url.pathname);
  if (!match) {
    return c.json(cloudflareErrorBody(10004, "unsupported endpoint"), 404);
  }

  return fetchCloudflare(c.env.CLOUDFLARE_API_TOKEN, {
    method: c.req.method,
    path: match.upstreamPath,
    search: url.search,
    headers: new Headers(c.req.raw.headers),
    body: c.req.raw.body
  });
});

export default app;
```

- [ ] **Step 4: Run verification**

Run: `pnpm test src/index.test.ts`

Expected: PASS for 401 and 404 tests.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat: add worker proxy routing skeleton"
```

## Task 7: Persisted Grants and Deny Decisions

**Files:**
- Modify: `src/keys/key-store.ts`
- Modify: `src/index.ts`
- Test: `src/keys/key-store.test.ts`
- Test: `src/index.test.ts`

- [ ] **Step 1: Extend key-store tests for grants**

Append to `src/keys/key-store.test.ts`:

```ts
import { normalizeGrantRow } from "./key-store";

describe("normalizeGrantRow", () => {
  it("parses constraints JSON", () => {
    expect(normalizeGrantRow({
      id: "grant_1",
      key_id: "fgk_123",
      capability: "kv.namespace.write",
      resource_type: "kv_namespace",
      resource_id: "ns_1",
      constraints_json: "{\"prefixes\":[\"tenant-a:\"]}"
    })).toEqual({
      id: "grant_1",
      keyId: "fgk_123",
      capability: "kv.namespace.write",
      resourceType: "kv_namespace",
      resourceId: "ns_1",
      constraints: { prefixes: ["tenant-a:"] }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/keys/key-store.test.ts`

Expected: FAIL because `normalizeGrantRow` is not implemented.

- [ ] **Step 3: Implement grant row normalization**

Append to `src/keys/key-store.ts`:

```ts
import type { Grant } from "../policy/types";

type GrantRow = {
  id: string;
  key_id: string;
  capability: string;
  resource_type: string;
  resource_id: string;
  constraints_json: string;
};

export function normalizeGrantRow(row: GrantRow): Grant {
  return {
    id: row.id,
    keyId: row.key_id,
    capability: row.capability,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    constraints: JSON.parse(row.constraints_json) as Record<string, unknown>
  };
}
```

- [ ] **Step 4: Run verification**

Run: `pnpm test src/keys/key-store.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/keys/key-store.ts src/keys/key-store.test.ts
git commit -m "feat: normalize persisted grants"
```

## Task 8: DB-Backed Key Authentication

**Files:**
- Modify: `src/keys/key-store.ts`
- Modify: `src/keys/key-store.test.ts`

- [ ] **Step 1: Add failing hash tests**

Append to `src/keys/key-store.test.ts`:

```ts
import { hashProxySecret, verifyProxySecret } from "./key-store";

describe("proxy secret hashing", () => {
  it("verifies a matching secret", async () => {
    const hash = await hashProxySecret("secret-value");
    await expect(verifyProxySecret("secret-value", hash)).resolves.toBe(true);
  });

  it("rejects a different secret", async () => {
    const hash = await hashProxySecret("secret-value");
    await expect(verifyProxySecret("other-value", hash)).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/keys/key-store.test.ts`

Expected: FAIL because `hashProxySecret` and `verifyProxySecret` do not exist.

- [ ] **Step 3: Implement Workers-compatible SHA-256 hashing**

Append to `src/keys/key-store.ts`:

```ts
function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashProxySecret(secret: string): Promise<string> {
  const encoded = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return `sha256:${toHex(digest)}`;
}

export async function verifyProxySecret(secret: string, expectedHash: string): Promise<boolean> {
  return (await hashProxySecret(secret)) === expectedHash;
}
```

- [ ] **Step 4: Add DB lookup function**

Append to `src/keys/key-store.ts`:

```ts
export type ProxyKeyRecord = {
  id: string;
  accountId: string;
  status: "active" | "revoked";
  expiresAt: string | null;
};

type ProxyKeyRow = {
  id: string;
  account_id: string;
  secret_hash: string;
  status: "active" | "revoked";
  expires_at: string | null;
};

export async function authenticateProxyKey(
  db: D1Database,
  value: string,
  now: Date = new Date()
): Promise<ProxyKeyRecord | null> {
  const parts = splitProxyKey(value);
  const row = await db
    .prepare("SELECT id, account_id, secret_hash, status, expires_at FROM proxy_keys WHERE id = ?")
    .bind(parts.keyId)
    .first<ProxyKeyRow>();

  if (!row || row.status !== "active") {
    return null;
  }

  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) {
    return null;
  }

  if (!(await verifyProxySecret(parts.secret, row.secret_hash))) {
    return null;
  }

  return {
    id: row.id,
    accountId: row.account_id,
    status: row.status,
    expiresAt: row.expires_at
  };
}
```

- [ ] **Step 5: Run verification**

Run: `pnpm test src/keys/key-store.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/keys/key-store.ts src/keys/key-store.test.ts
git commit -m "feat: authenticate proxy keys from d1"
```

## Task 9: Expand Registry for KV, Workers, Account, and R2

**Files:**
- Modify: `src/endpoints/registry.ts`
- Modify: `src/endpoints/registry.test.ts`

- [ ] **Step 1: Add failing endpoint tests**

Append to `src/endpoints/registry.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/endpoints/registry.test.ts`

Expected: FAIL because these endpoint definitions do not exist.

- [ ] **Step 3: Add endpoint definitions**

Add these objects to the `endpoints` array in `src/endpoints/registry.ts`:

```ts
{
  id: "kv.key.put",
  method: "PUT",
  pattern: /^\/client\/v4\/accounts\/([^/]+)\/storage\/kv\/namespaces\/([^/]+)\/values\/(.+)$/,
  requiredCapability: "kv.namespace.write",
  extractResources: (match) => [
    { type: "account", id: match[1] },
    { type: "kv_namespace", id: match[2] }
  ],
  upstreamPath: (match) => `/client/v4/accounts/${match[1]}/storage/kv/namespaces/${match[2]}/values/${match[3]}`
},
{
  id: "workers.script.put",
  method: "PUT",
  pattern: /^\/client\/v4\/accounts\/([^/]+)\/workers\/scripts\/([^/]+)$/,
  requiredCapability: "workers.script.update_content",
  extractResources: (match) => [
    { type: "account", id: match[1] },
    { type: "workers_script", id: match[2] }
  ],
  upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/scripts/${match[2]}`
},
{
  id: "account.get",
  method: "GET",
  pattern: /^\/client\/v4\/accounts\/([^/]+)$/,
  requiredCapability: "account.self.read",
  extractResources: (match) => [{ type: "account", id: match[1] }],
  upstreamPath: (match) => `/client/v4/accounts/${match[1]}`
}
```

- [ ] **Step 4: Run verification**

Run: `pnpm test src/endpoints/registry.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/registry.ts src/endpoints/registry.test.ts
git commit -m "feat: expand supported cloudflare endpoints"
```

## Task 10: Audit Events

**Files:**
- Create: `src/audit/audit-store.ts`
- Test: `src/audit/audit-store.test.ts`

- [ ] **Step 1: Write failing audit tests**

Create `src/audit/audit-store.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/audit/audit-store.test.ts`

Expected: FAIL because audit store does not exist.

- [ ] **Step 3: Implement audit serialization**

Create `src/audit/audit-store.ts`:

```ts
import type { ResourceRef } from "../policy/types";

export type AuditEvent = {
  id: string;
  keyId: string | null;
  endpointId: string;
  method: string;
  path: string;
  resources: ResourceRef[];
  decision: "allow" | "deny";
  upstreamStatus: number | null;
};

export function auditEventParams(event: AuditEvent): unknown[] {
  return [
    event.id,
    event.keyId,
    event.endpointId,
    event.method,
    event.path,
    JSON.stringify(event.resources),
    event.decision,
    event.upstreamStatus
  ];
}

export async function writeAuditEvent(db: D1Database, event: AuditEvent): Promise<void> {
  await db.prepare(
    `INSERT INTO audit_events
      (id, key_id, endpoint_id, method, path, resources_json, decision, upstream_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(...auditEventParams(event)).run();
}
```

- [ ] **Step 4: Run verification**

Run: `pnpm test src/audit/audit-store.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audit/audit-store.ts src/audit/audit-store.test.ts
git commit -m "feat: add audit event writer"
```

## Self-Review

Spec coverage:

- Workers-first TypeScript/Hono runtime is covered in Task 1.
- D1 schema for keys, grants, and audit is covered in Task 2.
- Proxy-owned grants and policy enforcement are covered in Tasks 3 and 7.
- DB-backed key authentication is covered in Task 8.
- Explicit endpoint registry is covered in Tasks 4 and 9.
- Cloudflare-like errors and upstream fetch are covered in Tasks 5 and 6.
- Audit events are covered in Task 10.
- D1 SQL-class restrictions are not part of the approved MVP.
- R2 S3-compatible API support is excluded from the approved MVP.
