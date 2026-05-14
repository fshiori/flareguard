# FlareGuard Skills

This file describes how another LLM, agent, or integration should use FlareGuard as a Cloudflare-compatible resource proxy.

## Purpose

Use FlareGuard when a client needs Cloudflare API access that is narrower than a normal Cloudflare API token. Clients call FlareGuard with a proxy key. FlareGuard checks grants and forwards only allowed requests to Cloudflare.

Do not give clients the upstream Cloudflare API token.

## Authentication

Send the proxy key as a bearer token:

```http
Authorization: Bearer fgk_<key-id>.<secret>
```

Proxy keys are created by an operator:

```bash
pnpm admin:create-key \
  --name <client-name> \
  --account-id <cloudflare-account-id>
```

The full proxy key is shown once. Store it securely.

## Grants

Each key can have multiple grants. A grant has:

- capability
- resource type
- resource id
- optional JSON constraints

Create a grant:

```bash
pnpm admin:add-grant \
  --key-id fgk_<key-id> \
  --capability <capability> \
  --resource-type <resource-type> \
  --resource-id <resource-id>
```

## Capability Mapping

### D1 Write

Use for D1 query/raw write access scoped to one database.

```text
capability: d1.database.write
resource_type: d1_database
resource_id: <d1-database-id>
```

Supported paths:

```text
POST /client/v4/accounts/:account_id/d1/database/:database_id/query
POST /client/v4/accounts/:account_id/d1/database/:database_id/raw
```

### Workers KV Storage Write

Use for KV write access scoped to one namespace.

```text
capability: kv.namespace.write
resource_type: kv_namespace
resource_id: <kv-namespace-id>
```

Supported path:

```text
PUT /client/v4/accounts/:account_id/storage/kv/namespaces/:namespace_id/values/:key
```

Optional prefix constraints may be stored as JSON:

```json
{"prefixes":["tenant-a:"]}
```

### Workers Scripts Write

Use for Worker script updates scoped to one script name.

```text
capability: workers.script.update_content
resource_type: workers_script
resource_id: <worker-script-name>
```

Supported path:

```text
PUT /client/v4/accounts/:account_id/workers/scripts/:script_name
```

This is high risk. Only grant it to trusted clients until body and metadata validation are stricter.

### Account Settings Read

Use for basic account metadata access scoped to one account.

```text
capability: account.self.read
resource_type: account
resource_id: <cloudflare-account-id>
```

Supported path:

```text
GET /client/v4/accounts/:account_id
```

### Workers R2 Storage Write

Use for generating temporary R2 credentials scoped to one bucket. The temporary credentials can then be used with R2's S3-compatible API.

```text
capability: r2.bucket.object.write
resource_type: r2_bucket
resource_id: <r2-bucket-name>
```

Supported path:

```text
POST /client/v4/accounts/:account_id/r2/temp-access-credentials
```

Request body:

```json
{
  "bucket": "<r2-bucket-name>",
  "parentAccessKeyId": "<parent-r2-access-key-id>",
  "permission": "object-read-write",
  "ttlSeconds": 900
}
```

FlareGuard only allows `object-read-write` temporary credentials. It does not proxy the S3-compatible object upload API directly.

## Error Behavior

FlareGuard returns Cloudflare-like error envelopes:

```json
{
  "success": false,
  "errors": [{ "code": 10003, "message": "access denied" }],
  "messages": [],
  "result": null
}
```

Common statuses:

- `401`: missing or invalid proxy key
- `403`: valid key but no matching grant
- `404`: unsupported endpoint

If a request has a matching grant, upstream Cloudflare errors pass through.

## Integration Rules

- Do not call unsupported Cloudflare endpoints through FlareGuard.
- Do not ask for or store the upstream Cloudflare API token.
- Use one proxy key per client, tenant, job, or integration.
- Add only the grants required for that principal.
- Treat Workers Script grants as sensitive.
