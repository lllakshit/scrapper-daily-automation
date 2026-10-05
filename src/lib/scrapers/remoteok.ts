import { z } from "zod";

import { canonicalizeJobUrl } from "../jobs/canonical-url";
import { HttpUrlSchema, NormalizedJobSchema, type NormalizedJob } from "../jobs/schema";
import { stableHash } from "../jobs/text";
import { cleanDescription, inferRemoteType, normalizeEmploymentType, requireJson } from "./helpers";
import type { AdapterOptions, JobSourceAdapter, SourceHealth } from "./types";

const RemoteOkJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  slug: z.string().optional(),
  url: HttpUrlSchema,
  position: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional().default("Remote"),
  description: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  date: z.string().optional(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
});

export type RemoteOkJob = z.infer<typeof RemoteOkJobSchema>;

export class RemoteOkAdapter implements JobSourceAdapter {
  readonly name = "remoteok";
  private readonly request: typeof fetch;
  private readonly now: () => Date;

  constructor(options: AdapterOptions = {}) {
    this.request = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  parseJob(value: unknown): RemoteOkJob | null {
    const parsed = RemoteOkJobSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  normalizeJob(job: RemoteOkJob): NormalizedJob {
    const id = String(job.id);
    const url = canonicalizeJobUrl(job.url);
    const description = cleanDescription(job.description);
    const postedAt = job.date ? new Date(job.date) : null;
    return NormalizedJobSchema.parse({
      id: `${this.name}:${id}`,
      source: this.name,
      externalId: id,
      canonicalUrl: url,
      title: job.position,
      company: job.company,
      location: job.location || "Remote",
      remoteType: inferRemoteType(true, job.location ?? "Remote"),
      employmentType: normalizeEmploymentType(undefined),
      description,
      requirements: [],
      responsibilities: [],
      skills: job.tags,
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      salaryCurrency: job.salary_min || job.salary_max ? "USD" : undefined,
      postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt.toISOString() : undefined,
      discoveredAt: this.now().toISOString(),
      contentHash: stableHash(description.toLowerCase()),
      sources: [{ source: this.name, externalId: id, url }],
      rawSourceData: { slug: job.slug },
    });
  }

  async fetchJobs(): Promise<readonly NormalizedJob[]> {
    const response = await this.request("https://remoteok.com/api", {
      headers: { Accept: "application/json", "User-Agent": "CareerAutopilot/1.0" },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = z.array(z.unknown()).parse(await requireJson(response, this.name));
    return payload.flatMap((value) => {
      const parsed = this.parseJob(value);
      return parsed ? [this.normalizeJob(parsed)] : [];
    });
  }

  async healthCheck(): Promise<SourceHealth> {
    const checkedAt = this.now().toISOString();
    try {
      const response = await this.request("https://remoteok.com/api", {
        headers: { Accept: "application/json", "User-Agent": "CareerAutopilot/1.0" },
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
      return { healthy: response.ok, checkedAt, message: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (error) {
      return { healthy: false, checkedAt, message: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}
