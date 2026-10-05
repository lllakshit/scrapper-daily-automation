import { createHash } from "node:crypto";

import { z } from "zod";
import { JsonRequestError, readJsonBody } from "@/lib/http/read-json";

import {
  extractResume,
  MAX_RESUME_BYTES,
  ResumeValidationError,
  validateResumeUpload,
  type UploadedResume,
} from "./resume";
import type { ResumeArtifactStore } from "./resume-artifacts";
import {
  CareerPreferencesSchema,
  CareerProfilePatchSchema,
  type CareerPreferences,
  type CareerProfile,
} from "./schemas";
import { approveCareerProfile, updateCareerProfile } from "./updates";

export interface DomainRecord<T> {
  readonly schemaVersion: number;
  readonly revision: number;
  readonly updatedAt: string;
  readonly value: T;
}

export interface ProfileRepository {
  readProfile(): Promise<DomainRecord<CareerProfile> | null>;
  writeProfile(value: CareerProfile, expectedRevision: number): Promise<DomainRecord<CareerProfile>>;
  readPreferences(): Promise<DomainRecord<CareerPreferences> | null>;
  writePreferences(
    value: CareerPreferences,
    expectedRevision: number,
  ): Promise<DomainRecord<CareerPreferences>>;
}

type ResumeExtraction = typeof extractResume;

export interface ProfileApiDependencies {
  readonly authenticate: (request: Request) => Promise<unknown>;
  readonly assertMutationOrigin: (request: Request) => void;
  readonly repository: ProfileRepository;
  readonly now: () => string;
  readonly extract: ResumeExtraction;
  readonly resumeArtifacts: ResumeArtifactStore;
}

const profilePatchRequest = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    patch: CareerProfilePatchSchema,
  })
  .strict();
const approvalRequest = z.object({ expectedRevision: z.number().int().nonnegative() }).strict();
const preferencesRequest = z
  .object({ expectedRevision: z.number().int().nonnegative(), preferences: CareerPreferencesSchema })
  .strict();

const success = <T>(data: T, status = 200) =>
  Response.json({ success: true, data, error: null }, { status });

const failure = (status: number, code: string, message: string, details?: unknown) =>
  Response.json(
    { success: false, data: null, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );

function errorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return failure(422, "VALIDATION_ERROR", "Review the highlighted fields", z.flattenError(error));
  }
  if (error instanceof JsonRequestError) {
    return failure(error.status, error.code, error.message);
  }
  if (error instanceof ResumeValidationError) {
    return failure(
      error.code === "REQUEST_SIZE_REQUIRED" ? 411 : 400,
      error.code,
      error.message,
      error.diagnostic ? { diagnostic: error.diagnostic } : undefined,
    );
  }
  if (error instanceof SyntaxError) {
    return failure(400, "INVALID_JSON", "The request body must be valid JSON");
  }
  if (error instanceof ProfileNotFoundError) {
    return failure(404, "PROFILE_NOT_FOUND", "Upload or create a career profile first");
  }
  if (error instanceof Error && error.name === "UnauthorizedError") {
    return failure(401, "UNAUTHORIZED", "Authentication required");
  }
  if (error instanceof Error && error.name === "InvalidOriginError") {
    return failure(403, "INVALID_ORIGIN", "Request origin is not allowed");
  }
  if (error instanceof Error && error.name === "StorageConflictError") {
    return failure(409, "STALE_REVISION", "This data changed in another session. Refresh and try again.");
  }
  return failure(500, "INTERNAL_ERROR", "The request could not be completed");
}

class ProfileNotFoundError extends Error {}

async function safely(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    return errorResponse(error);
  }
}

