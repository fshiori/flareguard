import { Context, Hono } from "hono";
import { fetchCloudflare } from "./cloudflare/upstream";
import { collectEndpointResources, matchEndpoint, validateEndpointRequest } from "./endpoints/registry";
import type { Env } from "./env";
import { cloudflareErrorBody } from "./http/errors";
import { authenticateProxyKey, listGrantsForKey } from "./keys/key-store";
import { decidePolicy } from "./policy/engine";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

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

  const proxyKeyValue = authorization.slice("Bearer ".length);
  const proxyKey = await authenticateProxyKey(c.env.DB, proxyKeyValue);
  if (!proxyKey) {
    return c.json(cloudflareErrorBody(10002, "invalid proxy key"), 401);
  }

  const account = resources.find((resource) => resource.type === "account");
  if (account && account.id !== proxyKey.accountId) {
    return c.json(cloudflareErrorBody(10003, "account access denied"), 403);
  }

  const grants = await listGrantsForKey(c.env.DB, proxyKey.id);
  const decision = decidePolicy(grants, match.definition.requiredCapability, resources);
  if (!decision.allowed) {
    return c.json(cloudflareErrorBody(10003, "access denied"), 403);
  }

  return fetchCloudflare(c.env.CLOUDFLARE_API_TOKEN, {
    method: c.req.method,
    path: match.upstreamPath,
    search: url.search,
    headers: new Headers(c.req.raw.headers),
    body: c.req.raw.body
  });
};

app.all("/client/v4/*", handleProxyRequest);
app.all("/accounts/*", handleProxyRequest);

export default app;
