export type ResourceRef = {
  type: string;
  id: string;
};

export type Grant = {
  id: string;
  keyId: string;
  capability: string;
  resourceType: string;
  resourceId: string;
  constraints: Record<string, unknown>;
};

export type PolicyDecision =
  | { allowed: true; grant: Grant }
  | { allowed: false; reason: string };
