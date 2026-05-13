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
