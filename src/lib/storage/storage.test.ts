import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FileStorageAdapter } from "./file-adapter";
import { InMemoryStorageAdapter } from "./memory-adapter";
import {
  StorageConflictError,
  StorageValidationError,
  VersionedJsonStore,
} from "./store";

describe("VersionedJsonStore", () => {
  it("writes immutable values and increments revisions", async () => {
    const store = new VersionedJsonStore(new InMemoryStorageAdapter());
    const source = { tags: ["typescript"] };

    const first = await store.write("preferences", source, { schemaVersion: 1 });
    source.tags.push("mutated later");
    const second = await store.write(
      "preferences",
      { tags: ["typescript", "nextjs"] },
      { schemaVersion: 1, expectedRevision: first.revision },
    );

    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);
    await expect(store.read("preferences")).resolves.toMatchObject({
      value: { tags: ["typescript", "nextjs"] },
    });
  });

  it("prevents lost updates with optimistic revision checks", async () => {
    const store = new VersionedJsonStore(new InMemoryStorageAdapter());
    await store.write("profile", { name: "Lakshit" }, { schemaVersion: 1 });

    await expect(
      store.write(
        "profile",
        { name: "Someone else" },
        { schemaVersion: 1, expectedRevision: 0 },
      ),
    ).rejects.toBeInstanceOf(StorageConflictError);
  });

  it("rejects traversal keys and incompatible schema versions", async () => {
    const store = new VersionedJsonStore(new InMemoryStorageAdapter());

    await expect(
      store.write("../secret", {}, { schemaVersion: 1 }),
    ).rejects.toBeInstanceOf(StorageValidationError);
    await store.write("profile", {}, { schemaVersion: 2 });
    await expect(store.read("profile", { schemaVersion: 1 })).rejects.toBeInstanceOf(
      StorageValidationError,
    );
  });

  it("updates from an initial value without mutating the previous record", async () => {
    const store = new VersionedJsonStore(new InMemoryStorageAdapter());
    const result = await store.update(
      "seen-jobs",
      { schemaVersion: 1, initialValue: { ids: [] as string[] } },
      (current) => ({ ids: [...current.ids, "job-1"] }),
    );

    expect(result).toMatchObject({ revision: 1, value: { ids: ["job-1"] } });
  });

  it("persists records through the development file adapter", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "career-store-"));
    try {
      const store = new VersionedJsonStore(new FileStorageAdapter(directory));
      await store.write("profile/current", { name: "Lakshit" }, { schemaVersion: 1 });

      const reloaded = new VersionedJsonStore(new FileStorageAdapter(directory));
      await expect(reloaded.read("profile/current")).resolves.toMatchObject({
        revision: 1,
        value: { name: "Lakshit" },
      });
      await reloaded.delete("profile/current");
      await expect(reloaded.read("profile/current")).resolves.toBeNull();
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
