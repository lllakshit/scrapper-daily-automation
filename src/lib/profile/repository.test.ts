import { beforeEach, describe, expect, it } from "vitest";

import { StoredProfileRepository } from "./repository";
import { createEmptyCareerProfile } from "./schemas";

describe("stored profile repository", () => {
  beforeEach(() => {
    globalThis.careerAutopilotJsonStore = undefined;
  });

  it("round-trips schema-validated profile and preference records", async () => {
    const repository = new StoredProfileRepository();
    const profile = createEmptyCareerProfile("2026-10-03T10:00:00.000Z");
    const writtenProfile = await repository.writeProfile(profile, 0);
    const preferences = {
      targetRoles: ["AI Engineer"],
      locations: ["Remote"],
      workModes: ["remote" as const],
      employmentTypes: ["full-time" as const],
      preferredMinimumSalary: 1_000_000,
      salaryCurrency: "INR" as const,
    };
    const writtenPreferences = await repository.writePreferences(preferences, 0);

    expect(writtenProfile.revision).toBe(1);
    expect(writtenPreferences.revision).toBe(1);
    expect((await repository.readProfile())?.value).toEqual(profile);
    expect((await repository.readPreferences())?.value).toEqual(preferences);
  });
});