async function uploadedResumeFrom(request: Request): Promise<{ upload: UploadedResume; expectedRevision?: number }> {
  const contentLengthHeader = request.headers.get("content-length");
  if (!contentLengthHeader || !/^\d+$/.test(contentLengthHeader)) {
    throw new ResumeValidationError(
      "A valid upload size is required before the resume can be processed",
      "REQUEST_SIZE_REQUIRED",
    );
  }
  const contentLength = Number(contentLengthHeader);
  const maximumMultipartBytes = MAX_RESUME_BYTES + 256 * 1024;
  if (!Number.isSafeInteger(contentLength)) {
    throw new ResumeValidationError(
      "A valid upload size is required before the resume can be processed",
      "REQUEST_SIZE_REQUIRED",
    );
  }
  if (contentLength > maximumMultipartBytes) {
    throw new ResumeValidationError("Resume files must be 5 MB or smaller", "FILE_TOO_LARGE");
  }
  const formData = await request.formData();
  const candidate = formData.get("resume");
  if (!candidate || typeof candidate === "string" || !("arrayBuffer" in candidate)) {
    throw new ResumeValidationError("Choose a resume file to upload", "EMPTY_FILE");
  }
  if (candidate.size > MAX_RESUME_BYTES) {
    throw new ResumeValidationError("Resume files must be 5 MB or smaller", "FILE_TOO_LARGE");
  }
  const revisionValue = formData.get("expectedRevision");
  const expectedRevision =
    typeof revisionValue === "string" && revisionValue !== "" ? Number(revisionValue) : undefined;
  if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) {
    throw new ResumeValidationError("The profile revision is invalid", "TYPE_MISMATCH");
  }
  return {
    upload: {
      name: "name" in candidate && typeof candidate.name === "string" ? candidate.name : "resume",
      type: candidate.type,
      bytes: new Uint8Array(await candidate.arrayBuffer()),
    },
    expectedRevision,
  };
}

export function createProfileApi(dependencies: ProfileApiDependencies) {
  return {
    getProfile: (request: Request) =>
      safely(async () => {
        await dependencies.authenticate(request);
        const record = await dependencies.repository.readProfile();
        return success(record);
      }),

    patchProfile: (request: Request) =>
      safely(async () => {
        await dependencies.authenticate(request);
        dependencies.assertMutationOrigin(request);
        const input = profilePatchRequest.parse(await readJsonBody(request));
        const current = await dependencies.repository.readProfile();
        if (!current) throw new ProfileNotFoundError();
        if (current.revision !== input.expectedRevision) {
          const error = new Error("Stale profile revision");
          error.name = "StorageConflictError";
          throw error;
        }
        const next = updateCareerProfile(current.value, input.patch, dependencies.now());
        return success(await dependencies.repository.writeProfile(next, input.expectedRevision));
      }),

    approveProfile: (request: Request) =>
      safely(async () => {
        await dependencies.authenticate(request);
        dependencies.assertMutationOrigin(request);
        const input = approvalRequest.parse(await readJsonBody(request));
        const current = await dependencies.repository.readProfile();
        if (!current) throw new ProfileNotFoundError();
        if (current.revision !== input.expectedRevision) {
          const error = new Error("Stale profile revision");
          error.name = "StorageConflictError";
          throw error;
        }
        const approved = approveCareerProfile(current.value, dependencies.now());
        return success(await dependencies.repository.writeProfile(approved, input.expectedRevision));
      }),

    getPreferences: (request: Request) =>
      safely(async () => {
        await dependencies.authenticate(request);
        return success(await dependencies.repository.readPreferences());
      }),

    putPreferences: (request: Request) =>
      safely(async () => {
        await dependencies.authenticate(request);
        dependencies.assertMutationOrigin(request);
        const input = preferencesRequest.parse(await readJsonBody(request));
        const preferences = CareerPreferencesSchema.parse(input.preferences);
        return success(
          await dependencies.repository.writePreferences(preferences, input.expectedRevision),
          input.expectedRevision === 0 ? 201 : 200,
        );
      }),

    uploadResume: (request: Request) =>
      safely(async () => {
        await dependencies.authenticate(request);
        dependencies.assertMutationOrigin(request);
        const { upload, expectedRevision } = await uploadedResumeFrom(request);
        const current = await dependencies.repository.readProfile();
        const revision = current?.revision ?? 0;
        if (current && expectedRevision === undefined) {
          return failure(409, "EXPECTED_REVISION_REQUIRED", "Refresh the profile before replacing its resume");
        }
        if (expectedRevision !== undefined && expectedRevision !== revision) {
          return failure(409, "STALE_REVISION", "This profile changed. Refresh and try again.");
        }
        const { mediaType } = validateResumeUpload(upload);
        const sha256 = createHash("sha256").update(upload.bytes).digest("hex");
        const artifact = await dependencies.resumeArtifacts.save(upload, sha256, mediaType);
        const extracted = await dependencies.extract(upload, { now: dependencies.now });
        const profile = artifact
          ? {
              ...extracted.profile,
              resumeSource: extracted.profile.resumeSource
                ? { ...extracted.profile.resumeSource, blobPath: artifact.blobPath }
                : null,
            }
          : extracted.profile;
        const record = await dependencies.repository.writeProfile(profile, revision);
        return success(record, 201);
      }),
  };
}
