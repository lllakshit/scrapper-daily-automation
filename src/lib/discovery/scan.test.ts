import { describe, expect, it, vi } from "vitest";

import type { JobSourceAdapter } from "../scrapers/types";
import { NormalizedJobSchema, type JobPreferences, type NormalizedJob } from "../jobs/schema";
import { InMemorySeenJobStore } from "../jobs/seen-store";
import { runJobScan, sanitizeScanOpportunities, type JobMatch, type JobMatcher } from "./scan";

const job = (id: string, overrides: Partial<NormalizedJob> = {}): NormalizedJob =>
  NormalizedJobSchema.parse({
    id,
    source: "test",
    externalId: id,
    canonicalUrl: `https://example.test/jobs/${id}`,
    title: "AI Engineer",
    company: "Acme",
    location: "Remote",
    remoteType: "remote",
    employmentType: "full-time",
    description: `Build LLM systems ${id}`,
    requirements: [],
    responsibilities: [],
    skills: ["Python"],
    discoveredAt: "2026-10-03T08:00:00.000Z",
    sources: [{ source: "test", externalId: id, url: `https://example.test/jobs/${id}` }],
    rawSourceData: {},
    ...overrides,
  });

const adapter = (name: string, jobs: NormalizedJob[]): JobSourceAdapter => ({
  name,
  fetchJobs: vi.fn().mockResolvedValue(jobs),
  healthCheck: vi.fn().mockResolvedValue({ healthy: true, checkedAt: "2026-10-03T08:00:00.000Z" }),
});

const preferences: JobPreferences = {
  targetRoles: ["AI Engineer"],
  locations: ["Remote"],
  workModes: ["remote"],
  employmentTypes: ["full-time"],
  yearsOfExperience: 3,
  maxExperienceStretch: 2,
  excludedTerms: [],
};

describe("runJobScan", () => {
  it("continues after a source failure and only marks surfaced strong matches as seen", async () => {
    const good = adapter("good", [job("strong"), job("weak"), job("expired", { expiresAt: "2026-10-01T00:00:00.000Z" })]);
    const failed: JobSourceAdapter = {
      name: "failed",
      fetchJobs: vi.fn().mockRejectedValue(new Error("timeout")),
      healthCheck: vi.fn().mockResolvedValue({ healthy: false, checkedAt: "2026-10-03T08:00:00.000Z" }),
    };
    const matcher: JobMatcher = {
      evaluate: vi.fn(async (candidate): Promise<JobMatch> => ({
        job: candidate,
        score: candidate.id === "strong" ? 88 : 42,
        classification: candidate.id === "strong" ? "strong" : "reject",
        reasons: [],
      })),
    };
    const seenStore = new InMemorySeenJobStore();

    const result = await runJobScan({
      adapters: [failed, good],
      preferences,
      matcher,
      seenStore,
      now: new Date("2026-10-03T08:00:00.000Z"),
      minimumScore: 70,
    });

    expect(result.opportunities.map(({ job: item }) => item.id)).toEqual(["strong"]);
    expect(result.sourceResults.find(({ source }) => source === "failed")?.status).toBe("failed");
    expect(matcher.evaluate).toHaveBeenCalledTimes(2);
    expect(await seenStore.hasAny(["source:test:strong"])).toBe(true);
    expect(await seenStore.hasAny(["source:test:weak"])).toBe(false);
  });
});

describe("sanitizeScanOpportunities", () => {
  it("keeps only active, unique opportunities from a stored projection", () => {
    const active = job("active", {
      title: "AI Engineer",
      company: "Acme",
      description: "Build production LLM systems with Python, FastAPI, and PostgreSQL.",
    });
    const duplicate = job("duplicate", {
      title: "AI Engineer",
      company: "Acme",
      canonicalUrl: "https://jobs.example.test/acme-ai-engineer",
      description: "Build production LLM systems with Python, FastAPI, and PostgreSQL.",
    });
    const expired = job("expired", { expiresAt: "2026-10-01T00:00:00.000Z" });
    const matches: JobMatch[] = [
      { job: duplicate, score: 84, classification: "strong", reasons: ["duplicate copy"] },
      { job: expired, score: 95, classification: "excellent", reasons: ["expired copy"] },
      { job: active, score: 91, classification: "excellent", reasons: ["best active copy"] },
    ];

    const result = sanitizeScanOpportunities(matches, new Date("2026-10-03T08:00:00.000Z"));

    expect(result.map((match) => match.job.id)).toEqual(["active"]);
    expect(matches).toHaveLength(3);
  });
});
