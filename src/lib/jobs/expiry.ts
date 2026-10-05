import type { NormalizedJob } from "./schema";

export function isExpiredJob(job: NormalizedJob, now: Date): boolean {
  if (job.status === "closed" || job.status === "expired") return true;
  if (!job.expiresAt) return false;
  const expiry = Date.parse(job.expiresAt);
  return Number.isNaN(expiry) || expiry <= now.getTime();
}

export function filterExpiredJobs(
  jobs: readonly NormalizedJob[],
  now: Date,
): readonly NormalizedJob[] {
  return jobs.filter((job) => !isExpiredJob(job, now));
}

