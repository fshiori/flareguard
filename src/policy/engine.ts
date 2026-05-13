import type { Grant, PolicyDecision, ResourceRef } from "./types";

export function isGrantAllowed(
  grant: Grant,
  capability: string,
  resources: ResourceRef[]
): boolean {
  return (
    grant.capability === capability &&
    resources.some((resource) => resource.type === grant.resourceType && resource.id === grant.resourceId)
  );
}

export function decidePolicy(
  grants: Grant[],
  capability: string,
  resources: ResourceRef[]
): PolicyDecision {
  const grant = grants.find((candidate) => isGrantAllowed(candidate, capability, resources));
  if (!grant) {
    return { allowed: false, reason: "no matching grant" };
  }
  return { allowed: true, grant };
}
