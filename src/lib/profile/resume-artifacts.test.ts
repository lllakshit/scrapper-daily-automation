import { beforeEach, describe, expect, it, vi } from "vitest";

const blobMocks = vi.hoisted(() => ({
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => blobMocks);

import { VercelBlobResumeArtifactStore } from "./resume-artifacts";

const upload = {
  name: "Lakshit Mathur Resume[1].pdf",
  type: "application/pdf",
  bytes: new TextEncoder().encode("%PDF-1.7 sample"),
};

describe("VercelBlobResumeArtifactStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("skips artifact storage when Blob credentials are not configured", async () => {
    const store = new VercelBlobResumeArtifactStore();

    await expect(store.save(upload, "a".repeat(64), "application/pdf")).resolves.toBeNull();
    expect(blobMocks.put).not.toHaveBeenCalled();
  });

  it("stores resumes in private Blob storage with deterministic paths", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    blobMocks.put.mockResolvedValue({ pathname: "career-autopilot/resumes/file.pdf" });
    const store = new VercelBlobResumeArtifactStore();

    await expect(store.save(upload, "a".repeat(64), "application/pdf")).resolves.toEqual({
      blobPath: `career-autopilot/resumes/${"a".repeat(64)}.pdf`,
    });
    expect(blobMocks.put).toHaveBeenCalledWith(
      `career-autopilot/resumes/${"a".repeat(64)}.pdf`,
      Buffer.from(upload.bytes),
      expect.objectContaining({
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/pdf",
      }),
    );
  });
});
