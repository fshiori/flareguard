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
