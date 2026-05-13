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

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashProxySecret(secret: string): Promise<string> {
  const encoded = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return `sha256:${toHex(digest)}`;
}

export async function verifyProxySecret(secret: string, expectedHash: string): Promise<boolean> {
  return (await hashProxySecret(secret)) === expectedHash;
}

export type ProxyKeyRecord = {
  id: string;
  accountId: string;
  status: "active" | "revoked";
  expiresAt: string | null;
};

type ProxyKeyRow = {
  id: string;
  account_id: string;
  secret_hash: string;
  status: "active" | "revoked";
  expires_at: string | null;
};

export async function authenticateProxyKey(
  db: D1Database,
  value: string,
  now: Date = new Date()
): Promise<ProxyKeyRecord | null> {
  const parts = splitProxyKey(value);
  const row = await db
    .prepare("SELECT id, account_id, secret_hash, status, expires_at FROM proxy_keys WHERE id = ?")
    .bind(parts.keyId)
    .first<ProxyKeyRow>();

  if (!row || row.status !== "active") {
    return null;
  }

  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) {
    return null;
  }

  if (!(await verifyProxySecret(parts.secret, row.secret_hash))) {
    return null;
  }

  return {
    id: row.id,
    accountId: row.account_id,
    status: row.status,
    expiresAt: row.expires_at
  };
}
