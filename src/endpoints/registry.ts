import type { ResourceRef } from "../policy/types";

export type EndpointDefinition = {
  id: string;
  method: string;
  pattern: RegExp;
  requiredCapability: string;
  extractResources: (match: RegExpMatchArray) => ResourceRef[];
  extractRequestResources?: (request: Request) => Promise<ResourceRef[]>;
  validateRequest?: (request: Request) => Promise<string | null>;
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
  },
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
  },
  {
    id: "r2.temp_access_credentials.create",
    method: "POST",
    pattern: /^\/client\/v4\/accounts\/([^/]+)\/r2\/temp-access-credentials$/,
    requiredCapability: "r2.bucket.object.write",
    extractResources: (match) => [{ type: "account", id: match[1] }],
    extractRequestResources: async (request) => {
      const body = await request.clone().json() as { bucket?: unknown };
      if (typeof body.bucket !== "string" || body.bucket.length === 0) {
        return [];
      }
      return [{ type: "r2_bucket", id: body.bucket }];
    },
    validateRequest: async (request) => {
      const body = await request.clone().json() as {
        bucket?: unknown;
        permission?: unknown;
      };
      if (typeof body.bucket !== "string" || body.bucket.length === 0) {
        return "missing R2 bucket";
      }
      if (body.permission !== "object-read-write") {
        return "R2 temporary credentials must use object-read-write permission";
      }
      return null;
    },
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/r2/temp-access-credentials`
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

export async function collectEndpointResources(
  match: EndpointMatch,
  request: Request
): Promise<ResourceRef[]> {
  if (!match.definition.extractRequestResources) {
    return match.resources;
  }
  const requestResources = await match.definition.extractRequestResources(request);
  return [...match.resources, ...requestResources];
}

export async function validateEndpointRequest(match: EndpointMatch, request: Request): Promise<string | null> {
  if (!match.definition.validateRequest) {
    return null;
  }
  return match.definition.validateRequest(request);
}
