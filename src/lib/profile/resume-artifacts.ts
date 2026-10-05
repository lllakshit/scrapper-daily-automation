import { basename, extname } from "node:path";

import { put } from "@vercel/blob";

import type { UploadedResume } from "./resume";

export interface StoredResumeArtifact {
  readonly blobPath: string;
}

export interface ResumeArtifactStore {
  save(upload: UploadedResume, sha256: string, mediaType: string): Promise<StoredResumeArtifact | null>;
}

function safeFilename(name: string): string {
  const base = basename(name.replaceAll("\\", "/"));
  return base.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "resume";
}

function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export class VercelBlobResumeArtifactStore implements ResumeArtifactStore {
  async save(
    upload: UploadedResume,
    sha256: string,
    mediaType: string,
  ): Promise<StoredResumeArtifact | null> {
    if (!isBlobConfigured()) return null;

    try {
      const extension = extname(upload.name).toLocaleLowerCase();
      const name = safeFilename(upload.name);
      const blobPath = `career-autopilot/resumes/${sha256}${extension || `-${name}`}`;
      await put(blobPath, Buffer.from(upload.bytes), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: mediaType,
      });
      return { blobPath };
    } catch (error) {
      console.error("Failed to store resume artifact in Vercel Blob:", error);
      throw new Error(`Resume upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

export const resumeArtifactStore = new VercelBlobResumeArtifactStore();
