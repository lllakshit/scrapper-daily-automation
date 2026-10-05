import type {
  ReadOptions,
  StorageAdapter,
  UpdateOptions,
  VersionedRecord,
  WriteOptions,
} from "./types";

const KEY_PATTERN = /^[a-z0-9](?:[a-z0-9/_-]{0,126}[a-z0-9])?$/i;

export class StorageConflictError extends Error {
  constructor(message = "Stored data was changed by another request") {
    super(message);
    this.name = "StorageConflictError";
  }
}

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}

function validateKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes("//") || key.includes("..")) {
    throw new StorageValidationError("Storage key is invalid");
  }
}

function validatePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new StorageValidationError(`${label} must be a positive integer`);
  }
}

function serialize<T>(record: VersionedRecord<T>): string {
  try {
    const value = JSON.stringify(record);
    if (!value) throw new Error("Value is not JSON serializable");
    return value;
  } catch {
    throw new StorageValidationError("Value must be JSON serializable");
  }
}

function parseRecord<T>(content: string): VersionedRecord<T> {
  try {
    const record = JSON.parse(content) as Partial<VersionedRecord<T>>;
    if (
      !record ||
      typeof record !== "object" ||
      !Number.isSafeInteger(record.schemaVersion) ||
      Number(record.schemaVersion) < 1 ||
      !Number.isSafeInteger(record.revision) ||
      Number(record.revision) < 1 ||
      typeof record.updatedAt !== "string" ||
      Number.isNaN(Date.parse(record.updatedAt)) ||
      !("value" in record)
    ) {
      throw new Error("Malformed storage record");
    }
    return structuredClone(record as VersionedRecord<T>);
  } catch (error) {
    if (error instanceof StorageValidationError) throw error;
    throw new StorageValidationError("Stored JSON record is malformed");
  }
}

export class VersionedJsonStore {
  constructor(private readonly adapter: StorageAdapter) {}

  async read<T>(key: string, options: ReadOptions = {}): Promise<VersionedRecord<T> | null> {
    validateKey(key);
    const stored = await this.adapter.read(key);
    if (!stored) return null;
    const record = parseRecord<T>(stored.content);
    if (options.schemaVersion && record.schemaVersion !== options.schemaVersion) {
      throw new StorageValidationError(
        `Unsupported schema version ${record.schemaVersion} for ${key}`,
      );
    }
    return record;
  }

  async write<T>(
    key: string,
    value: T,
    options: WriteOptions,
  ): Promise<VersionedRecord<T>> {
    validateKey(key);
    validatePositiveInteger(options.schemaVersion, "Schema version");
    if (options.expectedRevision !== undefined && options.expectedRevision < 0) {
      throw new StorageValidationError("Expected revision cannot be negative");
    }

    const currentRaw = await this.adapter.read(key);
    const current = currentRaw ? parseRecord<unknown>(currentRaw.content) : null;
    if (
      options.expectedRevision !== undefined &&
      options.expectedRevision !== (current?.revision ?? 0)
    ) {
      throw new StorageConflictError();
    }

    const candidate = {
      schemaVersion: options.schemaVersion,
      revision: (current?.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      value,
    };
    const content = serialize(candidate);
    const next = Object.freeze(parseRecord<T>(content));
    await this.adapter.write(key, content, {
      expectedVersionTag: currentRaw?.versionTag ?? null,
    });
    return structuredClone(next);
  }

  async update<T>(
    key: string,
    options: UpdateOptions<T>,
    updater: (current: Readonly<T>) => T | Promise<T>,
  ): Promise<VersionedRecord<T>> {
    const maxAttempts = options.maxAttempts ?? 3;
    validatePositiveInteger(maxAttempts, "Maximum attempts");
    let lastConflict: StorageConflictError | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const current = await this.read<T>(key, { schemaVersion: options.schemaVersion });
      const currentValue = structuredClone(current?.value ?? options.initialValue);
      const nextValue = await updater(currentValue);
      try {
        return await this.write(key, nextValue, {
          schemaVersion: options.schemaVersion,
          expectedRevision: current?.revision ?? 0,
        });
      } catch (error) {
        if (!(error instanceof StorageConflictError)) throw error;
        lastConflict = error;
      }
    }
    throw lastConflict ?? new StorageConflictError();
  }

  async delete(key: string): Promise<void> {
    validateKey(key);
    await this.adapter.delete(key);
  }
}
