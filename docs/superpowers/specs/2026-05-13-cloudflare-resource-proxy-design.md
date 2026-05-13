# Cloudflare Resource Proxy Design

## Goal

Build a Cloudflare-compatible API proxy that issues its own proxy keys and enforces finer resource-level access than Cloudflare's general API token permissions provide.

The first version targets these Cloudflare permission families:

- D1 Write
- Workers R2 Storage Write
- Workers KV Storage Write
- Workers Scripts Write
- Account Settings Read

The proxy key model must support one key with multiple grants.

## Runtime

The proxy is Workers-first:

- Runtime: Cloudflare Workers
- Language: TypeScript
- HTTP framework: Hono
- Policy and audit storage: D1
- Optional hot cache: Workers KV or Cache API
- Upstream Cloudflare credentials: Worker Secrets
- Validation: Zod or Valibot
- Tests: Vitest with Miniflare or workerd

The implementation should avoid Node-only dependencies unless a separate self-hosted variant is intentionally introduced later.

## Core Model

A proxy key represents a principal, such as an app, tenant, CI job, agent, or integration.

Each key can have multiple grants. A grant is not a direct copy of a Cloudflare permission label. It is a proxy-owned capability with resource constraints and optional endpoint or request-body constraints.

Example:

```json
{
  "keyId": "fgk_123",
  "name": "tenant-a-ci",
  "accountId": "cf_account_id",
  "grants": [
    {
      "capability": "d1.database.write",
      "resources": { "databaseIds": ["db_1"] }
    },
    {
      "capability": "r2.bucket.object.write",
      "resources": { "buckets": ["tenant-a-assets"], "prefixes": ["uploads/"] }
    },
    {
      "capability": "kv.namespace.write",
      "resources": { "namespaceIds": ["kv_ns_1"], "prefixes": ["tenant-a:"] }
    },
    {
      "capability": "workers.script.update_content",
      "resources": { "scriptNames": ["tenant-a-worker"] },
      "constraints": {
        "allowBindingsUpdate": false,
        "allowRoutesUpdate": false,
        "allowSecretsUpdate": false
      }
    },
    {
      "capability": "account.self.read",
      "resources": { "accountId": "cf_account_id" },
      "endpoints": ["account.get"]
    }
  ]
}
```

Cloudflare permission labels are used as upstream requirements and UI hints, not as the proxy's enforcement boundary.

## Request Flow

Clients call a Cloudflare-compatible path with a proxy-issued key:

```http
Authorization: Bearer fgk_xxx
GET /client/v4/accounts/:account_id/d1/database/:database_id
```

The proxy:

1. Authenticates the proxy key.
2. Parses method, path, query, and body.
3. Resolves the request to an endpoint definition.
4. Extracts resource identifiers from URL, query, and body.
5. Checks the key grants against the required capability and resource constraints.
6. Validates request-specific constraints.
7. Calls the upstream Cloudflare API with a Worker Secret token.
8. Returns a Cloudflare-like response envelope and status code.
9. Writes an audit event.

Unsupported endpoints must not pass through transparently.

## Endpoint Registry

Every supported Cloudflare-compatible endpoint is declared in a registry:

```ts
type EndpointDefinition = {
  id: string;
  method: string;
  pathTemplate: string;
  requiredCapability: string;
  extractResources: (request: ParsedRequest) => ResourceRef[];
  validateRequest?: (request: ParsedRequest, grant: Grant) => ValidationResult;
  mapUpstream: (request: ParsedRequest) => UpstreamRequest;
};
```

This registry is the main safety boundary. Generic reverse proxy behavior is intentionally out of scope for the MVP.

## MVP Endpoint Scope

### D1

Support:

- `GET /accounts/:account_id/d1/database/:database_id`
- `POST /accounts/:account_id/d1/database/:database_id/query`
- `POST /accounts/:account_id/d1/database/:database_id/raw`

Constraints:

- Must match allowed `account_id` and `database_id`.
- Write grants may optionally restrict SQL classes later, such as blocking DDL, PRAGMA, or multi-statement execution.
- List-all-databases is not supported in MVP unless response filtering is implemented.

### R2

Support Cloudflare API bucket/object write endpoints only where the bucket can be extracted and enforced.

Constraints:

- Must match allowed bucket.
- Optional key prefix restrictions should be part of the grant model.
- S3-compatible API support is a separate layer because AWS signing and path semantics differ from the Cloudflare v4 API.

### Workers KV

Support:

- Namespace metadata read for explicitly allowed namespaces.
- Key read, write, delete, and list for explicitly allowed namespaces.

Constraints:

- Must match allowed namespace id.
- Optional key prefix restrictions should be supported.
- Account-wide namespace listing is not supported in MVP unless response filtering is implemented.

### Workers Scripts

Support:

- Get or update a specified script.

Constraints:

- Must match allowed script name.
- Routes, secrets, service bindings, and broader Workers account operations are not enabled by default.
- Script update requests must be validated so a grant can block binding, route, or secret changes.

### Account Settings

Support:

- Minimal account self/basic metadata endpoints needed by clients.

Constraints:

- Must match the key's account id.
- Account-wide resource enumeration is not supported in MVP.

## Storage

D1 tables:

- `proxy_keys`: key id, hashed secret, account id, name, status, timestamps.
- `grants`: key id, capability, resource JSON, constraints JSON, timestamps.
- `audit_events`: key id, endpoint id, method, path, extracted resources, decision, upstream status, timestamp.

Secrets:

- Upstream Cloudflare API token is stored as a Worker Secret.
- Proxy key plaintext is shown only once at creation time.
- Stored proxy key material must be hashed.

## Error Handling

The proxy should return Cloudflare-like response envelopes where practical:

```json
{
  "success": false,
  "errors": [{ "code": 10000, "message": "access denied" }],
  "messages": [],
  "result": null
}
```

Recommended status codes:

- `401`: missing or invalid proxy key.
- `403`: key is valid but the grant does not allow the request.
- `404`: endpoint is unsupported or intentionally hidden.
- `422`: endpoint is supported but request validation fails.
- Upstream Cloudflare errors are passed through when the request was authorized.

## Non-Goals

- Full Cloudflare API compatibility.
- Transparent pass-through proxying.
- Account-wide list endpoints without response filtering.
- S3-compatible R2 proxying in the same MVP path.
- User-facing dashboard.
- Automatic creation of upstream Cloudflare API tokens.

## Open Decisions

- Choose Zod or Valibot for validation.
- Decide whether SQL-class restrictions for D1 are included in MVP or deferred.
- Decide the exact first R2 and KV endpoint list after checking Cloudflare API schemas during implementation planning.
- Decide audit retention and redaction rules.
