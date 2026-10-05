import { z } from "zod";

const trimmedString = (maximum = 500) => z.string().trim().max(maximum);
const requiredString = (label: string, maximum = 500) =>
  z.string().trim().min(1, `${label} is required`).max(maximum);
const isoTimestamp = z.string().datetime({ offset: true });
const dateLabel = trimmedString(40);

const uniqueStrings = (minimum: number, label: string) =>
  z
    .array(requiredString(label, 100))
    .transform((values) => {
      const seen = new Set<string>();
      return values.filter((value) => {
        const key = value.toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })
    .pipe(z.array(z.string()).min(minimum, `Choose at least one ${label.toLowerCase()}`));

export const ProfileStatusSchema = z.enum(["draft", "approved"]);

export const EvidenceSchema = z
  .object({
    id: requiredString("Evidence ID", 100),
    source: z.enum(["resume", "user"]),
    fieldPath: requiredString("Field path", 200),
    excerpt: requiredString("Evidence excerpt", 500),
  })
  .strict();

export const ResumeSourceSchema = z
  .object({
    originalName: requiredString("Resume filename", 255),
    mediaType: z.enum([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]),
    size: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    extractedAt: isoTimestamp,
  })
  .strict();

export const PersonalDetailsSchema = z
  .object({
    name: trimmedString(120),
    email: z.union([z.literal(""), z.email()]),
    location: trimmedString(160),
  })
  .strict();

export const ProfessionalDetailsSchema = z
  .object({
    currentTitle: trimmedString(160),
    yearsOfExperience: z.number().min(0).max(80).nullable(),
    summary: trimmedString(4_000),
    targetRoles: uniqueStrings(0, "Target role"),
  })
  .strict();

export const SkillSetSchema = z
  .object({
    languages: uniqueStrings(0, "Language"),
    frontend: uniqueStrings(0, "Frontend skill"),
    backend: uniqueStrings(0, "Backend skill"),
    databases: uniqueStrings(0, "Database skill"),
    cloud: uniqueStrings(0, "Cloud skill"),
    devops: uniqueStrings(0, "DevOps skill"),
    aiMl: uniqueStrings(0, "AI/ML skill"),
    llmGenAi: uniqueStrings(0, "LLM/GenAI skill"),
    tools: uniqueStrings(0, "Tool"),
  })
  .strict();

export const ExperienceSchema = z
  .object({
    id: requiredString("Experience ID", 100),
    company: requiredString("Company", 200),
    role: requiredString("Role", 200),
    startDate: dateLabel,
    endDate: dateLabel,
    responsibilities: uniqueStrings(0, "Responsibility"),
    achievements: uniqueStrings(0, "Achievement"),
    technologies: uniqueStrings(0, "Technology"),
    evidenceIds: uniqueStrings(0, "Evidence ID"),
  })
  .strict();

export const ProjectSchema = z
  .object({
    id: requiredString("Project ID", 100),
    name: requiredString("Project name", 200),
    description: trimmedString(2_000),
    technologies: uniqueStrings(0, "Technology"),
    impact: trimmedString(1_000),
    evidenceIds: uniqueStrings(0, "Evidence ID"),
  })
  .strict();

export const EducationSchema = z
  .object({
    id: requiredString("Education ID", 100),
    degree: requiredString("Degree", 240),
    institution: requiredString("Institution", 240),
    startDate: dateLabel,
    endDate: dateLabel,
    evidenceIds: uniqueStrings(0, "Evidence ID"),
  })
  .strict();

export const CertificationSchema = z
  .object({
    id: requiredString("Certification ID", 100),
    name: requiredString("Certification name", 240),
    issuer: trimmedString(240),
    issuedAt: dateLabel,
    evidenceIds: uniqueStrings(0, "Evidence ID"),
  })
  .strict();

export const CareerProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    status: ProfileStatusSchema,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    approvedAt: isoTimestamp.nullable(),
    resumeSource: ResumeSourceSchema.nullable(),
    personal: PersonalDetailsSchema,
    professional: ProfessionalDetailsSchema,
    skills: SkillSetSchema,
    experience: z.array(ExperienceSchema).max(100),
    projects: z.array(ProjectSchema).max(100),
    education: z.array(EducationSchema).max(50),
    certifications: z.array(CertificationSchema).max(100),
    evidence: z.array(EvidenceSchema).max(1_000),
    extractionWarnings: z.array(trimmedString(500)).max(100),
  })
  .strict()
  .superRefine((profile, context) => {
    if (profile.status !== "approved") return;
    if (!profile.approvedAt) {
      context.addIssue({ code: "custom", path: ["approvedAt"], message: "Approval time is required" });
    }
    if (!profile.personal.name) {
      context.addIssue({ code: "custom", path: ["personal", "name"], message: "Name is required" });
    }
    if (profile.professional.targetRoles.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["professional", "targetRoles"],
        message: "Choose at least one target role before approval",
      });
    }
  });

export const CareerProfilePatchSchema = z
  .object({
    personal: PersonalDetailsSchema.partial().optional(),
    professional: ProfessionalDetailsSchema.partial().optional(),
    skills: SkillSetSchema.partial().optional(),
    experience: z.array(ExperienceSchema).max(100).optional(),
    projects: z.array(ProjectSchema).max(100).optional(),
    education: z.array(EducationSchema).max(50).optional(),
    certifications: z.array(CertificationSchema).max(100).optional(),
  })
  .strict();

export const CareerPreferencesSchema = z
  .object({
    targetRoles: uniqueStrings(1, "Target role"),
    locations: uniqueStrings(1, "Location"),
    workModes: z.array(z.enum(["remote", "hybrid", "on-site"])).min(1),
    employmentTypes: z.array(z.enum(["full-time", "contract", "part-time", "internship"])).min(1),
    preferredMinimumSalary: z.number().nonnegative().max(1_000_000_000).nullable(),
    salaryCurrency: z.enum(["INR", "USD", "EUR", "GBP"]),
  })
  .strict()
  .transform((preferences) => ({
    ...preferences,
    workModes: [...new Set(preferences.workModes)],
    employmentTypes: [...new Set(preferences.employmentTypes)],
  }));

export const CareerPreferencesPatchSchema = z
  .object({
    targetRoles: uniqueStrings(1, "Target role").optional(),
    locations: uniqueStrings(1, "Location").optional(),
    workModes: z.array(z.enum(["remote", "hybrid", "on-site"])).min(1).optional(),
    employmentTypes: z
      .array(z.enum(["full-time", "contract", "part-time", "internship"]))
      .min(1)
      .optional(),
    preferredMinimumSalary: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
    salaryCurrency: z.enum(["INR", "USD", "EUR", "GBP"]).optional(),
  })
  .strict();

export type CareerProfile = z.infer<typeof CareerProfileSchema>;
export type CareerProfilePatch = z.infer<typeof CareerProfilePatchSchema>;
export type CareerPreferences = z.infer<typeof CareerPreferencesSchema>;
export type CareerPreferencesPatch = z.infer<typeof CareerPreferencesPatchSchema>;

export function createEmptyCareerProfile(now: string): CareerProfile {
  return CareerProfileSchema.parse({
    schemaVersion: 1,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    resumeSource: null,
    personal: { name: "", email: "", location: "" },
    professional: { currentTitle: "", yearsOfExperience: null, summary: "", targetRoles: [] },
    skills: {
      languages: [],
      frontend: [],
      backend: [],
      databases: [],
      cloud: [],
      devops: [],
      aiMl: [],
      llmGenAi: [],
      tools: [],
    },
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    evidence: [],
    extractionWarnings: [],
  });
}
