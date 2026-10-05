import { z } from "zod";

export const HttpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Only HTTP(S) URLs are allowed");

export const RemoteTypeSchema = z.enum(["remote", "hybrid", "onsite", "unknown"]);
export const EmploymentTypeSchema = z.enum([
  "full-time",
  "part-time",
  "contract",
  "internship",
  "temporary",
  "unknown",
]);

export const JobSourceReferenceSchema = z.object({
  source: z.string().trim().min(1),
  externalId: z.string().trim().min(1).optional(),
  url: HttpUrlSchema,
});

export const NormalizedJobSchema = z.object({
  id: z.string().trim().min(1),
  source: z.string().trim().min(1),
  externalId: z.string().trim().min(1).optional(),
  canonicalUrl: HttpUrlSchema,
  title: z.string().trim().min(1),
  company: z.string().trim().min(1),
  companyUrl: HttpUrlSchema.optional(),
  location: z.string().trim().min(1).default("Unknown"),
  remoteType: RemoteTypeSchema.default("unknown"),
  employmentType: EmploymentTypeSchema.default("unknown"),
  salaryMin: z.number().finite().nonnegative().optional(),
  salaryMax: z.number().finite().nonnegative().optional(),
  salaryCurrency: z.string().trim().min(1).optional(),
  experienceMin: z.number().finite().nonnegative().optional(),
  experienceMax: z.number().finite().nonnegative().optional(),
  description: z.string().trim().min(1),
  requirements: z.array(z.string().trim().min(1)).default([]),
  responsibilities: z.array(z.string().trim().min(1)).default([]),
  skills: z.array(z.string().trim().min(1)).default([]),
  postedAt: z.iso.datetime().optional(),
  discoveredAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().optional(),
  contentHash: z.string().trim().min(1).optional(),
  status: z.enum(["active", "closed", "expired", "unknown"]).default("active"),
  sources: z.array(JobSourceReferenceSchema).min(1),
  rawSourceData: z.record(z.string(), z.unknown()).default({}),
});

export type RemoteType = z.infer<typeof RemoteTypeSchema>;
export type EmploymentType = z.infer<typeof EmploymentTypeSchema>;
export type JobSourceReference = z.infer<typeof JobSourceReferenceSchema>;
export type NormalizedJob = z.infer<typeof NormalizedJobSchema>;

export interface JobPreferences {
  readonly targetRoles: readonly string[];
  readonly locations: readonly string[];
  readonly workModes: readonly RemoteType[];
  readonly employmentTypes: readonly EmploymentType[];
  readonly yearsOfExperience: number;
  readonly maxExperienceStretch: number;
  readonly excludedTerms: readonly string[];
  readonly minimumSalary?: number;
  readonly salaryCurrency?: string;
}

export type HardFilterReason =
  | "role_mismatch"
  | "location_mismatch"
  | "work_mode_mismatch"
  | "employment_type_mismatch"
  | "experience_mismatch"
  | "salary_mismatch"
  | "excluded_term";
