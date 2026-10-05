import { describe, expect, it } from "vitest";
import { createDeterministicMatcher } from "./deterministic-matcher";
import { NormalizedJobSchema, type JobPreferences } from "@/lib/jobs/schema";

const preferences: JobPreferences = {
  targetRoles: ["AI Engineer", "AI Developer", "GenAI Engineer", "LLM Engineer", "Full Stack AI Engineer", "Automation Engineer"],
  locations: ["Jaipur", "Remote", "India"],
  workModes: ["remote", "hybrid"],
  employmentTypes: ["full-time", "contract"],
  yearsOfExperience: 3,
  maxExperienceStretch: 2,
  excludedTerms: [],
  minimumSalary: 1_000_000,
  salaryCurrency: "INR",
};

function job(overrides: Record<string, unknown> = {}) {
  return NormalizedJobSchema.parse({
    id: "source:1", source: "source", externalId: "1", canonicalUrl: "https://example.com/jobs/1",
    title: "AI Engineer", company: "Example", location: "Remote", remoteType: "remote", employmentType: "full-time",
    description: "Build production LLM applications with Python, FastAPI, Docker and PostgreSQL.", requirements: [], responsibilities: [],
    skills: ["Python", "FastAPI", "Docker", "PostgreSQL", "LLM"], discoveredAt: "2026-10-03T00:00:00.000Z",
    status: "active", sources: [{ source: "source", externalId: "1", url: "https://example.com/jobs/1" }], rawSourceData: {}, ...overrides,
  });
}

describe("deterministic job matcher", () => {
  it("classifies a relevant role with matching location and skills as strong", async () => {
    const result = await createDeterministicMatcher(preferences).evaluate(job());
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(["strong", "excellent"]).toContain(result.classification);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("does not award a strong score to a severe experience mismatch", async () => {
    const result = await createDeterministicMatcher(preferences).evaluate(job({ experienceMin: 10 }));
    expect(result.score).toBeLessThan(70);
    expect(result.classification).toBe("reject");
  });
});
