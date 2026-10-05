import type { CareerProfile } from "@/lib/profile/schemas";

import {
  ApplicationPreparationSchema,
  type Application,
  type ApplicationDraft,
  type ApplicationPreparation,
} from "./schema";

export interface ApplicationDraftInput {
  readonly application: Pick<Application, "company" | "role">;
  readonly profile: Readonly<CareerProfile>;
}

export interface ApplicationDraftProvider {
  generate(input: ApplicationDraftInput): Promise<ApplicationDraft>;
}

export class GroundingViolationError extends Error {
  constructor(message = "Generated material contains claims outside the approved career profile") {
    super(message);
    this.name = "GroundingViolationError";
  }
}

export class ProfileApprovalRequiredError extends Error {
  constructor() {
    super("Approve the career profile before preparing an application");
    this.name = "ProfileApprovalRequiredError";
  }
}

function evidenceIds(draft: ApplicationDraft): string[] {
  return [
    ...draft.resumeRecommendations.flatMap((item) => item.evidenceIds),
    ...draft.coverLetter.evidenceIds,
    ...draft.applicationAnswers.flatMap((item) => item.evidenceIds),
    ...draft.keyExperience.flatMap((item) => item.evidenceIds),
    ...(draft.followUpDraft?.evidenceIds ?? []),
  ];
}

function validateGrounding(draft: ApplicationDraft, profile: CareerProfile): void {
  const permitted = new Set(profile.evidence.map(({ id }) => id));
  if (evidenceIds(draft).some((id) => !permitted.has(id))) {
    throw new GroundingViolationError();
  }
}

export class EvidenceOnlyDraftProvider implements ApplicationDraftProvider {
  async generate({ application, profile }: ApplicationDraftInput): Promise<ApplicationDraft> {
    const evidence = profile.evidence.slice(0, 8);
    const recommendations = evidence.map((item) => ({
      content: item.excerpt,
      reason: `This approved profile evidence is relevant to the ${application.role} application.`,
      evidenceIds: [item.id],
    }));
    const first = evidence[0];
    const evidenceSentence = first ? ` My relevant background includes: ${first.excerpt}` : "";
    return {
      resumeRecommendations: recommendations,
      coverLetter: {
        content: `Dear Hiring Team,\n\nI am applying for the ${application.role} position at ${application.company}.${evidenceSentence}\n\nThank you for your consideration.`,
        evidenceIds: first ? [first.id] : [],
      },
      applicationAnswers: [],
      keyExperience: evidence.map((item) => ({ content: item.excerpt, evidenceIds: [item.id] })),
      followUpDraft: {
        content: `Hello, I am following up on my application for the ${application.role} position at ${application.company}. Thank you for your time.`,
        evidenceIds: [],
      },
    };
  }
}

export async function generateGroundedPreparation(
  application: Application,
  profile: CareerProfile,
  provider: ApplicationDraftProvider = new EvidenceOnlyDraftProvider(),
  now: string,
): Promise<ApplicationPreparation> {
  if (profile.status !== "approved") throw new ProfileApprovalRequiredError();
  const draft = await provider.generate({
    application: { company: application.company, role: application.role },
    profile: structuredClone(profile),
  });
  validateGrounding(draft, profile);
  return ApplicationPreparationSchema.parse({
    ...draft,
    generatedAt: now,
    updatedAt: now,
    approvedAt: null,
  });
}
