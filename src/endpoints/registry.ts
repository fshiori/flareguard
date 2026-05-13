import type { ResourceRef } from "../policy/types";

export type EndpointDefinition = {
  id: string;
  method: string;
  pattern: RegExp;
  requiredCapability: string;
  extractResources: (match: RegExpMatchArray) => ResourceRef[];
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
