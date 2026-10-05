import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyCareerProfile } from "@/lib/profile";
import { NormalizedJobSchema } from "@/lib/jobs/schema";
import { createAiJobMatcher } from "./job-matcher";
import { configuredAiProvider, OpenAiCompatibleProvider, type AiProvider } from "./provider";
import { z } from "zod";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI abstraction", () => {
  it("stays disabled unless both a key and model are configured", () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_MODEL", "");
    expect(configuredAiProvider()).toBeNull();
  });

  it("validates structured provider responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ score: 91 }) } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiCompatibleProvider("secret", "model", "https://ai.example.test/v1/chat/completions");
    await expect(provider.generateObject({ system: "system", prompt: "prompt", schema: z.object({ score: z.number() }) })).resolves.toEqual({ score: 91 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects provider failures without inventing a result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    const provider = new OpenAiCompatibleProvider("secret", "model", "https://ai.example.test/v1/chat/completions");
    await expect(provider.generateObject({ system: "system", prompt: "prompt", schema: z.object({}) })).rejects.toThrow("HTTP 503");
  });

  it("matches only against an approved profile and returns the original job", async () => {
    const now = "2026-10-04T00:00:00.000Z";
    const profile = { ...createEmptyCareerProfile(now), status: "approved" as const, approvedAt: now, personal: { name: "Lakshit", email: "", location: "India" }, professional: { currentTitle: "AI Engineer", yearsOfExperience: 3, summary: "Engineer", targetRoles: ["AI Engineer"] } };
    const provider: AiProvider = { generateObject: vi.fn().mockResolvedValue({ score: 88, classification: "excellent", reasons: ["Role match"], strengths: ["Python"], gaps: [] }) };
    const job = NormalizedJobSchema.parse({ id: "source:1", source: "source", canonicalUrl: "https://example.com/1", title: "AI Engineer", company: "Acme", location: "Remote", remoteType: "remote", employmentType: "full-time", description: "Build AI systems", discoveredAt: now, sources: [{ source: "source", url: "https://example.com/1" }] });
    const result = await createAiJobMatcher(provider, profile).evaluate(job);
    expect(result.job).toBe(job);
    expect(result.score).toBe(88);
  });
});
