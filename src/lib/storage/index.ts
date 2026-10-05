import path from "node:path";

import { VercelBlobStorageAdapter } from "./blob-adapter";
import { FileStorageAdapter } from "./file-adapter";
import { InMemoryStorageAdapter } from "./memory-adapter";
import { VersionedJsonStore } from "./store";

export type {
  ReadOptions,
  UpdateOptions,
  VersionedRecord,
  WriteOptions,
} from "./types";
export {
  StorageConflictError,
  StorageValidationError,
  VersionedJsonStore,
} from "./store";
export { FileStorageAdapter } from "./file-adapter";
export { InMemoryStorageAdapter } from "./memory-adapter";
export { VercelBlobStorageAdapter } from "./blob-adapter";

declare global {
  var careerAutopilotJsonStore: VersionedJsonStore | undefined;
}

function createDefaultStore(): VersionedJsonStore {
  if (process.env.NODE_ENV === "test") {
    return new VersionedJsonStore(new InMemoryStorageAdapter());
  }
  if (process.env.VERCEL === "1") {
    if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
      return new VersionedJsonStore(new VercelBlobStorageAdapter());
    }
    return new VersionedJsonStore(new InMemoryStorageAdapter());
  }
  const directory = process.env.APP_DATA_DIRECTORY
    ? path.resolve(process.env.APP_DATA_DIRECTORY)
    : path.join(process.cwd(), ".data");
  return new VersionedJsonStore(new FileStorageAdapter(directory));
}

export function getJsonStore(): VersionedJsonStore {
  if (!globalThis.careerAutopilotJsonStore) {
    globalThis.careerAutopilotJsonStore = createDefaultStore();
  }
  return globalThis.careerAutopilotJsonStore;
}
