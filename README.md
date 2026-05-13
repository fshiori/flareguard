# FlareGuard

FlareGuard is a Cloudflare-compatible API proxy that issues its own proxy keys and enforces resource-level grants before forwarding requests to the Cloudflare API.

Cloudflare API permissions are often broader than a single D1 database, KV namespace, Worker script, or R2 bucket. FlareGuard adds an explicit policy layer in front of selected Cloudflare endpoints so a client can use one proxy key with multiple narrowly scoped grants.

## Current Scope

The MVP focuses on a Workers-first proxy with:

- Proxy-issued API keys.
- Multiple grants per key.
- Resource-level checks for selected Cloudflare-compatible endpoints.
- Cloudflare-like error response envelopes.
- D1-backed storage for proxy keys, grants, and audit events.
- A Worker Secret for the upstream Cloudflare API token.

Out of scope for the MVP:

- Full Cloudflare API compatibility.
- Transparent pass-through proxying.
- Account-wide list endpoints without response filtering.
- R2 S3-compatible API proxying.
- User-facing dashboard.
- Automatic upstream Cloudflare token creation.

## Architecture

```text
client
  -> FlareGuard Worker
      -> authenticate proxy key
      -> match explicit endpoint registry
      -> extract account/resource identifiers
      -> evaluate grants
      -> forward to Cloudflare API with upstream token
      -> return Cloudflare-like response
      -> write audit event
```

Main components:

- `src/index.ts`: Hono Worker entrypoint and routing skeleton.
- `src/endpoints/registry.ts`: explicit Cloudflare-compatible endpoint allowlist.
- `src/policy/engine.ts`: grant matching and policy decisions.
- `src/keys/key-store.ts`: proxy key parsing, hashing, and D1 authentication helpers.
- `src/cloudflare/upstream.ts`: upstream Cloudflare API fetch wrapper.
- `src/audit/audit-store.ts`: audit event serialization and D1 insert helper.
- `migrations/0001_initial.sql`: D1 schema.

## Supported Endpoint Patterns

The registry currently includes:

```text
GET  /client/v4/accounts/:account_id/d1/database/:database_id
POST /client/v4/accounts/:account_id/d1/database/:database_id/query
POST /client/v4/accounts/:account_id/d1/database/:database_id/raw
PUT  /client/v4/accounts/:account_id/storage/kv/namespaces/:namespace_id/values/:key
PUT  /client/v4/accounts/:account_id/workers/scripts/:script_name
GET  /client/v4/accounts/:account_id
```

Unsupported endpoints are rejected instead of passed through.

## Grant Model

A proxy key represents one principal, such as a tenant, integration, CI job, or agent. Each key can have multiple grants.

Grants are FlareGuard capabilities, not direct copies of Cloudflare permission labels:

```text
d1.database.write
kv.namespace.write
workers.script.update_content
account.self.read
```

Each grant is stored with a resource type and resource id. Product-specific constraints can be stored as JSON in `constraints_json`.

## Setup

Install dependencies:

```bash
pnpm install
```

Run tests:

```bash
pnpm test
```

Run typecheck:

```bash
pnpm typecheck
```

Start the Worker locally:

```bash
pnpm dev
```

## Cloudflare Bindings

`wrangler.toml` defines a D1 binding:

```toml
[[d1_databases]]
binding = "DB"
database_name = "flareguard"
database_id = "00000000-0000-0000-0000-000000000000"
```

For real deployments, replace the placeholder `database_id` with the deployed D1 database id.

The Worker also expects this secret:

```text
CLOUDFLARE_API_TOKEN
```

Set it with Wrangler:

```bash
wrangler secret put CLOUDFLARE_API_TOKEN
```

## Database

The initial migration creates:

- `proxy_keys`: proxy key metadata and hashed secrets.
- `grants`: capability/resource grants for proxy keys.
- `audit_events`: allow/deny decisions and upstream statuses.

Apply migrations with Wrangler when a real D1 database is configured:

```bash
wrangler d1 migrations apply flareguard
```

## Development Notes

- Keep new Cloudflare-compatible endpoints explicit in `src/endpoints/registry.ts`.
- Do not add generic pass-through behavior.
- Add focused tests next to changed modules.
- Run `pnpm test` and `pnpm typecheck` before merging.
