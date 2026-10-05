import { canonicalizeJobUrl } from "./canonical-url";
import { buildJobAliases } from "./identity";
import type { JobSourceReference, NormalizedJob } from "./schema";
import { normalizeText, stableHash, tokenSimilarity } from "./text";

function stableJobKey(job: NormalizedJob): string {
  return `${normalizeText(job.company)}|${normalizeText(job.title)}|${canonicalizeJobUrl(job.canonicalUrl)}|${job.source}|${job.externalId ?? ""}`;
}

export function areDuplicateJobs(left: NormalizedJob, right: NormalizedJob): boolean {
  const aliases = new Set(buildJobAliases(left));
  if (buildJobAliases(right).some((alias) => aliases.has(alias))) return true;
  const sameCompany = normalizeText(left.company) === normalizeText(right.company);
  const sameTitle = normalizeText(left.title) === normalizeText(right.title);
  const compatibleLocation =
    normalizeText(left.location) === normalizeText(right.location) ||
    left.remoteType === "remote" ||
    right.remoteType === "remote";
  return sameCompany && sameTitle && compatibleLocation && tokenSimilarity(left.description, right.description) >= 0.82;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uniqueSources(values: readonly JobSourceReference[]): JobSourceReference[] {
  const sources = new Map<string, JobSourceReference>();
  values.forEach((source) => {
    const key = `${source.source}|${source.externalId ?? ""}|${canonicalizeJobUrl(source.url)}`;
    sources.set(key, { ...source, url: canonicalizeJobUrl(source.url) });
  });
  return [...sources.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, source]) => source);
}

function bestText(values: readonly string[]): string {
  return [...values].sort((left, right) => right.length - left.length || left.localeCompare(right))[0] ?? "";
}

function mergeGroup(group: readonly NormalizedJob[]): NormalizedJob {
  const sorted = [...group].sort((left, right) => stableJobKey(left).localeCompare(stableJobKey(right)));
  const primary = sorted[0]!;
  const description = bestText(sorted.map(({ description: value }) => value));
  const posted = sorted.flatMap(({ postedAt }) => (postedAt ? [postedAt] : [])).sort()[0];
  const expiry = sorted.flatMap(({ expiresAt }) => (expiresAt ? [expiresAt] : [])).sort()[0];
  return {
    ...primary,
    canonicalUrl: canonicalizeJobUrl(primary.canonicalUrl),
    description,
    requirements: uniqueStrings(sorted.flatMap(({ requirements }) => requirements)),
    responsibilities: uniqueStrings(sorted.flatMap(({ responsibilities }) => responsibilities)),
    skills: uniqueStrings(sorted.flatMap(({ skills }) => skills)),
    postedAt: posted,
    expiresAt: expiry,
    discoveredAt: sorted.map(({ discoveredAt }) => discoveredAt).sort()[0]!,
    contentHash: stableHash(normalizeText(description)),
    sources: uniqueSources(sorted.flatMap(({ sources }) => sources)),
    rawSourceData: Object.fromEntries(
      sorted.map((job) => [`${job.source}:${job.externalId ?? job.id}`, { ...job.rawSourceData }]),
    ),
  };
}

export function deduplicateJobs(jobs: readonly NormalizedJob[]): readonly NormalizedJob[] {
  const sorted = [...jobs].sort((left, right) => stableJobKey(left).localeCompare(stableJobKey(right)));
  const groups: NormalizedJob[][] = [];
  sorted.forEach((job) => {
    const index = groups.findIndex((group) => group.some((candidate) => areDuplicateJobs(candidate, job)));
    if (index === -1) groups.push([job]);
    else groups[index] = [...groups[index]!, job];
  });
  return groups.map(mergeGroup).sort((left, right) => stableJobKey(left).localeCompare(stableJobKey(right)));
}
