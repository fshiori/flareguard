import { Context, Hono } from "hono";
import { fetchCloudflare } from "./cloudflare/upstream";
import { collectEndpointResources, matchEndpoint, validateEndpointRequest } from "./endpoints/registry";
import type { Env } from "./env";
import { cloudflareErrorBody } from "./http/errors";
import { authenticateProxyKey, listGrantsForKey } from "./keys/key-store";
import { decidePolicy } from "./policy/engine";
import type { Grant } from "./policy/types";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

function grantedResourceIds(grants: Grant[], capability: string, resourceType: string): Set<string> {
  return new Set(
    grants
      .filter((grant) => grant.capability === capability && grant.resourceType === resourceType)
      .map((grant) => grant.resourceId)
  );
}

function resourceIdFromResultItem(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const candidate = item as { id?: unknown; name?: unknown; script_name?: unknown };
  for (const value of [candidate.id, candidate.name, candidate.script_name]) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

async function filterCloudflareListResponse(response: Response, allowedResourceIds: Set<string>): Promise<Response> {
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return response;
  }

  if (!body || typeof body !== "object" || !Array.isArray((body as { result?: unknown }).result)) {
    return response;
  }

  const envelope = body as {
    result: unknown[];
    result_info?: {
      count?: unknown;
      total_count?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  const result = envelope.result.filter((item) => {
    const id = resourceIdFromResultItem(item);
    return id !== null && allowedResourceIds.has(id);
  });
  const filteredEnvelope = { ...envelope, result };
  if (envelope.result_info && typeof envelope.result_info === "object") {
    filteredEnvelope.result_info = {
      ...envelope.result_info,
      count: result.length,
      total_count: result.length
    };
  }

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return new Response(JSON.stringify(filteredEnvelope), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

const handleProxyRequest = async (c: Context<{ Bindings: Env }>) => {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return c.json(cloudflareErrorBody(10001, "missing proxy key"), 401);
  }

  const url = new URL(c.req.url);
  const match = matchEndpoint(c.req.method, url.pathname);
  if (!match) {
    return c.json(cloudflareErrorBody(10004, "unsupported endpoint"), 404);
  }

  const validationError = await validateEndpointRequest(match, c.req.raw);
  if (validationError) {
    return c.json(cloudflareErrorBody(10005, validationError), 422);
  }

  const resources = await collectEndpointResources(match, c.req.raw);
  const bearerValue = authorization.slice("Bearer ".length);
  const passThroughAuthorization = match.definition.authorizationMode === "passthrough" && !bearerValue.startsWith("fgk_")
    ? authorization
    : null;
  let filterResourceIds: Set<string> | null = null;

  if (!passThroughAuthorization) {
    const proxyKey = await authenticateProxyKey(c.env.DB, bearerValue);
    if (!proxyKey) {
      return c.json(cloudflareErrorBody(10002, "invalid proxy key"), 401);
    }

    const account = resources.find((resource) => resource.type === "account");
    if (account && account.id !== proxyKey.accountId) {
      return c.json(cloudflareErrorBody(10003, "account access denied"), 403);
    }

    const grants = await listGrantsForKey(c.env.DB, proxyKey.id);
    if (match.definition.filterResponseByGrantResourceType) {
      filterResourceIds = grantedResourceIds(
        grants,
        match.definition.requiredCapability,
        match.definition.filterResponseByGrantResourceType
      );
      if (filterResourceIds.size === 0) {
        return c.json(cloudflareErrorBody(10003, "access denied"), 403);
      }
    } else {
      const decision = decidePolicy(grants, match.definition.requiredCapability, resources);
      if (!decision.allowed) {
        return c.json(cloudflareErrorBody(10003, "access denied"), 403);
      }
    }
  } else {
    const account = resources.find((resource) => resource.type === "account");
    if (!account) {
      return c.json(cloudflareErrorBody(10003, "access denied"), 403);
    }
  }

  const upstreamResponse = await fetchCloudflare(c.env.CLOUDFLARE_API_TOKEN, {
    method: c.req.method,
    path: match.upstreamPath,
    search: url.search,
    headers: new Headers(c.req.raw.headers),
    body: c.req.raw.body,
    authorization: passThroughAuthorization ?? undefined
  });
  if (filterResourceIds) {
    return filterCloudflareListResponse(upstreamResponse, filterResourceIds);
  }
  return upstreamResponse;
};

app.all("/client/v4/*", handleProxyRequest);
app.all("/accounts/*", handleProxyRequest);

export default app;
