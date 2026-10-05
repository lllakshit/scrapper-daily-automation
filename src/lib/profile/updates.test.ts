import { describe, expect, it } from "vitest";

import {
  approveCareerProfile,
  updateCareerPreferences,
  updateCareerProfile,
} from "./updates";
import { createEmptyCareerProfile } from "./schemas";

describe("immutable profile updates", () => {
  it("returns a new draft and preserves untouched nested state", () => {
    const original = {
      ...createEmptyCareerProfile("2026-10-03T10:00:00.000Z"),
      status: "approved" as const,
      approvedAt: "2026-10-03T10:05:00.000Z",
      personal: { name: "Asha", email: "person@example.com", location: "Jaipur" },
      professional: {
        currentTitle: "Developer",
        yearsOfExperience: 2,
        summary: "Builds useful products.",
        targetRoles: ["AI Engineer"],
      },
    };

    const updated = updateCareerProfile(
      original,
      { personal: { location: "Remote, India" } },
      "2026-10-03T11:00:00.000Z",
    );

    expect(updated).not.toBe(original);
    expect(updated.personal).not.toBe(original.personal);
    expect(updated.professional).toEqual(original.professional);
    expect(updated.professional).not.toBe(original.professional);
    expect(updated.personal.location).toBe("Remote, India");
    expect(original.personal.location).toBe("Jaipur");
    expect(updated.status).toBe("draft");
    expect(updated.approvedAt).toBeNull();
  });

  it("only approves complete profiles", () => {
    const incomplete = createEmptyCareerProfile("2026-10-03T10:00:00.000Z");
    expect(() => approveCareerProfile(incomplete, "2026-10-03T11:00:00.000Z")).toThrow();

    const complete = updateCareerProfile(
      incomplete,
      {
        personal: { name: "Asha" },
        professional: { targetRoles: ["AI Engineer"] },
      },
      "2026-10-03T10:30:00.000Z",
    );
    expect(approveCareerProfile(complete, "2026-10-03T11:00:00.000Z").status).toBe(
      "approved",
    );
  });
});

describe("immutable preference updates", () => {
  it("does not mutate array values", () => {
    const original = {
      targetRoles: ["AI Engineer"],
      locations: ["Jaipur"],
      workModes: ["hybrid" as const],
      employmentTypes: ["full-time" as const],
      preferredMinimumSalary: 1_000_000,
      salaryCurrency: "INR" as const,
    };

    const updated = updateCareerPreferences(original, { locations: ["Remote"] });
    updated.locations.push("India");

    expect(original.locations).toEqual(["Jaipur"]);
  });
});
