import type { Grant } from "../policy/types";

export type ProxyKeyParts = {
  keyId: string;
  secret: string;
};

export function splitProxyKey(value: string): ProxyKeyParts {
  const [keyId, secret, extra] = value.split(".");
  if (!keyId || !secret || extra !== undefined) {
    throw new Error("invalid proxy key format");
  }
  return { keyId, secret };
}

type GrantRow = {
  id: string;
  key_id: string;
  capability: string;
  resource_type: string;
  resource_id: string;
  constraints_json: string;
};

export function normalizeGrantRow(row: GrantRow): Grant {
  return {
    id: row.id,
    keyId: row.key_id,
    capability: row.capability,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    constraints: JSON.parse(row.constraints_json) as Record<string, unknown>
  };
}
