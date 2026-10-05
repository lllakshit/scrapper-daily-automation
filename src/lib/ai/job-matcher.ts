import { z } from "zod";
import type { CareerProfile } from "@/lib/profile";
import type { JobMatcher } from "@/lib/discovery";
import type { NormalizedJob } from "@/lib/jobs/schema";
import type { AiProvider } from "./provider";

const MatchOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  classification: z.enum(["excellent", "strong", "review", "reject"]),
  reasons: z.array(z.string()).max(8),
  strengths: z.array(z.string()).max(12),
  gaps: z.array(z.string()).max(12),
});

function safeProfile(profile: CareerProfile) {
  return {
    title: profile.professional.currentTitle,
    yearsOfExperience: profile.professional.yearsOfExperience,
    summary: profile.professional.summary,
    targetRoles: profile.professional.targetRoles,
    skills: profile.skills,
    experience: profile.experience,
    projects: profile.projects,
    education: profile.education,
  };
}

function safeJob(job: NormalizedJob) {
  return { title: job.title, company: job.company, location: job.location, remoteType: job.remoteType, employmentType: job.employmentType, salaryMin: job.salaryMin, salaryMax: job.salaryMax, experienceMin: job.experienceMin, experienceMax: job.experienceMax, description: job.description, requirements: job.requirements, responsibilities: job.responsibilities, skills: job.skills };
}

export function createAiJobMatcher(provider: AiProvider, profile: CareerProfile): JobMatcher {
  if (profile.status !== "approved") throw new Error("AI matching requires an approved career profile");
  return {
    async evaluate(job) {
      const output = await provider.generateObject({
        schema: MatchOutputSchema,
        system: "You are a strict career-fit evaluator. Use only the supplied approved profile. Do not infer or invent experience. Mandatory requirements, seniority, real responsibility depth, location, employment type and salary outweigh keyword overlap. Return JSON only.",
        prompt: JSON.stringify({ profile: safeProfile(profile), job: safeJob(job), rubric: { excellent: "85-100", strong: "70-84", review: "50-69", reject: "0-49" } }),
      });
      return { job, ...output };
    },
  };
}
