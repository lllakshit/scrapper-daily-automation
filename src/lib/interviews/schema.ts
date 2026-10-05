import { z } from "zod";

const timestamp = z.iso.datetime();
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const PracticeStatusSchema = z.enum(["not_practiced", "practicing", "confident"]);

export const InterviewQuestionSchema = z
  .object({
    id: requiredText(100),
    prompt: requiredText(4_000),
    guidance: z.string().trim().max(10_000),
    evidenceIds: z.array(requiredText(100)).max(100),
    practiceStatus: PracticeStatusSchema,
    practicedAt: timestamp.nullable(),
  })
  .strict();

export const InterviewSectionsSchema = z
  .object({
    companyResearch: z.array(requiredText(5_000)).max(50),
    roleAnalysis: z.array(requiredText(5_000)).max(50),
    whyYouMatch: z.array(requiredText(5_000)).max(50),
    technicalQuestions: z.array(InterviewQuestionSchema).max(100),
    projectQuestions: z.array(InterviewQuestionSchema).max(100),
    behavioralQuestions: z.array(InterviewQuestionSchema).max(100),
    hrQuestions: z.array(InterviewQuestionSchema).max(100),
    gapQuestions: z.array(InterviewQuestionSchema).max(100),
    questionsForInterviewer: z.array(InterviewQuestionSchema).max(100),
  })
  .strict();

export const InterviewWorkspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: requiredText(100),
    applicationId: requiredText(100),
    company: requiredText(300),
    role: requiredText(300),
    scheduledAt: timestamp.nullable(),
    sections: InterviewSectionsSchema,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

export const InterviewCollectionSchema = z
  .object({ schemaVersion: z.literal(1), interviews: z.array(InterviewWorkspaceSchema).max(1_000) })
  .strict();

export type PracticeStatus = z.infer<typeof PracticeStatusSchema>;
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;
export type InterviewSections = z.infer<typeof InterviewSectionsSchema>;
export type InterviewWorkspace = z.infer<typeof InterviewWorkspaceSchema>;
export type InterviewCollection = z.infer<typeof InterviewCollectionSchema>;

export interface InterviewEvidence {
  readonly id: string;
  readonly excerpt: string;
}

export interface CreateInterviewInput {
  readonly applicationId: string;
  readonly company: string;
  readonly role: string;
  readonly evidence: readonly InterviewEvidence[];
  readonly scheduledAt?: string | null;
}

export interface InterviewQuestionDraft {
  readonly prompt: string;
  readonly guidance: string;
  readonly evidenceIds: readonly string[];
}

export interface InterviewDraft {
  readonly companyResearch: readonly string[];
  readonly roleAnalysis: readonly string[];
  readonly whyYouMatch: readonly string[];
  readonly technicalQuestions: readonly InterviewQuestionDraft[];
  readonly projectQuestions: readonly InterviewQuestionDraft[];
  readonly behavioralQuestions: readonly InterviewQuestionDraft[];
  readonly hrQuestions: readonly InterviewQuestionDraft[];
  readonly gapQuestions: readonly InterviewQuestionDraft[];
  readonly questionsForInterviewer: readonly InterviewQuestionDraft[];
}
