import { describe, expect, it } from "vitest";

import { canonicalizeJobUrl } from "./canonical-url";
import { deduplicateJobs } from "./dedupe";
import { filterExpiredJobs, isExpiredJob } from "./expiry";
import { applyHardFilters } from "./hard-filter";
import { buildJobAliases } from "./identity";
import { NormalizedJobSchema, type JobPreferences, type NormalizedJob } from "./schema";
import {
  InMemorySeenJobStore,
  PersistentSeenJobStore,
  suppressSeenJobs,
  type SeenJobState,
} from "./seen-store";

const makeJob = (overrides: Partial<NormalizedJob> = {}): NormalizedJob =>
  NormalizedJobSchema.parse({
    id: "arbeitnow:1",
    source: "arbeitnow",
    externalId: "1",
    canonicalUrl: "https://example.com/jobs/1",
    title: "AI Engineer",
    company: "Acme Labs",
    location: "Remote, India",
    remoteType: "remote",
    employmentType: "full-time",
    description: "Build production Python and LLM systems with FastAPI and PostgreSQL.",
    requirements: ["Python", "FastAPI"],
    responsibilities: ["Build AI systems"],
    skills: ["Python", "FastAPI", "PostgreSQL"],
    postedAt: "2026-09-28T10:00:00.000Z",
    discoveredAt: "2026-10-03T08:00:00.000Z",
    sources: [{ source: "arbeitnow", externalId: "1", url: "https://example.com/jobs/1" }],
    rawSourceData: {},
    ...overrides,
  });

describe("canonicalizeJobUrl", () => {
  it("removes tracking parameters, fragments, default ports, and trailing slashes", () => {
    expect(
      canonicalizeJobUrl(
        "HTTPS://Example.COM:443/jobs/42/?utm_source=feed&ref=linkedin&keep=yes#apply",
      ),
    ).toBe("https://example.com/jobs/42?keep=yes");
  });

  it("rejects non-web URL protocols", () => {
    expect(() => canonicalizeJobUrl("javascript:alert(1)")).toThrow("HTTP or HTTPS");
  });
});

describe("expiry filtering", () => {
  it("removes jobs expired at or before the scan time without mutating input", () => {
    const active = makeJob({ id: "active", expiresAt: "2026-10-04T00:00:00.000Z" });
    const expired = makeJob({ id: "expired", expiresAt: "2026-10-03T08:00:00.000Z" });
    const input = [active, expired];

    expect(filterExpiredJobs(input, new Date("2026-10-03T08:00:00.000Z"))).toEqual([active]);
    expect(input).toHaveLength(2);
    expect(isExpiredJob(makeJob({ status: "closed" }), new Date())).toBe(true);
  });
});

describe("deduplicateJobs", () => {
  it("merges cross-source copies deterministically and preserves all source aliases", () => {
    const one = makeJob();
    const two = makeJob({
      id: "remotive:99",
      source: "remotive",
      externalId: "99",
      canonicalUrl: "https://jobs.acme.test/ai-engineer?utm_source=remotive",
      description: "Build production Python & LLM systems with FastAPI and PostgreSQL.",
      sources: [
        { source: "remotive", externalId: "99", url: "https://jobs.acme.test/ai-engineer" },
      ],
    });

    const forward = deduplicateJobs([one, two]);
    const reverse = deduplicateJobs([two, one]);

    expect(forward).toEqual(reverse);
    expect(forward).toHaveLength(1);
    expect(forward[0]?.sources.map(({ source }) => source).sort()).toEqual([
      "arbeitnow",
      "remotive",
    ]);
  });
});

describe("hard filters", () => {
  const preferences: JobPreferences = {
    targetRoles: ["AI Engineer", "LLM Engineer"],
    locations: ["India", "Remote"],
    workModes: ["remote", "hybrid"],
    employmentTypes: ["full-time"],
    yearsOfExperience: 3,
    maxExperienceStretch: 2,
    excludedTerms: ["unpaid"],
  };

  it("accepts a matching role and rejects deterministic mismatches with reasons", () => {
    const accepted = makeJob();
    const roleMismatch = makeJob({ id: "sales", title: "Account Executive" });
    const tooSenior = makeJob({ id: "staff", experienceMin: 8 });
    const result = applyHardFilters([accepted, roleMismatch, tooSenior], preferences);

    expect(result.accepted).toEqual([accepted]);
    expect(result.rejected.map(({ reasons }) => reasons[0])).toEqual([
      "role_mismatch",
      "experience_mismatch",
    ]);
  });
});

describe("seen suppression", () => {
  it("suppresses renamed and cross-posted jobs using durable identity aliases", async () => {
    const seen = makeJob();
    const renamed = makeJob({
      id: "remotive:new-id",
      source: "remotive",
      externalId: "new-id",
      canonicalUrl: "https://new.example/jobs/platform-ai",
      sources: [
        { source: "remotive", externalId: "new-id", url: "https://new.example/jobs/platform-ai" },
      ],
    });
    const store = new InMemorySeenJobStore();
    await store.markSeen(buildJobAliases(seen), "2026-10-01T00:00:00.000Z");

    const result = await suppressSeenJobs([renamed], store);
    expect(result.unseen).toEqual([]);
    expect(result.suppressed).toEqual([renamed]);
  });

  it("persists aliases as immutable versioned state", async () => {
    let state: SeenJobState | null = null;
    const store = new PersistentSeenJobStore({
      read: async () => state,
      write: async (next) => {
        state = next;
      },
    });

    await store.markSeen(["source:test:1"], "2026-10-03T00:00:00.000Z");
    await store.markSeen(["url:https://example.test/1"], "2026-10-03T01:00:00.000Z");

    expect(state).toEqual({
      version: 1,
      aliases: {
        "source:test:1": "2026-10-03T00:00:00.000Z",
        "url:https://example.test/1": "2026-10-03T01:00:00.000Z",
      },
    });
  });
});
