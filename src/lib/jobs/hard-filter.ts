import type { HardFilterReason, JobPreferences, NormalizedJob } from "./schema";
import { normalizeText } from "./text";

export interface HardFilterRejection {
  readonly job: NormalizedJob;
  readonly reasons: readonly HardFilterReason[];
}

export interface HardFilterResult {
  readonly accepted: readonly NormalizedJob[];
  readonly rejected: readonly HardFilterRejection[];
}

function containsPhrase(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(normalizeText(needle)));
}

function matchesRole(title: string, targetRoles: readonly string[]): boolean {
  const titleTokens = new Set(normalizeText(title).split(" ").filter(Boolean));
  return targetRoles.some((role) => {
    const roleTokens = normalizeText(role).split(" ").filter(Boolean);
    return roleTokens.length > 0 && roleTokens.every((token) => titleTokens.has(token));
  });
}

export function getHardFilterReasons(
  job: NormalizedJob,
  preferences: JobPreferences,
): readonly HardFilterReason[] {
  const role = normalizeText(job.title);
  const location = normalizeText(job.location);
  const searchable = normalizeText(`${job.title} ${job.description}`);
  const reasons: HardFilterReason[] = [];

  if (preferences.targetRoles.length > 0 && !matchesRole(role, preferences.targetRoles)) {
    reasons.push("role_mismatch");
  }
  if (
    preferences.locations.length > 0 &&
    job.remoteType !== "remote" &&
    !containsPhrase(location, preferences.locations)
  ) {
    reasons.push("location_mismatch");
  }
  if (
    preferences.workModes.length > 0 &&
    job.remoteType !== "unknown" &&
    !preferences.workModes.includes(job.remoteType)
  ) {
    reasons.push("work_mode_mismatch");
  }
  if (
    preferences.employmentTypes.length > 0 &&
    job.employmentType !== "unknown" &&
    !preferences.employmentTypes.includes(job.employmentType)
  ) {
    reasons.push("employment_type_mismatch");
  }
  if (
    job.experienceMin !== undefined &&
    job.experienceMin > preferences.yearsOfExperience + preferences.maxExperienceStretch
  ) {
    reasons.push("experience_mismatch");
  }
  if (
    preferences.minimumSalary !== undefined &&
    job.salaryMax !== undefined &&
    job.salaryMax < preferences.minimumSalary &&
    (!preferences.salaryCurrency || job.salaryCurrency === preferences.salaryCurrency)
  ) {
    reasons.push("salary_mismatch");
  }
  if (preferences.excludedTerms.some((term) => searchable.includes(normalizeText(term)))) {
    reasons.push("excluded_term");
  }
  return reasons;
}

export function applyHardFilters(
  jobs: readonly NormalizedJob[],
  preferences: JobPreferences,
): HardFilterResult {
  return jobs.reduce<HardFilterResult>(
    (result, job) => {
      const reasons = getHardFilterReasons(job, preferences);
      return reasons.length === 0
        ? { ...result, accepted: [...result.accepted, job] }
        : { ...result, rejected: [...result.rejected, { job, reasons }] };
    },
    { accepted: [], rejected: [] },
  );
}
