import { z } from "zod";

import { canonicalizeJobUrl } from "../jobs/canonical-url";
import { HttpUrlSchema, NormalizedJobSchema, type NormalizedJob } from "../jobs/schema";
import { stableHash } from "../jobs/text";
import { cleanDescription, inferRemoteType, normalizeEmploymentType, requireJson } from "./helpers";
import type { AdapterOptions, JobSourceAdapter, SourceHealth } from "./types";

const ArbeitnowJobSchema = z.object({
  slug: z.string().min(1),
  company_name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  remote: z.boolean().default(false),
  url: HttpUrlSchema,
  tags: z.array(z.string()).default([]),
  job_types: z.array(z.string()).default([]),
  location: z.string().default("Unknown"),
  created_at: z.union([z.number(), z.string()]).optional(),
});

const ArbeitnowResponseSchema = z.object({
  data: z.array(z.unknown()),
  links: z.object({ next: z.string().nullable().optional() }).optional(),
});
export type ArbeitnowJob = z.infer<typeof ArbeitnowJobSchema>;

interface ArbeitnowOptions extends AdapterOptions {
  readonly maxPages?: number;
  readonly maxJobs?: number;
}

export class ArbeitnowAdapter implements JobSourceAdapter {
  readonly name = "arbeitnow";
  private readonly request: typeof fetch;
  private readonly now: () => Date;
  private readonly maxPages: number;
  private readonly maxJobs: number;

  constructor(options: ArbeitnowOptions = {}) {
    this.request = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.maxPages = Math.max(1, Math.min(options.maxPages ?? 2, 10));
    this.maxJobs = Math.max(1, Math.min(options.maxJobs ?? 80, 500));
  }

  parseJob(value: unknown): ArbeitnowJob | null {
    const parsed = ArbeitnowJobSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  normalizeJob(job: ArbeitnowJob): NormalizedJob {
    const url = canonicalizeJobUrl(job.url);
    const description = cleanDescription(job.description);
    const createdAt = job.created_at === undefined ? undefined : this.parseCreatedAt(job.created_at);
    return NormalizedJobSchema.parse({
      id: `${this.name}:${job.slug}`,
      source: this.name,
      externalId: job.slug,
      canonicalUrl: url,
      title: job.title,
      company: job.company_name,
      location: job.location || (job.remote ? "Remote" : "Unknown"),
      remoteType: inferRemoteType(job.remote, job.location),
      employmentType: normalizeEmploymentType(job.job_types[0]),
      description,
      requirements: [],
      responsibilities: [],
      skills: job.tags,
      postedAt: createdAt,
      discoveredAt: this.now().toISOString(),
      contentHash: stableHash(description.toLowerCase()),
      sources: [{ source: this.name, externalId: job.slug, url }],
      rawSourceData: {},
    });
  }

  private parseCreatedAt(value: string | number): string | undefined {
    const numeric = typeof value === "number" ? value : Number(value);
    const date = Number.isFinite(numeric) ? new Date(numeric * 1000) : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private validatePageUrl(value: string): string {
    const url = new URL(value);
    if (url.origin !== "https://www.arbeitnow.com" || url.pathname !== "/api/job-board-api") {
      throw new Error("Arbeitnow returned an unsafe pagination URL");
    }
    return url.toString();
  }

  async fetchJobs(): Promise<readonly NormalizedJob[]> {
    const jobs: NormalizedJob[] = [];
    let next: string | null = "https://www.arbeitnow.com/api/job-board-api";
    for (let page = 0; page < this.maxPages && next && jobs.length < this.maxJobs; page += 1) {
      const response = await this.request(this.validatePageUrl(next), {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      });
      const payload = ArbeitnowResponseSchema.parse(await requireJson(response, this.name));
      const normalized = payload.data.flatMap((value) => {
        const parsed = this.parseJob(value);
        return parsed ? [this.normalizeJob(parsed)] : [];
      });
      jobs.push(...normalized.slice(0, this.maxJobs - jobs.length));
      next = payload.links?.next ?? null;
    }
    return jobs;
  }

  async healthCheck(): Promise<SourceHealth> {
    const checkedAt = this.now().toISOString();
    try {
      const response = await this.request("https://www.arbeitnow.com/api/job-board-api", {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
      return { healthy: response.ok, checkedAt, message: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (error) {
      return { healthy: false, checkedAt, message: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}
