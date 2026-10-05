import type { NormalizedJob } from "../jobs/schema";

export interface SourceHealth {
  readonly healthy: boolean;
  readonly checkedAt: string;
  readonly message?: string;
}

export interface JobSourceAdapter {
  readonly name: string;
  fetchJobs(): Promise<readonly NormalizedJob[]>;
  healthCheck(): Promise<SourceHealth>;
}

export interface AdapterOptions {
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}

