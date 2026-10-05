import { describe, expect, it } from "vitest";

import { NormalizedJobSchema } from "@/lib/jobs/schema";
import type { JobMatch, JobScanResult } from "./scan";
import { mergeDiscoveryState, type DiscoveryState } from "./scan-service";

function match(id: string): JobMatch {
  return {
    job: NormalizedJobSchema.parse({
      id,
      source: "test",
      externalId: id,
      canonicalUrl: `https://example.test/jobs/${id}`,
      title: "AI Engineer",
      company: "Acme",
      location: "Remote",
      remoteType: "remote",
      employmentType: "full-time",
      description: `Build reliable AI systems ${id}`,
      requirements: [],
      responsibilities: [],
      skills: ["TypeScript"],
      discoveredAt: "2026-10-04T00:00:00.000Z",
      sources: [{ source: "test", externalId: id, url: `https://example.test/jobs/${id}` }],
      rawSourceData: {},
    }),
    score: 90,
    classification: "excellent",
    reasons: ["Strong match"],
  };
}

function scan(opportunities: readonly JobMatch[]): JobScanResult {
  return {
    opportunities,
    sourceResults: [],
    rejected: [],
    statistics: { discovered: opportunities.length, deduplicated: 0, expired: 0, hardFiltered: 0, previouslySeen: 0, analyzed: opportunities.length, surfaced: opportunities.length, analysisFailures: 0 },
    completedAt: "2026-10-04T00:00:00.000Z",
  };
}

describe("mergeDiscoveryState", () => {
  it("commits visible opportunities and their seen aliases in one immutable state", () => {
    const initial: DiscoveryState = { latest: null, seen: { version: 1, aliases: {} } };
    const next = mergeDiscoveryState(initial, scan([match("one")]));

    expect(next.latest?.opportunities.map(({ job }) => job.id)).toEqual(["one"]);
    expect(next.seen.aliases["source:test:one"]).toBe("2026-10-04T00:00:00.000Z");
    expect(initial).toEqual({ latest: null, seen: { version: 1, aliases: {} } });
  });

  it("keeps the current queue and suppresses a concurrently committed duplicate", () => {
    const first = mergeDiscoveryState(
      { latest: null, seen: { version: 1, aliases: {} } },
      scan([match("one")]),
    );
    const second = mergeDiscoveryState(first, scan([match("one")]));

    expect(second.latest?.opportunities.map(({ job }) => job.id)).toEqual(["one"]);
    expect(second.latest?.statistics.surfaced).toBe(0);
  });
});
