import { z } from "zod";

import { canonicalizeJobUrl } from "../jobs/canonical-url";
import { HttpUrlSchema, NormalizedJobSchema, type JobPreferences, type NormalizedJob } from "../jobs/schema";
import { stableHash } from "../jobs/text";
import { cleanDescription, inferRemoteType, normalizeEmploymentType, requireJson } from "./helpers";
import type { AdapterOptions, JobSourceAdapter, SourceHealth } from "./types";

const RapidApiJobSchema = z.object({
  job_id: z.union([z.string(), z.number()]).optional(),
  job_title: z.string().min(1),
  employer_name: z.string().min(1),
  employer_website: HttpUrlSchema.optional().nullable(),
  job_publisher: z.string().optional(),
  job_apply_link: HttpUrlSchema.optional().nullable(),
  job_google_link: HttpUrlSchema.optional().nullable(),
  job_city: z.string().optional().nullable(),
  job_state: z.string().optional().nullable(),
  job_country: z.string().optional().nullable(),
  job_is_remote: z.boolean().optional(),
  job_employment_type: z.string().optional().nullable(),
  job_description: z.string().min(1),
  job_required_skills: z.array(z.string()).optional().nullable(),
  job_posted_at_datetime_utc: z.string().optional().nullable(),
  job_min_salary: z.number().optional().nullable(),
  job_max_salary: z.number().optional().nullable(),
  job_salary_currency: z.string().optional().nullable(),
});

const RapidApiResponseSchema = z.object({ data: z.array(z.unknown()).default([]) });

export interface RapidApiPlatform {
  readonly label: string;
  readonly queryToken: string;
}

interface RapidApiJobsOptions extends AdapterOptions {
  readonly apiKey: string;
  readonly apiHost?: string;
  readonly platform: RapidApiPlatform;
  readonly preferences: JobPreferences;
}

const DEFAULT_HOST = "jsearch.p.rapidapi.com";

function compactLocation(job: z.infer<typeof RapidApiJobSchema>): string {
  return [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") || "Remote";
}

function buildQuery(platform: RapidApiPlatform, preferences: JobPreferences): string {
  const roles = preferences.targetRoles.length > 0 ? preferences.targetRoles.slice(0, 3).join(" OR ") : "software engineer";
  const locations = preferences.locations.length > 0 ? preferences.locations.slice(0, 2).join(" ") : "India";
  const remote = preferences.workModes.includes("remote") ? "remote " : "";
  return `${roles} ${remote}${locations} ${platform.queryToken}`.trim();
}

export class RapidApiJobsAdapter implements JobSourceAdapter {
  readonly name: string;
  private readonly request: typeof fetch;
  private readonly now: () => Date;
  private readonly apiKey: string;
  private readonly apiHost: string;
  private readonly platform: RapidApiPlatform;
  private readonly preferences: JobPreferences;

  constructor(options: RapidApiJobsOptions) {
    this.name = `rapidapi-${options.platform.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    this.request = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.apiKey = options.apiKey;
    this.apiHost = options.apiHost ?? DEFAULT_HOST;
    this.platform = options.platform;
    this.preferences = options.preferences;
  }

  private url(): string {
    const url = new URL(`https://${this.apiHost}/search`);
    url.searchParams.set("query", buildQuery(this.platform, this.preferences));
    url.searchParams.set("page", "1");
    url.searchParams.set("num_pages", "1");
    url.searchParams.set("country", "in");
    url.searchParams.set("date_posted", "month");
    return url.toString();
  }

  normalizeJob(job: z.infer<typeof RapidApiJobSchema>): NormalizedJob | null {
    const sourceUrl = job.job_apply_link ?? job.job_google_link;
    if (!sourceUrl) return null;
    const url = canonicalizeJobUrl(sourceUrl);
    const description = cleanDescription(job.job_description);
    const location = compactLocation(job);
    const id = String(job.job_id ?? stableHash(`${job.employer_name}:${job.job_title}:${url}`));
    const postedAt = job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : null;
    return NormalizedJobSchema.parse({
      id: `${this.name}:${id}`,
      source: this.name,
      externalId: id,
      canonicalUrl: url,
      title: job.job_title,
      company: job.employer_name,
      companyUrl: job.employer_website ?? undefined,
      location,
      remoteType: inferRemoteType(Boolean(job.job_is_remote), location),
      employmentType: normalizeEmploymentType(job.job_employment_type ?? undefined),
      salaryMin: job.job_min_salary ?? undefined,
      salaryMax: job.job_max_salary ?? undefined,
      salaryCurrency: job.job_salary_currency ?? undefined,
      description,
      requirements: [],
      responsibilities: [],
      skills: job.job_required_skills ?? [],
      postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt.toISOString() : undefined,
      discoveredAt: this.now().toISOString(),
      contentHash: stableHash(description.toLowerCase()),
      sources: [{ source: this.name, externalId: id, url }],
      rawSourceData: { platform: this.platform.label, publisher: job.job_publisher },
    });
  }

  async fetchJobs(): Promise<readonly NormalizedJob[]> {
    const response = await this.request(this.url(), {
      headers: {
        Accept: "application/json",
        "X-RapidAPI-Key": this.apiKey,
        "X-RapidAPI-Host": this.apiHost,
      },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = RapidApiResponseSchema.parse(await requireJson(response, this.name));
    return payload.data.flatMap((value) => {
      const parsed = RapidApiJobSchema.safeParse(value);
      if (!parsed.success) return [];
      const normalized = this.normalizeJob(parsed.data);
      return normalized ? [normalized] : [];
    });
  }

  async healthCheck(): Promise<SourceHealth> {
    const checkedAt = this.now().toISOString();
    try {
      const response = await this.request(this.url(), {
        headers: {
          Accept: "application/json",
          "X-RapidAPI-Key": this.apiKey,
          "X-RapidAPI-Host": this.apiHost,
        },
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
      return { healthy: response.ok, checkedAt, message: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (error) {
      return { healthy: false, checkedAt, message: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export const RAPIDAPI_JOB_PLATFORMS: readonly RapidApiPlatform[] = [
  { label: "LinkedIn", queryToken: "LinkedIn" },
  { label: "Indeed", queryToken: "Indeed" },
  { label: "Glassdoor", queryToken: "Glassdoor" },
  { label: "Workday", queryToken: "Workday" },
  { label: "Ashby", queryToken: "Ashby" },
  { label: "Greenhouse", queryToken: "Greenhouse" },
  { label: "Lever", queryToken: "Lever" },
  { label: "Wellfound", queryToken: "Wellfound" },
];

export function configuredRapidApiJobAdapters(preferences: JobPreferences): readonly RapidApiJobsAdapter[] {
  const apiKey = process.env.RAPIDAPI_KEY?.trim();
  if (!apiKey) return [];
  const apiHost = process.env.RAPIDAPI_JOBS_HOST?.trim() || DEFAULT_HOST;
  const limit = Math.max(1, Math.min(Number(process.env.RAPIDAPI_JOB_SOURCE_LIMIT ?? "8"), RAPIDAPI_JOB_PLATFORMS.length));
  return RAPIDAPI_JOB_PLATFORMS.slice(0, limit).map(
    (platform) => new RapidApiJobsAdapter({ apiKey, apiHost, platform, preferences }),
  );
}
