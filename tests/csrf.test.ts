import { describe, expect, it } from "vitest";
import { CsrfConfigurationError, parseAllowedOrigins } from "../lib/http/csrf";

describe("CSRF allowed origins", () => {
  it("normalizes an explicit comma-separated origin allowlist", () => {
    expect(parseAllowedOrigins("https://careers.example, https://admin.example/path")).toEqual([
      "https://careers.example",
      "https://admin.example",
    ]);
  });

  it("rejects malformed production configuration rather than accepting it as a host fallback", () => {
    expect(() => parseAllowedOrigins("not an origin")).toThrow(CsrfConfigurationError);
  });
});
