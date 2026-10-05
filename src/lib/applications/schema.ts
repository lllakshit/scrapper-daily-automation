import { z } from "zod";

const timestamp = z.iso.datetime();
const text = (maximum: number) => z.string().trim().max(maximum);
const requiredText = (maximum: number) => text(maximum).min(1);

export const ApplicationStatusSchema = z.enum([
  "saved",
  "preparing",
  "ready",
  "applied",
  "follow_up",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
]);

export const GroundedContentSchema = z
  .object({
    content: requiredText(20_000),
    evidenceIds: z.array(requiredText(100)).max(100),
  })
  .strict();

export const ResumeRecommendationSchema = GroundedContentSchema.extend({
  reason: requiredText(2_000),
}).strict();

export const ApplicationAnswerSchema = GroundedContentSchema.extend({
  question: requiredText(2_000),
}).strict();

export const ApplicationPreparationSchema = z
  .object({
    resumeRecommendations: z.array(ResumeRecommendationSchema).max(50),
    coverLetter: GroundedContentSchema,
    applicationAnswers: z.array(ApplicationAnswerSchema).max(50),
    keyExperience: z.array(GroundedContentSchema).max(50),
    followUpDraft: GroundedContentSchema.nullable(),
    generatedAt: timestamp,
    updatedAt: timestamp,
    approvedAt: timestamp.nullable(),
  })
  .strict();

export const StatusEventSchema = z
  .object({ status: ApplicationStatusSchema, at: timestamp })
  .strict();

export const ApplicationSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: requiredText(100),
    jobId: requiredText(200),
    company: requiredText(300),
    role: requiredText(300),
    url: z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
    status: ApplicationStatusSchema,
    statusHistory: z.array(StatusEventSchema).min(1).max(100),
    notes: text(20_000),
    resumeVersion: text(255),
    preparation: ApplicationPreparationSchema.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
    appliedAt: timestamp.nullable(),
    followUpDueAt: timestamp.nullable(),
    followUpSentAt: timestamp.nullable(),
    interviewAt: timestamp.nullable(),
  })
  .strict();

export const ApplicationCollectionSchema = z
  .object({ schemaVersion: z.literal(1), applications: z.array(ApplicationSchema).max(5_000) })
  .strict();

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type ApplicationPreparation = z.infer<typeof ApplicationPreparationSchema>;
export type Application = z.infer<typeof ApplicationSchema>;
export type ApplicationCollection = z.infer<typeof ApplicationCollectionSchema>;

export interface CreateApplicationInput {
  readonly jobId: string;
  readonly company: string;
  readonly role: string;
  readonly url: string;
  readonly notes?: string;
  readonly resumeVersion?: string;
}

export interface ApplicationDraft {
  readonly resumeRecommendations: readonly z.input<typeof ResumeRecommendationSchema>[];
  readonly coverLetter: z.input<typeof GroundedContentSchema>;
  readonly applicationAnswers: readonly z.input<typeof ApplicationAnswerSchema>[];
  readonly keyExperience: readonly z.input<typeof GroundedContentSchema>[];
  readonly followUpDraft: z.input<typeof GroundedContentSchema> | null;
}
