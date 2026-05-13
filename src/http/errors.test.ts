import { describe, expect, it } from "vitest";
import { cloudflareErrorBody } from "./errors";

describe("cloudflareErrorBody", () => {
  it("builds a Cloudflare-like error envelope", () => {
    expect(cloudflareErrorBody(10000, "access denied")).toEqual({
      success: false,
      errors: [{ code: 10000, message: "access denied" }],
      messages: [],
      result: null
    });
  });
});
