import { z } from "zod";

import { canonicalizeJobUrl } from "../jobs/canonical-url";
import { HttpUrlSchema, NormalizedJobSchema, type NormalizedJob } from "../jobs/schema";
import { stableHash } from "../jobs/text";
import { cleanDescription, inferRemoteType, normalizeEmploymentType, requireJson } from "./helpers";
import type { AdapterOptions, JobSourceAdapter, SourceHealth } from "./types";

const RemotiveJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  url: HttpUrlSchema,
  title: z.string().min(1),
  company_name: z.string().min(1),
  candidate_required_location: z.string().default("Remote"),
  job_type: z.string().optional(),
  publication_date: z.string().optional(),
  description: z.string().min(1),
  tags: z.array(z.string()).default([]),
  salary: z.string().optional(),
});

const RemotiveResponseSchema = z.object({ jobs: z.array(z.unknown()) });
export type RemotiveJob = z.infer<typeof RemotiveJobSchema>;

export class RemotiveAdapter implements JobSourceAdapter {
  readonly name = "remotive";
  private readonly request: typeof fetch;
  private readonly now: () => Date;

  constructor(options: AdapterOptions = {}) {
    this.request = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  parseJob(value: unknown): RemotiveJob | null {
    const parsed = RemotiveJobSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  normalizeJob(job: RemotiveJob): NormalizedJob {
    const id = String(job.id);
    const url = canonicalizeJobUrl(job.url);
    const description = cleanDescription(job.description);
    const postedAt = job.publication_date ? new Date(job.publication_date) : null;
    return NormalizedJobSchema.parse({
      id: `${this.name}:${id}`,
      source: this.name,
      externalId: id,
      canonicalUrl: url,
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || "Remote",
      remoteType: inferRemoteType(true, job.candidate_required_location),
      employmentType: normalizeEmploymentType(job.job_type),
      description,
      requirements: [],
      responsibilities: [],
      skills: job.tags,
      postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt.toISOString() : undefined,
      discoveredAt: this.now().toISOString(),
      contentHash: stableHash(description.toLowerCase()),
      sources: [{ source: this.name, externalId: id, url }],
      rawSourceData: job.salary ? { salary: job.salary } : {},
    });
  }

  async fetchJobs(): Promise<readonly NormalizedJob[]> {
    const response = await this.request("https://remotive.com/api/remote-jobs", {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = RemotiveResponseSchema.parse(await requireJson(response, this.name));
    return payload.jobs.flatMap((value) => {
      const parsed = this.parseJob(value);
      return parsed ? [this.normalizeJob(parsed)] : [];
    });
  }

  async healthCheck(): Promise<SourceHealth> {
    const checkedAt = this.now().toISOString();
    try {
      const response = await this.request("https://remotive.com/api/remote-jobs?limit=1", {
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
