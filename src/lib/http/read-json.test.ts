import { describe, expect, it } from "vitest";

import { readJsonBody } from "./read-json";

describe("readJsonBody", () => {
  it("parses a bounded JSON request", async () => {
    const request = new Request("https://career.example.com/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });

    await expect(readJsonBody(request, 1_024)).resolves.toEqual({ ok: true });
  });

  it("rejects an oversized declared body before reading it", async () => {
    const request = new Request("https://career.example.com/api/test", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "2048" },
      body: "{}",
    });

    await expect(readJsonBody(request, 1_024)).rejects.toMatchObject({
      status: 413,
      code: "BODY_TOO_LARGE",
    });
  });

  it("stops a chunked body once the byte limit is exceeded", async () => {
    const request = new Request("https://career.example.com/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(2_000) }),
    });

    await expect(readJsonBody(request, 128)).rejects.toMatchObject({
      status: 413,
      code: "BODY_TOO_LARGE",
    });
  });
});
