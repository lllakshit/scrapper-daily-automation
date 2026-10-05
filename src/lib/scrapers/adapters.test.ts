import { describe, expect, it, vi } from "vitest";

import { ArbeitnowAdapter } from "./arbeitnow";
import { cleanDescription, inferRemoteType, normalizeEmploymentType, requireJson } from "./helpers";
import { RemotiveAdapter } from "./remotive";

const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("RemotiveAdapter", () => {
  it("normalizes valid records and skips malformed records at the source boundary", async () => {
    const request = vi.fn().mockResolvedValue(
      jsonResponse({
        jobs: [
          {
            id: 7,
            url: "https://remotive.example/jobs/7?utm_source=feed",
            title: "LLM Engineer",
            company_name: "Example AI",
            candidate_required_location: "India",
            job_type: "full_time",
            publication_date: "2026-10-01T00:00:00Z",
            description: "<p>Build <strong>LLM</strong> systems</p>",
            tags: ["Python"],
          },
          { id: "missing-required-fields" },
        ],
      }),
    );
    const source = new RemotiveAdapter({
      fetch: request,
      now: () => new Date("2026-10-03T08:00:00.000Z"),
    });

    const jobs = await source.fetchJobs();

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: "remotive:7",
      canonicalUrl: "https://remotive.example/jobs/7",
      description: "Build LLM systems",
      remoteType: "remote",
      employmentType: "full-time",
    });
  });
});

describe("ArbeitnowAdapter", () => {
  it("follows bounded pagination and normalizes epoch posting dates", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              slug: "ai-engineer",
              company_name: "Example AI",
              title: "AI Engineer",
              description: "<p>Build useful AI.</p>",
              remote: true,
              url: "https://arbeitnow.example/jobs/ai-engineer",
              tags: ["Python"],
              job_types: ["Full-time"],
              location: "Berlin",
              created_at: 1790812800,
            },
          ],
          links: { next: "https://www.arbeitnow.com/api/job-board-api?page=2" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: [], links: { next: null } }));
    const source = new ArbeitnowAdapter({
      fetch: request,
      maxPages: 2,
      now: () => new Date("2026-10-03T08:00:00.000Z"),
    });

    const jobs = await source.fetchJobs();

    expect(request).toHaveBeenCalledTimes(2);
    expect(jobs[0]).toMatchObject({
      id: "arbeitnow:ai-engineer",
      remoteType: "remote",
      employmentType: "full-time",
      postedAt: "2026-10-01T00:00:00.000Z",
    });
  });

  it("rejects pagination URLs outside the trusted API origin", async () => {
    const request = vi.fn().mockResolvedValue(
      jsonResponse({ data: [], links: { next: "http://127.0.0.1/internal" } }),
    );
    const source = new ArbeitnowAdapter({ fetch: request, maxPages: 2 });

    await expect(source.fetchJobs()).rejects.toThrow("unsafe pagination URL");
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("scraper helpers", () => {
  it("normalizes descriptions, remote type, and employment type variants", () => {
    expect(cleanDescription("<p>Build&nbsp;<strong>AI</strong></p>")).toBe("Build AI");
    expect(inferRemoteType(false, "Hybrid - Jaipur")).toBe("hybrid");
    expect(inferRemoteType(false, "")).toBe("unknown");
    expect(normalizeEmploymentType("Freelance contract")).toBe("contract");
    expect(normalizeEmploymentType("Internship")).toBe("internship");
    expect(normalizeEmploymentType("Temporary")).toBe("temporary");
    expect(normalizeEmploymentType(undefined)).toBe("unknown");
  });

  it("rejects unhealthy and non-json scraper responses", async () => {
    await expect(requireJson(new Response("nope", { status: 503 }), "source")).rejects.toThrow(
      "source returned HTTP 503",
    );
    await expect(
      requireJson(new Response("text", { headers: { "content-type": "text/plain" } }), "source"),
    ).rejects.toThrow("source returned a non-JSON response");
  });
});
