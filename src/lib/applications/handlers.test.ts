import { describe, expect, it, vi } from "vitest";

import { createEmptyCareerProfile } from "@/lib/profile/schemas";

import { createApplication, transitionApplication } from "./domain";
import { createApplicationApi, type ApplicationApiDependencies } from "./handlers";

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(
  overrides: Partial<ApplicationApiDependencies> = {},
): ApplicationApiDependencies {
  const profile = {
    ...createEmptyCareerProfile("2026-10-03T10:00:00.000Z"),
    status: "approved" as const,
    approvedAt: "2026-10-03T10:00:00.000Z",
    personal: { name: "Lakshit", email: "lakshit@example.com", location: "India" },
    professional: { currentTitle: "Engineer", yearsOfExperience: 3, summary: "", targetRoles: ["Engineer"] },
  };
  return {
    authenticate: vi.fn().mockResolvedValue(undefined),
    assertMutationOrigin: vi.fn(),
    applications: {
      list: vi.fn().mockResolvedValue({ schemaVersion: 1, revision: 0, updatedAt: new Date(0).toISOString(), value: { schemaVersion: 1, applications: [] } }),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn(async (value) => ({ schemaVersion: 1 as const, revision: 1, updatedAt: value.updatedAt, value: { schemaVersion: 1 as const, applications: [value] } })),
    },
    readProfile: vi.fn().mockResolvedValue({ schemaVersion: 1, revision: 1, updatedAt: profile.updatedAt, value: profile }),
    now: () => "2026-10-03T10:00:00.000Z",
    id: () => "app-1",
    ...overrides,
  };
}

describe("application API", () => {
  it("authenticates, validates origin, and creates saved applications", async () => {
    const deps = dependencies();
    const api = createApplicationApi(deps);
    const response = await api.create(
      jsonRequest("https://career.test/api/applications", "POST", { expectedRevision: 0, jobId: "job-1", company: "Acme", role: "Engineer", url: "https://example.com/1" }),
    );
    expect(response.status).toBe(201);
    expect(deps.authenticate).toHaveBeenCalledOnce();
    expect(deps.assertMutationOrigin).toHaveBeenCalledOnce();
  });

  it("never skips readiness when marking an application applied", async () => {
    const saved = createApplication(
      { jobId: "job-1", company: "Acme", role: "Engineer", url: "https://example.com/1" },
      "2026-10-03T09:00:00.000Z",
      "app-1",
    );
    const deps = dependencies({
      applications: {
        list: vi.fn(),
        findById: vi.fn().mockResolvedValue({ schemaVersion: 1, revision: 1, updatedAt: saved.updatedAt, value: saved }),
        save: vi.fn(),
      },
    });
    const response = await createApplicationApi(deps).update(
      jsonRequest("https://career.test/api/applications/app-1", "PATCH", { expectedRevision: 1, status: "applied" }),
      "app-1",
    );
    expect(response.status).toBe(409);
  });

  it("prepares and approves without submitting externally", async () => {
    const saved = createApplication(
      { jobId: "job-1", company: "Acme", role: "Engineer", url: "https://example.com/1" },
      "2026-10-03T09:00:00.000Z",
      "app-1",
    );
    const preparing = transitionApplication(saved, "preparing", saved.updatedAt);
    const save = vi.fn(async (value) => ({ schemaVersion: 1 as const, revision: 2, updatedAt: value.updatedAt, value: { schemaVersion: 1 as const, applications: [value] } }));
    const deps = dependencies({
      applications: { list: vi.fn(), findById: vi.fn().mockResolvedValue({ schemaVersion: 1, revision: 1, updatedAt: preparing.updatedAt, value: preparing }), save },
    });
    const response = await createApplicationApi(deps).prepare(
      jsonRequest("https://career.test/api/applications/app-1/prepare", "POST", { expectedRevision: 1, approve: true }),
      "app-1",
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.value.applications[0].status).toBe("ready");
    expect(save).toHaveBeenCalledOnce();
  });
});
