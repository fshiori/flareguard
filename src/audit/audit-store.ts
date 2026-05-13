import type { ResourceRef } from "../policy/types";

export type AuditEvent = {
  id: string;
  keyId: string | null;
  endpointId: string;
  method: string;
  path: string;
  resources: ResourceRef[];
  decision: "allow" | "deny";
  upstreamStatus: number | null;
};

export function auditEventParams(event: AuditEvent): unknown[] {
  return [
    event.id,
    event.keyId,
    event.endpointId,
    event.method,
    event.path,
    JSON.stringify(event.resources),
    event.decision,
    event.upstreamStatus
  ];
}

export async function writeAuditEvent(db: D1Database, event: AuditEvent): Promise<void> {
  await db.prepare(
    `INSERT INTO audit_events
      (id, key_id, endpoint_id, method, path, resources_json, decision, upstream_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(...auditEventParams(event)).run();
}
