export interface RawStoredValue {
  readonly content: string;
  readonly versionTag: string;
}

export interface RawWriteOptions {
  /** null means the key must not exist; a string means its version must match. */
  readonly expectedVersionTag: string | null;
}

export interface StorageAdapter {
  read(key: string): Promise<RawStoredValue | null>;
  write(key: string, content: string, options: RawWriteOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface VersionedRecord<T> {
  readonly schemaVersion: number;
  readonly revision: number;
  readonly updatedAt: string;
  readonly value: T;
}

export interface WriteOptions {
  readonly schemaVersion: number;
  readonly expectedRevision?: number;
}

export interface ReadOptions {
  readonly schemaVersion?: number;
}

export interface UpdateOptions<T> {
  readonly schemaVersion: number;
  readonly initialValue: T;
  readonly maxAttempts?: number;
}
