import { describe, expect, it } from "vitest";

import {
  CareerPreferencesSchema,
  CareerProfileSchema,
  createEmptyCareerProfile,
} from "./schemas";

describe("career profile schema", () => {
  it("creates a schema-valid draft without inventing experience", () => {
    const profile = createEmptyCareerProfile("2026-10-03T10:00:00.000Z");

    expect(CareerProfileSchema.parse(profile)).toEqual(profile);
    expect(profile.status).toBe("draft");
    expect(profile.experience).toEqual([]);
    expect(profile.projects).toEqual([]);
  });

  it("rejects an approved profile without a name or target role", () => {
    const profile = {
      ...createEmptyCareerProfile("2026-10-03T10:00:00.000Z"),
      status: "approved",
      approvedAt: "2026-10-03T10:10:00.000Z",
    };

    expect(() => CareerProfileSchema.parse(profile)).toThrow();
  });
});

describe("career preferences schema", () => {
  it("requires actionable role, location, work mode and employment choices", () => {
    const result = CareerPreferencesSchema.safeParse({
      targetRoles: [],
      locations: [],
      workModes: [],
      employmentTypes: [],
      preferredMinimumSalary: null,
      salaryCurrency: "INR",
    });

    expect(result.success).toBe(false);
  });

  it("normalizes duplicate and padded choices", () => {
    const preferences = CareerPreferencesSchema.parse({
      targetRoles: [" AI Engineer ", "AI Engineer", "LLM Engineer"],
      locations: ["Remote", " remote "],
      workModes: ["remote"],
      employmentTypes: ["full-time"],
      preferredMinimumSalary: 1_000_000,
      salaryCurrency: "INR",
    });

    expect(preferences.targetRoles).toEqual(["AI Engineer", "LLM Engineer"]);
    expect(preferences.locations).toEqual(["Remote"]);
  });
});
