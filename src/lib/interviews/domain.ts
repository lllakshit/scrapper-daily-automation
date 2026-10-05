import {
  InterviewWorkspaceSchema,
  type CreateInterviewInput,
  type InterviewDraft,
  type InterviewQuestion,
  type InterviewQuestionDraft,
  type InterviewSections,
  type InterviewWorkspace,
  type PracticeStatus,
} from "./schema";

export interface InterviewPreparationProvider {
  generate(input: Readonly<CreateInterviewInput>): Promise<InterviewDraft>;
}

export class InterviewGroundingError extends Error {
  constructor() {
    super("Interview preparation cites evidence outside the approved application context");
    this.name = "InterviewGroundingError";
  }
}

export class EvidenceOnlyInterviewProvider implements InterviewPreparationProvider {
  async generate(input: Readonly<CreateInterviewInput>): Promise<InterviewDraft> {
    const first = input.evidence[0];
    const ids = first ? [first.id] : [];
    const guidance = first ? `Ground your answer in this approved evidence: ${first.excerpt}` : "Answer honestly; do not invent experience.";
    return {
      companyResearch: [`Research ${input.company}'s official website, product, customers, and recent announcements before the interview.`],
      roleAnalysis: [`Review the published responsibilities and requirements for the ${input.role} role.`],
      whyYouMatch: first ? [first.excerpt] : ["No approved evidence is available yet; add evidence before drafting claims."],
      technicalQuestions: [{ prompt: `Which technical decisions are most important in a ${input.role} role?`, guidance, evidenceIds: ids }],
      projectQuestions: [{ prompt: "Walk through a relevant project and the decisions you made.", guidance, evidenceIds: ids }],
      behavioralQuestions: [{ prompt: "Tell me about a difficult problem and how you handled it.", guidance, evidenceIds: ids }],
      hrQuestions: [{ prompt: `Why are you interested in the ${input.role} position?`, guidance: "Connect your honest goals to the published role.", evidenceIds: [] }],
      gapQuestions: [{ prompt: "Which requirement would require the most learning?", guidance: "State the gap directly and describe a realistic learning plan.", evidenceIds: [] }],
      questionsForInterviewer: [{ prompt: "What would success look like in the first 90 days?", guidance: "Use the answer to clarify priorities and expectations.", evidenceIds: [] }],
    };
  }
}

const QUESTION_KEYS = [
  "technicalQuestions",
  "projectQuestions",
  "behavioralQuestions",
  "hrQuestions",
  "gapQuestions",
  "questionsForInterviewer",
] as const;

function validateEvidence(draft: InterviewDraft, input: CreateInterviewInput): void {
  const allowed = new Set(input.evidence.map(({ id }) => id));
  const cited = QUESTION_KEYS.flatMap((key) => draft[key].flatMap(({ evidenceIds }) => evidenceIds));
  if (cited.some((id) => !allowed.has(id))) throw new InterviewGroundingError();
}

function questions(values: readonly InterviewQuestionDraft[]): InterviewQuestion[] {
  return values.map((question) => ({
    ...question,
    evidenceIds: [...question.evidenceIds],
    id: crypto.randomUUID(),
    practiceStatus: "not_practiced" as const,
    practicedAt: null,
  }));
}

export async function createInterviewWorkspace(
  input: CreateInterviewInput,
  provider: InterviewPreparationProvider = new EvidenceOnlyInterviewProvider(),
  now: string,
  id = crypto.randomUUID(),
): Promise<InterviewWorkspace> {
  const draft = await provider.generate(structuredClone(input));
  validateEvidence(draft, input);
  return InterviewWorkspaceSchema.parse({
    schemaVersion: 1,
    id,
    applicationId: input.applicationId,
    company: input.company,
    role: input.role,
    scheduledAt: input.scheduledAt ?? null,
    sections: {
      companyResearch: [...draft.companyResearch],
      roleAnalysis: [...draft.roleAnalysis],
      whyYouMatch: [...draft.whyYouMatch],
      technicalQuestions: questions(draft.technicalQuestions),
      projectQuestions: questions(draft.projectQuestions),
      behavioralQuestions: questions(draft.behavioralQuestions),
      hrQuestions: questions(draft.hrQuestions),
      gapQuestions: questions(draft.gapQuestions),
      questionsForInterviewer: questions(draft.questionsForInterviewer),
    },
    createdAt: now,
    updatedAt: now,
  });
}

export class InterviewQuestionNotFoundError extends Error {
  constructor() {
    super("Interview question was not found");
    this.name = "InterviewQuestionNotFoundError";
  }
}

export function updateQuestionPractice(
  current: InterviewWorkspace,
  questionId: string,
  practiceStatus: PracticeStatus,
  now: string,
): InterviewWorkspace {
  let found = false;
  const sections = structuredClone(current.sections);
  for (const key of QUESTION_KEYS) {
    sections[key] = sections[key].map((question) => {
      if (question.id !== questionId) return question;
      found = true;
      return { ...question, practiceStatus, practicedAt: now };
    });
  }
  if (!found) throw new InterviewQuestionNotFoundError();
  return InterviewWorkspaceSchema.parse({ ...structuredClone(current), sections, updatedAt: now });
}

export function rescheduleInterview(
  current: InterviewWorkspace,
  scheduledAt: string | null,
  now: string,
): InterviewWorkspace {
  return InterviewWorkspaceSchema.parse({ ...structuredClone(current), scheduledAt, updatedAt: now });
}

export function allInterviewQuestions(sections: InterviewSections): readonly InterviewQuestion[] {
  return QUESTION_KEYS.flatMap((key) => sections[key]);
}
