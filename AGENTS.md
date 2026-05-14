# Agent Instructions

FlareGuard is a Cloudflare-compatible resource proxy. It enforces proxy-owned grants before forwarding selected Cloudflare API requests.

These instructions are for coding agents that modify this repository.

## Core Rules

- Do not add transparent Cloudflare pass-through behavior.
- Every supported Cloudflare endpoint must be explicitly registered in `src/endpoints/registry.ts`.
- Every endpoint definition must include method, path matching, required capability, resource extraction, and upstream path mapping.
- Every new endpoint or policy behavior must have focused tests.
- Run `pnpm test` and `pnpm typecheck` before completing changes.

## Security Boundaries

- Never commit real Cloudflare API tokens.
- Never commit `.env`, `.env.*`, `wrangler.production.toml`, or `wrangler.local.toml`.
- Never commit real deployment-only IDs unless they are intentionally public.
- Keep upstream Cloudflare credentials in Worker Secrets.
- Keep production Wrangler config in ignored local files.

## Capability Model

Do not use Cloudflare permission labels as the enforcement boundary. Use FlareGuard capabilities and resource types.

Common mappings:

| Cloudflare permission family | Capability | Resource type | Resource id |
| --- | --- | --- | --- |
| D1 Write | `d1.database.write` | `d1_database` | D1 database id |
| Workers KV Storage Write | `kv.namespace.write` | `kv_namespace` | KV namespace id |
| Workers Scripts Write | `workers.script.update_content` | `workers_script` | Worker script name |
| Account Settings Read | `account.self.read` | `account` | Cloudflare account id |
| Workers R2 Storage Write | `r2.bucket.object.write` | `r2_bucket` | R2 bucket name |

## Endpoint Changes

When adding an endpoint:

1. Add a focused test in `src/endpoints/registry.test.ts`.
2. Add an explicit definition in `src/endpoints/registry.ts`.
3. Verify the endpoint extracts every resource needed for authorization.
4. Choose the narrowest capability.
5. Confirm unsupported list/all-account variants remain blocked unless response filtering is implemented.

## Workers Scripts

Treat `workers.script.update_content` as high risk.

Do not broaden Workers Script support without validating request bodies and metadata. In particular, be careful with:

- routes
- secrets
- bindings
- service bindings
- account-wide script operations

## R2

R2 object write support is implemented through Cloudflare's v4 temporary access credentials endpoint:

```text
POST /client/v4/accounts/:account_id/r2/temp-access-credentials
```

Do not add generic S3-compatible proxying to `/client/v4`. S3 signing and object APIs are a separate surface. R2 temporary credentials must remain scoped to the granted bucket and must not allow broader permissions than `object-read-write` without a deliberate design update.

## Admin CLI

Admin scripts live in `scripts/admin`.

- `pnpm admin:create-key` creates a proxy key and stores only its hash.
- `pnpm admin:add-grant` creates a grant for an existing key.
- CLI commands should avoid printing secrets except for the one-time plaintext proxy key returned by `create-key`.

## Verification

Use:

```bash
pnpm test
pnpm typecheck
```

For deployed checks, use the private ignored config:

```bash
pnpm exec wrangler deploy --config wrangler.production.toml
```
