import { describe, expect, it, vi } from "vitest";

import { createProfileApi, type ProfileApiDependencies } from "./handlers";
import { createEmptyCareerProfile } from "./schemas";

function dependencies(overrides: Partial<ProfileApiDependencies> = {}): ProfileApiDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue(undefined),
    assertMutationOrigin: vi.fn(),
    now: () => "2026-10-03T12:00:00.000Z",
    repository: {
      readProfile: vi.fn().mockResolvedValue(null),
      writeProfile: vi.fn().mockImplementation(async (value, expectedRevision) => ({
        schemaVersion: 1,
        revision: expectedRevision + 1,
        updatedAt: "2026-10-03T12:00:00.000Z",
        value,
      })),
      readPreferences: vi.fn().mockResolvedValue(null),
      writePreferences: vi.fn().mockImplementation(async (value, expectedRevision) => ({
        schemaVersion: 1,
        revision: expectedRevision + 1,
        updatedAt: "2026-10-03T12:00:00.000Z",
        value,
      })),
    },
    extract: vi.fn(),
    resumeArtifacts: {
      save: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

describe("profile API", () => {
  it("fails closed when authentication rejects the request", async () => {
    const unauthorized = new Error("Authentication required");
    unauthorized.name = "UnauthorizedError";
    const deps = dependencies({ authenticate: vi.fn().mockRejectedValue(unauthorized) });

    const response = await createProfileApi(deps).getProfile(
      new Request("https://app.example/api/profile"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("authenticates reads and returns an empty state when onboarding has not started", async () => {
    const deps = dependencies();
    const response = await createProfileApi(deps).getProfile(
      new Request("https://app.example/api/profile"),
    );

    expect(deps.authenticate).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: null, error: null });
  });

  it("validates patches and writes against the browser's expected revision", async () => {
    const current = createEmptyCareerProfile("2026-10-03T10:00:00.000Z");
    const deps = dependencies({
      repository: {
        ...dependencies().repository,
        readProfile: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          revision: 4,
          updatedAt: current.updatedAt,
          value: current,
        }),
      },
    });
    const request = new Request("https://app.example/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "https://app.example" },
      body: JSON.stringify({ expectedRevision: 4, patch: { personal: { name: "Asha" } } }),
    });

    const response = await createProfileApi(deps).patchProfile(request);

    expect(response.status).toBe(200);
    expect(deps.repository.writeProfile).toHaveBeenCalledWith(
      expect.objectContaining({ personal: expect.objectContaining({ name: "Asha" }) }),
      4,
    );
  });

  it("rejects approval of an incomplete draft", async () => {
    const current = createEmptyCareerProfile("2026-10-03T10:00:00.000Z");
    const deps = dependencies({
      repository: {
        ...dependencies().repository,
        readProfile: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          revision: 1,
          updatedAt: current.updatedAt,
          value: current,
        }),
      },
    });
    const response = await createProfileApi(deps).approveProfile(
      new Request("https://app.example/api/profile/approve", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://app.example" },
        body: JSON.stringify({ expectedRevision: 1 }),
      }),
    );

    expect(response.status).toBe(422);
  });

  it("does not expose extracted resume text in the response", async () => {
    const profile = createEmptyCareerProfile("2026-10-03T10:00:00.000Z");
    const deps = dependencies({
      extract: vi.fn().mockResolvedValue({ profile, text: "private resume contents", sha256: "a".repeat(64) }),
    });
    const form = new FormData();
    form.set("resume", new File(["Asha"], "resume.txt", { type: "text/plain" }));

    const response = await createProfileApi(deps).uploadResume(
      new Request("https://app.example/api/resume", {
        method: "POST",
        headers: { origin: "https://app.example", "content-length": "1024" },
        body: form,
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(201);
    expect(body).not.toContain("private resume contents");
    expect(deps.repository.writeProfile).toHaveBeenCalledWith(profile, 0);
  });

  it("saves a public resume artifact reference with the extracted profile", async () => {
    const profile = {
      ...createEmptyCareerProfile("2026-10-03T10:00:00.000Z"),
      resumeSource: {
        originalName: "resume.txt",
        mediaType: "text/plain" as const,
        size: 4,
        sha256: "a".repeat(64),
        extractedAt: "2026-10-03T10:00:00.000Z",
      },
    };
    const deps = dependencies({
      extract: vi.fn().mockResolvedValue({ profile, text: "Asha", sha256: "a".repeat(64) }),
      resumeArtifacts: {
        save: vi.fn().mockResolvedValue({ blobPath: "career-autopilot/resumes/resume.txt" }),
      },
    });
    const form = new FormData();
    form.set("resume", new File(["Asha"], "resume.txt", { type: "text/plain" }));

    const response = await createProfileApi(deps).uploadResume(
      new Request("https://app.example/api/resume", {
        method: "POST",
        headers: { origin: "https://app.example", "content-length": "1024" },
        body: form,
      }),
    );

    expect(response.status).toBe(201);
    expect(deps.resumeArtifacts.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: "resume.txt" }),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      "text/plain",
    );
    expect(deps.repository.writeProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeSource: expect.objectContaining({
          blobPath: "career-autopilot/resumes/resume.txt",
        }),
      }),
      0,
    );
  });

  it("requires the current revision when replacing a resume", async () => {
    const profile = createEmptyCareerProfile("2026-10-03T10:00:00.000Z");
    const deps = dependencies({
      repository: {
        ...dependencies().repository,
        readProfile: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          revision: 3,
          updatedAt: profile.updatedAt,
          value: profile,
        }),
      },
    });
    const form = new FormData();
    form.set("resume", new File(["Asha"], "resume.txt", { type: "text/plain" }));

    const response = await createProfileApi(deps).uploadResume(
      new Request("https://app.example/api/resume", {
        method: "POST",
        headers: { origin: "https://app.example", "content-length": "1024" },
        body: form,
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "EXPECTED_REVISION_REQUIRED" } });
    expect(deps.extract).not.toHaveBeenCalled();
  });

  it("rejects a stale resume replacement revision", async () => {
    const profile = createEmptyCareerProfile("2026-10-03T10:00:00.000Z");
    const deps = dependencies({
      repository: {
        ...dependencies().repository,
        readProfile: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          revision: 3,
          updatedAt: profile.updatedAt,
          value: profile,
        }),
      },
    });
    const form = new FormData();
    form.set("resume", new File(["Asha"], "resume.txt", { type: "text/plain" }));
    form.set("expectedRevision", "2");

    const response = await createProfileApi(deps).uploadResume(
      new Request("https://app.example/api/resume", {
        method: "POST",
        headers: { origin: "https://app.example", "content-length": "1024" },
        body: form,
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "STALE_REVISION" } });
    expect(deps.extract).not.toHaveBeenCalled();
  });

  it("rejects an oversized multipart request before parsing its body", async () => {
    const deps = dependencies();
    const response = await createProfileApi(deps).uploadResume(
      new Request("https://app.example/api/resume", {
        method: "POST",
        headers: {
          origin: "https://app.example",
          "content-type": "multipart/form-data; boundary=unused",
          "content-length": String(6 * 1024 * 1024),
        },
        body: "--unused--",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "FILE_TOO_LARGE" } });
    expect(deps.repository.readProfile).not.toHaveBeenCalled();
  });

  it("requires a declared request size so chunked uploads cannot bypass the cap", async () => {
    const deps = dependencies();
    const response = await createProfileApi(deps).uploadResume(
      new Request("https://app.example/api/resume", {
        method: "POST",
        headers: {
          origin: "https://app.example",
          "content-type": "multipart/form-data; boundary=unused",
        },
        body: "--unused--",
      }),
    );

    expect(response.status).toBe(411);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_SIZE_REQUIRED" } });
    expect(deps.repository.readProfile).not.toHaveBeenCalled();
  });

  it("validates and creates preferences", async () => {
    const deps = dependencies();
    const response = await createProfileApi(deps).putPreferences(
      new Request("https://app.example/api/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json", origin: "https://app.example" },
        body: JSON.stringify({
          expectedRevision: 0,
          preferences: {
            targetRoles: ["AI Engineer"],
            locations: ["Remote"],
            workModes: ["remote"],
            employmentTypes: ["full-time"],
            preferredMinimumSalary: 1_000_000,
            salaryCurrency: "INR",
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(deps.repository.writePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ targetRoles: ["AI Engineer"] }),
      0,
    );
  });

  it("rejects malformed JSON without leaking server details", async () => {
    const response = await createProfileApi(dependencies()).patchProfile(
      new Request("https://app.example/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json", origin: "https://app.example" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_JSON" } });
  });
});
