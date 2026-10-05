import { describe, expect, it } from "vitest";

import { createEmptyCareerProfile } from "@/lib/profile/schemas";

import {
  calculateFollowUpDueAt,
  createApplication,
  InvalidApplicationTransitionError,
  prepareApplication,
  transitionApplication,
} from "./domain";
import { GroundingViolationError, type ApplicationDraftProvider } from "./preparation";

const NOW = "2026-10-03T10:00:00.000Z";

function approvedProfile() {
  return {
    ...createEmptyCareerProfile(NOW),
    status: "approved" as const,
    approvedAt: NOW,
    personal: { name: "Lakshit Mathur", email: "lakshit@example.com", location: "India" },
    professional: {
      currentTitle: "AI Engineer",
      yearsOfExperience: 3,
      summary: "Builds production AI systems.",
      targetRoles: ["AI Engineer"],
    },
    skills: {
      languages: ["Python"],
      frontend: [],
      backend: ["FastAPI"],
      databases: [],
      cloud: [],
      devops: ["Docker"],
      aiMl: [],
      llmGenAi: ["LLM integration"],
      tools: [],
    },
    evidence: [
      { id: "ev-1", source: "resume" as const, fieldPath: "skills.backend", excerpt: "FastAPI" },
    ],
  };
}

describe("application lifecycle", () => {
  it("uses explicit immutable transitions and calculates follow-up from submission time", () => {
    const saved = createApplication(
      {
        jobId: "job-1",
        company: "Acme",
        role: "AI Engineer",
        url: "https://example.com/jobs/1",
      },
      NOW,
      "app-1",
    );
    const preparing = transitionApplication(saved, "preparing", "2026-10-03T11:00:00.000Z");
    const ready = transitionApplication(preparing, "ready", "2026-10-03T12:00:00.000Z");
    const applied = transitionApplication(ready, "applied", "2026-10-04T09:00:00.000Z", {
      followUpIntervalDays: 7,
    });

    expect(saved.status).toBe("saved");
    expect(applied.appliedAt).toBe("2026-10-04T09:00:00.000Z");
    expect(applied.followUpDueAt).toBe("2026-10-11T09:00:00.000Z");
    expect(calculateFollowUpDueAt(applied, "2026-10-11T09:00:00.000Z")).toBe(true);
    expect(applied.statusHistory).toHaveLength(4);
  });

  it("rejects skipped or terminal transitions", () => {
    const saved = createApplication(
      { jobId: "job-1", company: "Acme", role: "AI Engineer", url: "https://example.com/1" },
      NOW,
      "app-1",
    );
    expect(() => transitionApplication(saved, "applied", NOW)).toThrow(
      InvalidApplicationTransitionError,
    );
  });
});

describe("grounded application preparation", () => {
  it("prepares from an approved profile without mutating the application", async () => {
    const application = transitionApplication(
      createApplication(
        { jobId: "job-1", company: "Acme", role: "AI Engineer", url: "https://example.com/1" },
        NOW,
        "app-1",
      ),
      "preparing",
      NOW,
    );
    const prepared = await prepareApplication(application, approvedProfile(), undefined, NOW);

    expect(application.preparation).toBeNull();
    expect(prepared.preparation?.resumeRecommendations[0]?.evidenceIds).toContain("ev-1");
    expect(prepared.preparation?.approvedAt).toBeNull();
    expect(prepared.status).toBe("preparing");
  });

  it("rejects provider claims that cite evidence outside the approved profile", async () => {
    const provider: ApplicationDraftProvider = {
      generate: async () => ({
        resumeRecommendations: [
          { content: "Invent a credential", reason: "Looks relevant", evidenceIds: ["fake"] },
        ],
        coverLetter: { content: "Fabricated claim", evidenceIds: ["fake"] },
        applicationAnswers: [],
        keyExperience: [],
        followUpDraft: null,
      }),
    };
    const application = transitionApplication(
      createApplication(
        { jobId: "job-1", company: "Acme", role: "AI Engineer", url: "https://example.com/1" },
        NOW,
        "app-1",
      ),
      "preparing",
      NOW,
    );

    await expect(prepareApplication(application, approvedProfile(), provider, NOW)).rejects.toBeInstanceOf(
      GroundingViolationError,
    );
  });
});
