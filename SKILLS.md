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
PUT /accounts/:account_id/workers/scripts/:script_name
```

This is high risk. Only grant it to trusted clients until body and metadata validation are stricter.

### Workers Service Read

Use for Worker service metadata reads scoped to one script name.

```text
capability: workers.service.read
resource_type: workers_script
resource_id: <worker-script-name>
```

Supported paths:

```text
GET /client/v4/accounts/:account_id/workers/services/:script_name
GET /accounts/:account_id/workers/services/:script_name
```

### Workers Script Deployments Read

Use for Worker script deployment metadata reads scoped to one script name.

```text
capability: workers.script.deployments.read
resource_type: workers_script
resource_id: <worker-script-name>
```

Supported paths:

```text
GET /client/v4/accounts/:account_id/workers/scripts/:script_name/deployments
GET /accounts/:account_id/workers/scripts/:script_name/deployments
```

### Workers Script Deployment Create

Use for activating or creating a Worker script deployment scoped to one script name.

```text
capability: workers.script.deployment.create
resource_type: workers_script
resource_id: <worker-script-name>
```

Supported paths:

```text
POST /client/v4/accounts/:account_id/workers/scripts/:script_name/deployments
POST /accounts/:account_id/workers/scripts/:script_name/deployments
```

### Workers Script Version Create

Use for creating Worker script versions scoped to one script name.

```text
capability: workers.script.version.create
resource_type: workers_script
resource_id: <worker-script-name>
```

Supported paths:

```text
POST /client/v4/accounts/:account_id/workers/scripts/:script_name/versions
POST /accounts/:account_id/workers/scripts/:script_name/versions
```

### Workers Script Read

Use for script-scoped reads needed by deployment tooling. Scripts list responses are filtered to scripts covered by this grant.

```text
capability: workers.script.read
resource_type: workers_script
resource_id: <worker-script-name>
```

Supported paths:

```text
GET /client/v4/accounts/:account_id/workers/scripts
GET /accounts/:account_id/workers/scripts
```

### Workers Assets Upload Session Create

Use for creating Worker static assets upload sessions scoped to one script name.

```text
capability: workers.assets.upload_session.create
resource_type: workers_script
resource_id: <worker-script-name>
```

Supported paths:

```text
POST /client/v4/accounts/:account_id/workers/scripts/:script_name/assets-upload-session
POST /accounts/:account_id/workers/scripts/:script_name/assets-upload-session
```

### Workers Assets Upload

Use for uploading Worker static assets batches. The Cloudflare endpoint is account-scoped, so this grant is scoped to the Cloudflare account. Wrangler normally authorizes this endpoint with the Cloudflare upload-session JWT returned by the asset upload session endpoint; FlareGuard forwards that JWT to Cloudflare for this endpoint.

```text
capability: workers.assets.upload
resource_type: account
resource_id: <cloudflare-account-id>
```

Supported paths:

```text
POST /client/v4/accounts/:account_id/workers/assets/upload
POST /accounts/:account_id/workers/assets/upload
```

### Workers Subdomain Read

Use for reading the account workers.dev subdomain after deploy.

```text
capability: workers.subdomain.read
resource_type: account
resource_id: <cloudflare-account-id>
```

Supported paths:

```text
GET /client/v4/accounts/:account_id/workers/subdomain
GET /accounts/:account_id/workers/subdomain
```

### Workers Script Subdomain Read

Use for reading a Worker script's workers.dev URL after deploy.

```text
capability: workers.script.subdomain.read
resource_type: workers_script
resource_id: <worker-script-name>
```

Supported paths:

```text
GET /client/v4/accounts/:account_id/workers/scripts/:script_name/subdomain
GET /accounts/:account_id/workers/scripts/:script_name/subdomain
```

### Workers Script Subdomain Update

Use for enabling or updating a Worker script's workers.dev subdomain.

```text
capability: workers.script.subdomain.update
resource_type: workers_script
resource_id: <worker-script-name>
```

Supported paths:

```text
POST /client/v4/accounts/:account_id/workers/scripts/:script_name/subdomain
POST /accounts/:account_id/workers/scripts/:script_name/subdomain
```

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

Prefer native Cloudflare R2 bucket-scoped API tokens for R2 object access. R2 already supports per-bucket Object Read & Write credentials, so most clients should use R2 directly instead of routing object access through FlareGuard.

FlareGuard's R2 capability is optional and exists only for generating temporary R2 credentials scoped to one bucket.

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

If the client does not need short-lived credentials, use a native R2 bucket-scoped token instead.

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
