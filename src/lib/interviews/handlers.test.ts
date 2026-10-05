import { describe, expect, it, vi } from "vitest";

import { createApplication, transitionApplication } from "@/lib/applications/domain";
import { StorageConflictError } from "@/lib/storage";

import { createInterviewApi, type InterviewApiDependencies } from "./handlers";
import type { InterviewWorkspace } from "./schema";

const now = "2026-10-03T10:00:00.000Z";

function jsonRequest(url: string, method: string, value: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}

function makeWorkspace(overrides: Partial<InterviewWorkspace> = {}): InterviewWorkspace {
  return {
    schemaVersion: 1,
    id: "interview-1",
    applicationId: "app-1",
    company: "Acme",
    role: "Engineer",
    scheduledAt: null,
    sections: {
      companyResearch: ["Read the company site."],
      roleAnalysis: ["Review the role."],
      whyYouMatch: ["Relevant approved evidence."],
      technicalQuestions: [
        {
          id: "question-1",
          prompt: "How would you design the system?",
          guidance: "Answer from approved experience.",
          evidenceIds: [],
          practiceStatus: "not_practiced",
          practicedAt: null,
        },
      ],
      projectQuestions: [],
      behavioralQuestions: [],
      hrQuestions: [],
      gapQuestions: [],
      questionsForInterviewer: [],
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<InterviewApiDependencies> = {}): InterviewApiDependencies {
  const workspace = makeWorkspace();
  return {
    authenticate: vi.fn().mockResolvedValue(undefined),
    assertMutationOrigin: vi.fn(),
    applications: { findById: vi.fn().mockResolvedValue(null) },
    interviews: {
      list: vi.fn().mockResolvedValue([{ schemaVersion: 1, revision: 1, updatedAt: now, value: workspace }]),
      findById: vi.fn().mockResolvedValue({ schemaVersion: 1, revision: 1, updatedAt: now, value: workspace }),
      findByApplicationId: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (value) => ({
        schemaVersion: 1,
        revision: 2,
        updatedAt: value.updatedAt,
        value,
      })),
    },
    now: () => "2026-10-03T11:00:00.000Z",
    id: () => "interview-1",
    ...overrides,
  };
}

async function body(response: Response) {
  return response.json() as Promise<{ success: boolean; data: unknown; error: { code: string } | null }>;
}

describe("interview API", () => {
  it("creates a workspace only after an application reaches interview", async () => {
    const saved = createApplication(
      { jobId: "job-1", company: "Acme", role: "Engineer", url: "https://example.com/1" },
      now,
      "app-1",
    );
    const deps: InterviewApiDependencies = {
      authenticate: vi.fn().mockResolvedValue(undefined),
      assertMutationOrigin: vi.fn(),
      applications: { findById: vi.fn().mockResolvedValue({ schemaVersion: 1 as const, revision: 1, updatedAt: saved.updatedAt, value: saved }) },
      interviews: { list: vi.fn(), findById: vi.fn(), findByApplicationId: vi.fn(), save: vi.fn() },
      now: () => now,
      id: () => "interview-1",
    };
    const response = await createInterviewApi(deps).create(
      jsonRequest("https://career.test/api/interviews", "POST", { applicationId: "app-1", expectedRevision: 0 }),
    );
    expect(response.status).toBe(409);

    const applied = transitionApplication(transitionApplication(transitionApplication(saved, "preparing", saved.updatedAt), "ready", saved.updatedAt), "applied", saved.updatedAt);
    const interviewing = transitionApplication(applied, "interview", saved.updatedAt);
    vi.mocked(deps.applications.findById).mockResolvedValue({ schemaVersion: 1, revision: 1, updatedAt: interviewing.updatedAt, value: interviewing });
    vi.mocked(deps.interviews.save).mockImplementation(async (value) => ({ schemaVersion: 1, revision: 1, updatedAt: value.updatedAt, value: { schemaVersion: 1, interviews: [value] } }));
    const created = await createInterviewApi(deps).create(
      jsonRequest("https://career.test/api/interviews", "POST", { applicationId: "app-1", expectedRevision: 0 }),
    );
    expect(created.status).toBe(201);
  });

  it("lists, gets, and updates interview workspaces through authenticated handlers", async () => {
    const deps = makeDeps();
    const api = createInterviewApi(deps);

    expect((await body(await api.list(new Request("https://career.test/api/interviews")))).success).toBe(true);
    expect((await body(await api.get(new Request("https://career.test/api/interviews/interview-1"), "interview-1"))).success).toBe(true);

    const updated = await api.update(
      jsonRequest("https://career.test/api/interviews/interview-1", "PATCH", {
          expectedRevision: 1,
          scheduledAt: "2026-10-05T09:00:00.000Z",
          questionId: "question-1",
          practiceStatus: "confident",
      }),
      "interview-1",
    );

    expect(updated.status).toBe(200);
    const saved = vi.mocked(deps.interviews.save).mock.calls.at(-1)?.[0];
    expect(saved?.scheduledAt).toBe("2026-10-05T09:00:00.000Z");
    expect(saved?.sections.technicalQuestions[0]?.practiceStatus).toBe("confident");
    expect(deps.assertMutationOrigin).toHaveBeenCalledOnce();
  });

  it("returns stable API errors for invalid and stale interview mutations", async () => {
    const interviews = {
      ...makeDeps().interviews,
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockRejectedValue(new StorageConflictError()),
    };
    const deps = makeDeps({ interviews });
    const api = createInterviewApi(deps);

    const missing = await body(
      await api.update(
        jsonRequest("https://career.test/api/interviews/missing", "PATCH", { expectedRevision: 1, scheduledAt: null }),
        "missing",
      ),
    );
    expect(missing.error?.code).toBe("INTERVIEW_NOT_FOUND");

    interviews.findById.mockResolvedValue({
      schemaVersion: 1,
      revision: 1,
      updatedAt: now,
      value: makeWorkspace(),
    });
    const stale = await body(
      await api.update(
        jsonRequest("https://career.test/api/interviews/interview-1", "PATCH", { expectedRevision: 1, scheduledAt: null }),
        "interview-1",
      ),
    );
    expect(stale.error?.code).toBe("STALE_REVISION");

    const invalid = await body(
      await api.update(
        jsonRequest("https://career.test/api/interviews/interview-1", "PATCH", { expectedRevision: 1, questionId: "question-1" }),
        "interview-1",
      ),
    );
    expect(invalid.error?.code).toBe("VALIDATION_ERROR");
  });
});
