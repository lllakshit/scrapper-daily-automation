import { beforeEach, describe, expect, it, vi } from "vitest";

const blobMocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  BlobPreconditionFailedError: class BlobPreconditionFailedError extends Error {},
  ...blobMocks,
}));

import { BlobPreconditionFailedError } from "@vercel/blob";
import { VercelBlobStorageAdapter } from "./blob-adapter";
import { StorageConflictError } from "./store";

describe("VercelBlobStorageAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads private, uncached JSON", async () => {
    blobMocks.get.mockResolvedValue({
      statusCode: 200,
      stream: new Response('{"ok":true}').body,
      blob: { etag: "etag-1" },
    });
    const adapter = new VercelBlobStorageAdapter();

    await expect(adapter.read("profile")).resolves.toEqual({
      content: '{"ok":true}',
      versionTag: "etag-1",
    });
    expect(blobMocks.get).toHaveBeenCalledWith("career-autopilot/data/profile.json", {
      access: "private",
      useCache: false,
    });
  });

  it("uses ETags for conditional writes and maps conflicts", async () => {
    blobMocks.put.mockResolvedValue({});
    const adapter = new VercelBlobStorageAdapter();
    await adapter.write("profile", "{}", { expectedVersionTag: "etag-1" });
    expect(blobMocks.put).toHaveBeenCalledWith(
      "career-autopilot/data/profile.json",
      "{}",
      expect.objectContaining({ access: "private", ifMatch: "etag-1" }),
    );

    blobMocks.put.mockRejectedValue(new BlobPreconditionFailedError());
    await expect(
      adapter.write("profile", "{}", { expectedVersionTag: "etag-1" }),
    ).rejects.toBeInstanceOf(StorageConflictError);
  });

  it("deletes the scoped blob pathname", async () => {
    blobMocks.del.mockResolvedValue(undefined);
    const adapter = new VercelBlobStorageAdapter("custom-prefix");
    await adapter.delete("profile");
    expect(blobMocks.del).toHaveBeenCalledWith("custom-prefix/profile.json");
  });
});
