import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { StorageConflictError } from "./store";
import type { RawStoredValue, RawWriteOptions, StorageAdapter } from "./types";

function tagFor(content: string): string {
  return createHash("sha256").update(content).digest("base64url");
}

export class FileStorageAdapter implements StorageAdapter {
  private operation = Promise.resolve();

  constructor(private readonly rootDirectory: string) {}

  private pathname(key: string): string {
    return path.join(this.rootDirectory, `${key}.json`);
  }

  private async readUnchecked(key: string): Promise<RawStoredValue | null> {
    try {
      const content = await readFile(this.pathname(key), "utf8");
      return { content, versionTag: tagFor(content) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async read(key: string): Promise<RawStoredValue | null> {
    return this.readUnchecked(key);
  }

  async write(key: string, content: string, options: RawWriteOptions): Promise<void> {
    const pending = this.operation.then(async () => {
      const current = await this.readUnchecked(key);
      const matches = options.expectedVersionTag === null
        ? !current
        : current?.versionTag === options.expectedVersionTag;
      if (!matches) throw new StorageConflictError();

      const destination = this.pathname(key);
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, content, {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      });
      try {
        await rename(temporary, destination);
      } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
      }
    });
    this.operation = pending.catch(() => undefined);
    return pending;
  }

  async delete(key: string): Promise<void> {
    await unlink(this.pathname(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
