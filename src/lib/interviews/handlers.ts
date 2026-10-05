import { z } from "zod";

import type { Application } from "@/lib/applications/schema";
import type { StoredApplicationRepository } from "@/lib/applications/repository";
import type { VersionedRecord } from "@/lib/storage";
import { JsonRequestError, readJsonBody } from "@/lib/http/read-json";

import {
  createInterviewWorkspace,
  rescheduleInterview,
  updateQuestionPractice,
  type InterviewPreparationProvider,
} from "./domain";
import type { StoredInterviewRepository } from "./repository";
import { PracticeStatusSchema, type InterviewWorkspace } from "./schema";

type ApplicationReader = Pick<StoredApplicationRepository, "findById">;
type InterviewRepository = Pick<
  StoredInterviewRepository,
  "list" | "findById" | "findByApplicationId" | "save"
>;

export interface InterviewApiDependencies {
  readonly authenticate: (request: Request) => Promise<unknown>;
  readonly assertMutationOrigin: (request: Request) => void;
  readonly applications: ApplicationReader;
  readonly interviews: InterviewRepository;
  readonly provider?: InterviewPreparationProvider;
  readonly now: () => string;
  readonly id: () => string;
}

const createRequest = z
  .object({ applicationId: z.string().trim().min(1).max(100), expectedRevision: z.number().int().nonnegative() })
  .strict();
const updateRequest = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    scheduledAt: z.iso.datetime().nullable().optional(),
    questionId: z.string().trim().min(1).max(100).optional(),
    practiceStatus: PracticeStatusSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.questionId) !== Boolean(value.practiceStatus)) {
      context.addIssue({ code: "custom", message: "Question ID and practice status are required together" });
    }
  });

const success = <T>(data: T, status = 200) => Response.json({ success: true, data, error: null }, { status });
const failure = (status: number, code: string, message: string, details?: unknown) =>
  Response.json({ success: false, data: null, error: { code, message, ...(details ? { details } : {}) } }, { status });

class ApplicationNotFoundError extends Error {}
class InterviewNotFoundError extends Error {}
class ApplicationNotInterviewingError extends Error {}

function errorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) return failure(422, "VALIDATION_ERROR", "Review the interview fields", z.flattenError(error));
  if (error instanceof JsonRequestError) return failure(error.status, error.code, error.message);
  if (error instanceof SyntaxError) return failure(400, "INVALID_JSON", "The request body must be valid JSON");
  if (error instanceof ApplicationNotFoundError) return failure(404, "APPLICATION_NOT_FOUND", "Application not found");
  if (error instanceof InterviewNotFoundError) return failure(404, "INTERVIEW_NOT_FOUND", "Interview workspace not found");
  if (error instanceof ApplicationNotInterviewingError) return failure(409, "INTERVIEW_STATUS_REQUIRED", "Move the application to Interview before creating its workspace");
  if (error instanceof Error && error.name === "UnauthorizedError") return failure(401, "UNAUTHORIZED", "Authentication required");
  if (error instanceof Error && error.name === "InvalidOriginError") return failure(403, "INVALID_ORIGIN", "Request origin is not allowed");
  if (error instanceof Error && error.name === "StorageConflictError") return failure(409, "STALE_REVISION", "Interview data changed. Refresh and try again.");
  if (error instanceof Error && error.name === "InterviewQuestionNotFoundError") return failure(404, "QUESTION_NOT_FOUND", error.message);
  if (error instanceof Error && error.name === "InterviewGroundingError") return failure(422, "UNGROUNDED_DRAFT", error.message);
  return failure(500, "INTERNAL_ERROR", "The request could not be completed");
}

async function safely(operation: () => Promise<Response>): Promise<Response> {
  try { return await operation(); } catch (error) { return errorResponse(error); }
}

function evidenceFrom(application: Application): { id: string; excerpt: string }[] {
  const preparation = application.preparation;
  if (!preparation) return [];
  const items = [
    ...preparation.resumeRecommendations,
    preparation.coverLetter,
    ...preparation.applicationAnswers,
    ...preparation.keyExperience,
  ];
  const byId = new Map<string, string>();
  for (const item of items) {
    for (const id of item.evidenceIds) if (!byId.has(id)) byId.set(id, item.content);
  }
  return [...byId].map(([id, excerpt]) => ({ id, excerpt }));
}

async function workspace(repository: InterviewRepository, id: string): Promise<VersionedRecord<InterviewWorkspace>> {
  const record = await repository.findById(id);
  if (!record) throw new InterviewNotFoundError();
  return record;
}

export function createInterviewApi(dependencies: InterviewApiDependencies) {
  return {
    list: (request: Request) => safely(async () => {
      await dependencies.authenticate(request);
      return success(await dependencies.interviews.list());
    }),
    get: (request: Request, id: string) => safely(async () => {
      await dependencies.authenticate(request);
      return success(await workspace(dependencies.interviews, id));
    }),
    create: (request: Request) => safely(async () => {
      await dependencies.authenticate(request);
      dependencies.assertMutationOrigin(request);
      const input = createRequest.parse(await readJsonBody(request));
      const application = await dependencies.applications.findById(input.applicationId);
      if (!application) throw new ApplicationNotFoundError();
      if (application.value.status !== "interview") throw new ApplicationNotInterviewingError();
      const existing = await dependencies.interviews.findByApplicationId(input.applicationId);
      if (existing) return success(existing);
      const created = await createInterviewWorkspace(
        {
          applicationId: application.value.id,
          company: application.value.company,
          role: application.value.role,
          scheduledAt: application.value.interviewAt,
          evidence: evidenceFrom(application.value),
        },
        dependencies.provider,
        dependencies.now(),
        dependencies.id(),
      );
      return success(await dependencies.interviews.save(created, input.expectedRevision), 201);
    }),
    update: (request: Request, id: string) => safely(async () => {
      await dependencies.authenticate(request);
      dependencies.assertMutationOrigin(request);
      const input = updateRequest.parse(await readJsonBody(request));
      const current = await workspace(dependencies.interviews, id);
      let next = current.value;
      if (input.scheduledAt !== undefined) next = rescheduleInterview(next, input.scheduledAt, dependencies.now());
      if (input.questionId && input.practiceStatus) next = updateQuestionPractice(next, input.questionId, input.practiceStatus, dependencies.now());
      return success(await dependencies.interviews.save(next, input.expectedRevision));
    }),
  };
}
