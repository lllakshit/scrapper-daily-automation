import { canonicalizeJobUrl } from "./canonical-url";
import type { NormalizedJob } from "./schema";
import { normalizeText, stableHash } from "./text";

function semanticSignature(job: NormalizedJob): string {
  const value = [
    normalizeText(job.company),
    normalizeText(job.title),
    normalizeText(job.location),
    stableHash(normalizeText(job.description)),
  ].join("|");
  return `semantic:${stableHash(value)}`;
}

export function buildJobAliases(job: NormalizedJob): readonly string[] {
  const sourceAliases = job.sources.flatMap((source) => [
    ...(source.externalId ? [`source:${source.source}:${source.externalId}`] : []),
    `url:${canonicalizeJobUrl(source.url)}`,
  ]);
  const aliases = [
    ...(job.externalId ? [`source:${job.source}:${job.externalId}`] : []),
    `url:${canonicalizeJobUrl(job.canonicalUrl)}`,
    `content:${stableHash(
      `${normalizeText(job.company)}|${normalizeText(job.title)}|${job.contentHash ?? stableHash(normalizeText(job.description))}`,
    )}`,
    semanticSignature(job),
    ...sourceAliases,
  ];
  return [...new Set(aliases)].sort();
}
