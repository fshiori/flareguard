import { describe, expect, it } from "vitest";
import { normalizeGrantRow, splitProxyKey } from "./key-store";

describe("splitProxyKey", () => {
  it("splits a proxy key into key id and secret", () => {
    expect(splitProxyKey("fgk_abc.def")).toEqual({ keyId: "fgk_abc", secret: "def" });
  });

  it("rejects malformed keys", () => {
    expect(() => splitProxyKey("fgk_abc")).toThrow("invalid proxy key format");
  });
});

describe("normalizeGrantRow", () => {
  it("parses constraints JSON", () => {
    expect(normalizeGrantRow({
      id: "grant_1",
      key_id: "fgk_123",
      capability: "kv.namespace.write",
      resource_type: "kv_namespace",
      resource_id: "ns_1",
      constraints_json: "{\"prefixes\":[\"tenant-a:\"]}"
    })).toEqual({
      id: "grant_1",
      keyId: "fgk_123",
      capability: "kv.namespace.write",
      resourceType: "kv_namespace",
      resourceId: "ns_1",
      constraints: { prefixes: ["tenant-a:"] }
    });
  });
});
