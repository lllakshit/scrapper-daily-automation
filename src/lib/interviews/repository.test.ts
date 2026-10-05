import { describe, expect, it } from "vitest";

import { InMemoryStorageAdapter, VersionedJsonStore } from "@/lib/storage";

import { createInterviewWorkspace } from "./domain";
import { StoredInterviewRepository } from "./repository";

describe("StoredInterviewRepository", () => {
  it("upserts one workspace per application in versioned storage", async () => {
    const repository = new StoredInterviewRepository(
      new VersionedJsonStore(new InMemoryStorageAdapter()),
    );
    const workspace = await createInterviewWorkspace(
      { applicationId: "app-1", company: "Acme", role: "Engineer", evidence: [] },
      undefined,
      "2026-10-03T10:00:00.000Z",
      "interview-1",
    );
    await repository.save(workspace, 0);
    const replacement = { ...workspace, scheduledAt: "2026-10-10T10:00:00.000Z" };
    const saved = await repository.save(replacement, 1);

    expect(saved.value.interviews).toHaveLength(1);
    expect((await repository.findByApplicationId("app-1"))?.value.scheduledAt).toBe(
      "2026-10-10T10:00:00.000Z",
    );
  });
});
