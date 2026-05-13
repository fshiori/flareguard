import { describe, expect, it } from "vitest";
import { splitProxyKey } from "./key-store";

describe("splitProxyKey", () => {
  it("splits a proxy key into key id and secret", () => {
    expect(splitProxyKey("fgk_abc.def")).toEqual({ keyId: "fgk_abc", secret: "def" });
  });

  it("rejects malformed keys", () => {
    expect(() => splitProxyKey("fgk_abc")).toThrow("invalid proxy key format");
  });
});
