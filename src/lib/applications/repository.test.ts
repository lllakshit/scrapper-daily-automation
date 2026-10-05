import { describe, expect, it } from "vitest";

import { InMemoryStorageAdapter, VersionedJsonStore } from "@/lib/storage";

import { createApplication } from "./domain";
import { StoredApplicationRepository } from "./repository";

describe("StoredApplicationRepository", () => {
  it("persists an immutable versioned collection and enforces expected revisions", async () => {
    const repository = new StoredApplicationRepository(
      new VersionedJsonStore(new InMemoryStorageAdapter()),
    );
    const application = createApplication(
      { jobId: "job-1", company: "Acme", role: "Engineer", url: "https://example.com/1" },
      "2026-10-03T10:00:00.000Z",
      "app-1",
    );
    const created = await repository.save(application, 0);
    const changed = { ...application, notes: "Submitted through company site" };
    const updated = await repository.save(changed, created.revision);

    expect(created.revision).toBe(1);
    expect(updated.revision).toBe(2);
    expect((await repository.findById("app-1"))?.value.notes).toContain("company site");
    await expect(repository.save(application, 1)).rejects.toHaveProperty(
      "name",
      "StorageConflictError",
    );
  });
});
