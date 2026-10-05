import {
  BlobPreconditionFailedError,
  del,
  get,
  put,
} from "@vercel/blob";

import { StorageConflictError } from "./store";
import type { RawStoredValue, RawWriteOptions, StorageAdapter } from "./types";

export class VercelBlobStorageAdapter implements StorageAdapter {
  constructor(private readonly prefix = "career-autopilot/data") {}

  private pathname(key: string): string {
    return `${this.prefix}/${key}.json`;
  }

  private assertConfigured(): void {
    if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
      throw new Error("BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID is required on Vercel");
    }
  }

  async read(key: string): Promise<RawStoredValue | null> {
    this.assertConfigured();
    const result = await get(this.pathname(key), { access: "private", useCache: false });
    if (!result || result.statusCode === 304 || !result.stream) return null;
    return {
      content: await new Response(result.stream).text(),
      versionTag: result.blob.etag,
    };
  }

  async write(key: string, content: string, options: RawWriteOptions): Promise<void> {
    this.assertConfigured();
    try {
      await put(this.pathname(key), content, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: options.expectedVersionTag !== null,
        contentType: "application/json; charset=utf-8",
        ...(options.expectedVersionTag
          ? { ifMatch: options.expectedVersionTag }
          : {}),
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) {
        throw new StorageConflictError();
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    this.assertConfigured();
    await del(this.pathname(key));
  }
}
