import type { ResourceRef } from "../policy/types";

export type EndpointDefinition = {
  id: string;
  method: string;
  pattern: RegExp;
  requiredCapability: string;
  authorizationMode?: "proxy_key" | "passthrough";
  filterResponseByGrantResourceType?: string;
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
    id: "workers.script.put.raw",
    method: "PUT",
    pattern: /^\/accounts\/([^/]+)\/workers\/scripts\/([^/]+)$/,
    requiredCapability: "workers.script.update_content",
    extractResources: (match) => [
      { type: "account", id: match[1] },
      { type: "workers_script", id: match[2] }
    ],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/scripts/${match[2]}`
  },
  {
    id: "workers.service.get",
    method: "GET",
    pattern: /^\/client\/v4\/accounts\/([^/]+)\/workers\/services\/([^/]+)$/,
    requiredCapability: "workers.service.read",
    extractResources: (match) => [
      { type: "account", id: match[1] },
      { type: "workers_script", id: match[2] }
    ],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/services/${match[2]}`
  },
  {
    id: "workers.service.get.raw",
    method: "GET",
    pattern: /^\/accounts\/([^/]+)\/workers\/services\/([^/]+)$/,
    requiredCapability: "workers.service.read",
    extractResources: (match) => [
      { type: "account", id: match[1] },
      { type: "workers_script", id: match[2] }
    ],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/services/${match[2]}`
  },
  {
    id: "workers.script.deployments.list",
    method: "GET",
    pattern: /^\/client\/v4\/accounts\/([^/]+)\/workers\/scripts\/([^/]+)\/deployments$/,
    requiredCapability: "workers.script.deployments.read",
    extractResources: (match) => [
      { type: "account", id: match[1] },
      { type: "workers_script", id: match[2] }
    ],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/scripts/${match[2]}/deployments`
  },
  {
    id: "workers.script.deployments.list.raw",
    method: "GET",
    pattern: /^\/accounts\/([^/]+)\/workers\/scripts\/([^/]+)\/deployments$/,
    requiredCapability: "workers.script.deployments.read",
    extractResources: (match) => [
      { type: "account", id: match[1] },
      { type: "workers_script", id: match[2] }
    ],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/scripts/${match[2]}/deployments`
  },
  {
    id: "workers.scripts.list",
    method: "GET",
    pattern: /^\/client\/v4\/accounts\/([^/]+)\/workers\/scripts$/,
    requiredCapability: "workers.script.read",
    filterResponseByGrantResourceType: "workers_script",
    extractResources: (match) => [{ type: "account", id: match[1] }],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/scripts`
  },
  {
    id: "workers.scripts.list.raw",
    method: "GET",
    pattern: /^\/accounts\/([^/]+)\/workers\/scripts$/,
    requiredCapability: "workers.script.read",
    filterResponseByGrantResourceType: "workers_script",
    extractResources: (match) => [{ type: "account", id: match[1] }],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/scripts`
  },
  {
    id: "workers.assets.upload_session.create",
    method: "POST",
    pattern: /^\/client\/v4\/accounts\/([^/]+)\/workers\/scripts\/([^/]+)\/assets-upload-session$/,
    requiredCapability: "workers.assets.upload_session.create",
    extractResources: (match) => [
      { type: "account", id: match[1] },
      { type: "workers_script", id: match[2] }
    ],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/scripts/${match[2]}/assets-upload-session`
  },
  {
    id: "workers.assets.upload_session.create.raw",
    method: "POST",
    pattern: /^\/accounts\/([^/]+)\/workers\/scripts\/([^/]+)\/assets-upload-session$/,
    requiredCapability: "workers.assets.upload_session.create",
    extractResources: (match) => [
      { type: "account", id: match[1] },
      { type: "workers_script", id: match[2] }
    ],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/scripts/${match[2]}/assets-upload-session`
  },
  {
    id: "workers.assets.upload",
    method: "POST",
    pattern: /^\/client\/v4\/accounts\/([^/]+)\/workers\/assets\/upload$/,
    requiredCapability: "workers.assets.upload",
    authorizationMode: "passthrough",
    extractResources: (match) => [{ type: "account", id: match[1] }],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/assets/upload`
  },
  {
    id: "workers.assets.upload.raw",
    method: "POST",
    pattern: /^\/accounts\/([^/]+)\/workers\/assets\/upload$/,
    requiredCapability: "workers.assets.upload",
    authorizationMode: "passthrough",
    extractResources: (match) => [{ type: "account", id: match[1] }],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/assets/upload`
  },
  {
    id: "workers.subdomain.get",
    method: "GET",
    pattern: /^\/client\/v4\/accounts\/([^/]+)\/workers\/subdomain$/,
    requiredCapability: "workers.subdomain.read",
    extractResources: (match) => [{ type: "account", id: match[1] }],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/subdomain`
  },
  {
    id: "workers.subdomain.get.raw",
    method: "GET",
    pattern: /^\/accounts\/([^/]+)\/workers\/subdomain$/,
    requiredCapability: "workers.subdomain.read",
    extractResources: (match) => [{ type: "account", id: match[1] }],
    upstreamPath: (match) => `/client/v4/accounts/${match[1]}/workers/subdomain`
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
        parentAccessKeyId?: unknown;
        permission?: unknown;
      };
      if (typeof body.bucket !== "string" || body.bucket.length === 0) {
        return "missing R2 bucket";
      }
      if (typeof body.parentAccessKeyId !== "string" || body.parentAccessKeyId.length === 0) {
        return "missing R2 parent access key id";
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
