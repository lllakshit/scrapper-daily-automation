import type { CareerProfile } from "@/lib/profile/schemas";

import { generateGroundedPreparation, type ApplicationDraftProvider } from "./preparation";
import {
  ApplicationSchema,
  type Application,
  type ApplicationStatus,
  type CreateApplicationInput,
} from "./schema";

const TRANSITIONS: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  saved: ["preparing", "rejected", "withdrawn"],
  preparing: ["ready", "saved", "rejected", "withdrawn"],
  ready: ["applied", "preparing", "rejected", "withdrawn"],
  applied: ["follow_up", "interview", "offer", "rejected", "withdrawn"],
  follow_up: ["applied", "interview", "offer", "rejected", "withdrawn"],
  interview: ["offer", "rejected", "withdrawn"],
  offer: ["withdrawn"],
  rejected: [],
  withdrawn: [],
};

export class InvalidApplicationTransitionError extends Error {
  constructor(from: ApplicationStatus, to: ApplicationStatus) {
    super(`Application cannot transition from ${from} to ${to}`);
    this.name = "InvalidApplicationTransitionError";
  }
}

function plusDays(timestamp: string, days: number): string {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function createApplication(
  input: CreateApplicationInput,
  now: string,
  id = crypto.randomUUID(),
): Application {
  return ApplicationSchema.parse({
    schemaVersion: 1,
    ...input,
    id,
    notes: input.notes ?? "",
    resumeVersion: input.resumeVersion ?? "",
    status: "saved",
    statusHistory: [{ status: "saved", at: now }],
    preparation: null,
    createdAt: now,
    updatedAt: now,
    appliedAt: null,
    followUpDueAt: null,
    followUpSentAt: null,
    interviewAt: null,
  });
}

export function transitionApplication(
  current: Application,
  status: ApplicationStatus,
  now: string,
  options: { readonly followUpIntervalDays?: number; readonly interviewAt?: string | null } = {},
): Application {
  const application = ApplicationSchema.parse(current);
  if (!TRANSITIONS[application.status].includes(status)) {
    throw new InvalidApplicationTransitionError(application.status, status);
  }
  const followUpIntervalDays = options.followUpIntervalDays ?? 7;
  if (!Number.isSafeInteger(followUpIntervalDays) || followUpIntervalDays < 1 || followUpIntervalDays > 90) {
    throw new RangeError("Follow-up interval must be between 1 and 90 days");
  }
  const appliedAt = status === "applied" && !application.appliedAt ? now : application.appliedAt;
  const followUpDueAt =
    status === "applied" && appliedAt ? plusDays(appliedAt, followUpIntervalDays) : application.followUpDueAt;
  return ApplicationSchema.parse({
    ...structuredClone(application),
    status,
    statusHistory: [...application.statusHistory, { status, at: now }],
    updatedAt: now,
    appliedAt,
    followUpDueAt,
    interviewAt: status === "interview" ? (options.interviewAt ?? application.interviewAt) : application.interviewAt,
  });
}

export function calculateFollowUpDueAt(application: Application, now: string): boolean {
  const eligible = application.status === "applied" || application.status === "follow_up";
  return Boolean(
    eligible &&
      application.followUpDueAt &&
      !application.followUpSentAt &&
      Date.parse(application.followUpDueAt) <= Date.parse(now),
  );
}

export async function prepareApplication(
  current: Application,
  profile: CareerProfile,
  provider: ApplicationDraftProvider | undefined,
  now: string,
): Promise<Application> {
  if (current.status !== "preparing") {
    throw new InvalidApplicationTransitionError(current.status, "preparing");
  }
  const preparation = await generateGroundedPreparation(current, profile, provider, now);
  return ApplicationSchema.parse({ ...structuredClone(current), preparation, updatedAt: now });
}

export function approvePreparation(current: Application, now: string): Application {
  if (!current.preparation) throw new Error("Prepare the application before approving it");
  const withApproval = ApplicationSchema.parse({
    ...structuredClone(current),
    preparation: { ...current.preparation, approvedAt: now, updatedAt: now },
    updatedAt: now,
  });
  return current.status === "preparing"
    ? transitionApplication(withApproval, "ready", now)
    : withApproval;
}
