import { areDuplicateJobs, deduplicateJobs } from "../jobs/dedupe";
import { filterExpiredJobs, isExpiredJob } from "../jobs/expiry";
import { applyHardFilters, type HardFilterRejection } from "../jobs/hard-filter";
import { buildJobAliases } from "../jobs/identity";
import type { JobPreferences, NormalizedJob } from "../jobs/schema";
import { suppressSeenJobs, type SeenJobStore } from "../jobs/seen-store";
import type { JobSourceAdapter } from "../scrapers/types";

export type MatchClassification = "excellent" | "strong" | "review" | "reject";

export interface JobMatch {
  readonly job: NormalizedJob;
  readonly score: number;
  readonly classification: MatchClassification;
  readonly reasons: readonly string[];
  readonly strengths?: readonly string[];
  readonly gaps?: readonly string[];
}

export interface JobMatcher {
  evaluate(job: NormalizedJob): Promise<JobMatch>;
}

export interface SourceScanResult {
  readonly source: string;
  readonly status: "healthy" | "failed";
  readonly discovered: number;
  readonly error?: string;
}

export interface ScanStatistics {
  readonly discovered: number;
  readonly deduplicated: number;
  readonly expired: number;
  readonly hardFiltered: number;
  readonly previouslySeen: number;
  readonly analyzed: number;
  readonly surfaced: number;
  readonly analysisFailures: number;
}

export interface JobScanResult {
  readonly opportunities: readonly JobMatch[];
  readonly sourceResults: readonly SourceScanResult[];
  readonly rejected: readonly HardFilterRejection[];
  readonly statistics: ScanStatistics;
  readonly completedAt: string;
}

interface RunJobScanOptions {
  readonly adapters: readonly JobSourceAdapter[];
  readonly preferences: JobPreferences;
  readonly matcher: JobMatcher;
  readonly seenStore: SeenJobStore;
  readonly now?: Date;
  readonly minimumScore?: number;
  /** Defer this when the visible queue and seen ledger must be committed atomically. */
  readonly markSurfacedAsSeen?: boolean;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unknown source error";
}

const CLASSIFICATION_RANK: Record<MatchClassification, number> = {
  excellent: 3,
  strong: 2,
  review: 1,
  reject: 0,
};

function compareMatches(left: JobMatch, right: JobMatch): number {
  return (
    right.score - left.score ||
    CLASSIFICATION_RANK[right.classification] - CLASSIFICATION_RANK[left.classification] ||
    left.job.id.localeCompare(right.job.id)
  );
}

export function sanitizeScanOpportunities(
  opportunities: readonly JobMatch[],
  now: Date = new Date(),
): readonly JobMatch[] {
  return [...opportunities]
    .filter(({ job }) => !isExpiredJob(job, now))
    .sort(compareMatches)
    .reduce((visible, match) => {
      const duplicate = visible.some((candidate) => areDuplicateJobs(candidate.job, match.job));
      return duplicate ? visible : [...visible, match];
    }, [] as JobMatch[]);
}

export async function runJobScan(options: RunJobScanOptions): Promise<JobScanResult> {
  const now = options.now ?? new Date();
  const sourceSettlements = await Promise.allSettled(
    options.adapters.map(async (adapter) => ({ adapter, jobs: await adapter.fetchJobs() })),
  );
  const sourceResults: SourceScanResult[] = sourceSettlements.map((settlement, index) => {
    const source = options.adapters[index]!.name;
    return settlement.status === "fulfilled"
      ? { source, status: "healthy", discovered: settlement.value.jobs.length }
      : { source, status: "failed", discovered: 0, error: errorMessage(settlement.reason) };
  });
  const discoveredJobs = sourceSettlements.flatMap((settlement) =>
    settlement.status === "fulfilled" ? [...settlement.value.jobs] : [],
  );
  const deduplicated = deduplicateJobs(discoveredJobs);
  const active = filterExpiredJobs(deduplicated, now);
  const hardFilter = applyHardFilters(active, options.preferences);
  const seen = await suppressSeenJobs(hardFilter.accepted, options.seenStore);
  const matchSettlements = await Promise.allSettled(
    seen.unseen.map((job) => options.matcher.evaluate(job)),
  );
  const successfulMatches = matchSettlements.flatMap((settlement) =>
    settlement.status === "fulfilled" ? [settlement.value] : [],
  );
  const minimumScore = options.minimumScore ?? 70;
  const opportunities = sanitizeScanOpportunities(
    successfulMatches
    .filter(
      (match) =>
        match.score >= minimumScore &&
        (match.classification === "excellent" || match.classification === "strong"),
    ),
    now,
  );

  const aliases = [...new Set(opportunities.flatMap(({ job }) => buildJobAliases(job)))];
  if (options.markSurfacedAsSeen !== false && aliases.length > 0) {
    await options.seenStore.markSeen(aliases, now.toISOString());
  }

  return {
    opportunities,
    sourceResults,
    rejected: hardFilter.rejected,
    statistics: {
      discovered: discoveredJobs.length,
      deduplicated: discoveredJobs.length - deduplicated.length,
      expired: deduplicated.length - active.length,
      hardFiltered: hardFilter.rejected.length,
      previouslySeen: seen.suppressed.length,
      analyzed: successfulMatches.length,
      surfaced: opportunities.length,
      analysisFailures: matchSettlements.filter(({ status }) => status === "rejected").length,
    },
    completedAt: now.toISOString(),
  };
}
