import { z } from "zod";

import type { CareerProfile } from "@/lib/profile/schemas";
import type { VersionedRecord } from "@/lib/storage";
import { JsonRequestError, readJsonBody } from "@/lib/http/read-json";

import {
  approvePreparation,
  createApplication,
  prepareApplication,
  transitionApplication,
} from "./domain";
import type { ApplicationDraftProvider } from "./preparation";
import type { StoredApplicationRepository } from "./repository";
import {
  ApplicationStatusSchema,
  type Application,
} from "./schema";

type ApplicationRepository = Pick<StoredApplicationRepository, "list" | "findById" | "save">;

export interface ApplicationApiDependencies {
  readonly authenticate: (request: Request) => Promise<unknown>;
  readonly assertMutationOrigin: (request: Request) => void;
  readonly applications: ApplicationRepository;
  readonly readProfile: () => Promise<VersionedRecord<CareerProfile> | null>;
  readonly draftProvider?: ApplicationDraftProvider;
  readonly now: () => string;
  readonly id: () => string;
}

const createRequest = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    jobId: z.string().trim().min(1).max(200),
    company: z.string().trim().min(1).max(300),
    role: z.string().trim().min(1).max(300),
    url: z.url(),
    notes: z.string().trim().max(20_000).optional(),
    resumeVersion: z.string().trim().max(255).optional(),
  })
  .strict();
const updateRequest = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    status: ApplicationStatusSchema.optional(),
    notes: z.string().trim().max(20_000).optional(),
    resumeVersion: z.string().trim().max(255).optional(),
    followUpIntervalDays: z.number().int().min(1).max(90).optional(),
    interviewAt: z.iso.datetime().nullable().optional(),
  })
  .strict();
const prepareRequest = z
  .object({ expectedRevision: z.number().int().nonnegative(), approve: z.boolean().default(false) })
  .strict();

const success = <T>(data: T, status = 200) =>
  Response.json({ success: true, data, error: null }, { status });
const failure = (status: number, code: string, message: string, details?: unknown) =>
  Response.json(
    { success: false, data: null, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );

class ApplicationNotFoundError extends Error {}
class CareerProfileNotFoundError extends Error {}

function errorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return failure(422, "VALIDATION_ERROR", "Review the application fields", z.flattenError(error));
  }
  if (error instanceof JsonRequestError) return failure(error.status, error.code, error.message);
  if (error instanceof SyntaxError) return failure(400, "INVALID_JSON", "The request body must be valid JSON");
  if (error instanceof ApplicationNotFoundError) return failure(404, "APPLICATION_NOT_FOUND", "Application not found");
  if (error instanceof CareerProfileNotFoundError) return failure(409, "PROFILE_REQUIRED", "Approve a career profile first");
  if (error instanceof Error && error.name === "UnauthorizedError") return failure(401, "UNAUTHORIZED", "Authentication required");
  if (error instanceof Error && error.name === "InvalidOriginError") return failure(403, "INVALID_ORIGIN", "Request origin is not allowed");
  if (error instanceof Error && error.name === "StorageConflictError") return failure(409, "STALE_REVISION", "Application data changed. Refresh and try again.");
  if (error instanceof Error && error.name === "DuplicateApplicationError") return failure(409, "DUPLICATE_APPLICATION", error.message);
  if (error instanceof Error && error.name === "InvalidApplicationTransitionError") return failure(409, "INVALID_TRANSITION", error.message);
  if (error instanceof Error && error.name === "ProfileApprovalRequiredError") return failure(409, "PROFILE_APPROVAL_REQUIRED", error.message);
  if (error instanceof Error && error.name === "GroundingViolationError") return failure(422, "UNGROUNDED_DRAFT", error.message);
  return failure(500, "INTERNAL_ERROR", "The request could not be completed");
}

async function safely(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    return errorResponse(error);
  }
}

async function existing(
  repository: ApplicationRepository,
  id: string,
): Promise<VersionedRecord<Application>> {
  const record = await repository.findById(id);
  if (!record) throw new ApplicationNotFoundError();
  return record;
}

export function createApplicationApi(dependencies: ApplicationApiDependencies) {
  return {
    list: (request: Request) =>
      safely(async () => {
        await dependencies.authenticate(request);
        return success(await dependencies.applications.list());
      }),
    get: (request: Request, id: string) =>
      safely(async () => {
        await dependencies.authenticate(request);
        return success(await existing(dependencies.applications, id));
      }),
    create: (request: Request) =>
      safely(async () => {
        await dependencies.authenticate(request);
        dependencies.assertMutationOrigin(request);
        const input = createRequest.parse(await readJsonBody(request));
        const { expectedRevision, ...applicationInput } = input;
        const application = createApplication(applicationInput, dependencies.now(), dependencies.id());
        return success(
          await dependencies.applications.save(application, expectedRevision),
          201,
        );
      }),
    update: (request: Request, id: string) =>
      safely(async () => {
        await dependencies.authenticate(request);
        dependencies.assertMutationOrigin(request);
        const input = updateRequest.parse(await readJsonBody(request));
        const current = await existing(dependencies.applications, id);
        let next: Application = {
          ...structuredClone(current.value),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.resumeVersion !== undefined ? { resumeVersion: input.resumeVersion } : {}),
          updatedAt: dependencies.now(),
        };
        if (input.status) {
          next = transitionApplication(next, input.status, dependencies.now(), {
            followUpIntervalDays: input.followUpIntervalDays,
            interviewAt: input.interviewAt,
          });
        }
        return success(await dependencies.applications.save(next, input.expectedRevision));
      }),
    prepare: (request: Request, id: string) =>
      safely(async () => {
        await dependencies.authenticate(request);
        dependencies.assertMutationOrigin(request);
        const input = prepareRequest.parse(await readJsonBody(request));
        const current = await existing(dependencies.applications, id);
        const profile = await dependencies.readProfile();
        if (!profile) throw new CareerProfileNotFoundError();
        let next = await prepareApplication(
          current.value,
          profile.value,
          dependencies.draftProvider,
          dependencies.now(),
        );
        if (input.approve) next = approvePreparation(next, dependencies.now());
        return success(await dependencies.applications.save(next, input.expectedRevision));
      }),
  };
}
