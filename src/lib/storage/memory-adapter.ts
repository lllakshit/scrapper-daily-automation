import { randomUUID } from "node:crypto";

import { StorageConflictError } from "./store";
import type { RawStoredValue, RawWriteOptions, StorageAdapter } from "./types";

export class InMemoryStorageAdapter implements StorageAdapter {
  private values = new Map<string, RawStoredValue>();

  async read(key: string): Promise<RawStoredValue | null> {
    const value = this.values.get(key);
    return value ? structuredClone(value) : null;
  }

  async write(key: string, content: string, options: RawWriteOptions): Promise<void> {
    const current = this.values.get(key);
    const matches = options.expectedVersionTag === null
      ? !current
      : current?.versionTag === options.expectedVersionTag;
    if (!matches) throw new StorageConflictError();
    const nextValues = new Map(this.values);
    nextValues.set(key, { content, versionTag: randomUUID() });
    this.values = nextValues;
  }

  async delete(key: string): Promise<void> {
    const nextValues = new Map(this.values);
    nextValues.delete(key);
    this.values = nextValues;
  }
}
