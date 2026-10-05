import type { JobMatch, JobMatcher, MatchClassification } from "@/lib/discovery";
import type { JobPreferences, NormalizedJob } from "@/lib/jobs/schema";

const TECHNICAL_SIGNALS = ["python", "typescript", "javascript", "fastapi", "node", "next", "docker", "postgres", "llm", "genai", "ai", "automation", "api"];

function words(value: string): readonly string[] {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function overlap(left: string, right: string): number {
  const a = new Set(words(left));
  const b = new Set(words(right));
  if (!a.size || !b.size) return 0;
  return [...a].filter((word) => b.has(word)).length / Math.max(1, Math.min(a.size, b.size));
}

function roleScore(job: NormalizedJob, preferences: JobPreferences): number {
  return Math.round(Math.max(0, ...preferences.targetRoles.map((role) => overlap(job.title, role))) * 40);
}

function classification(score: number, experienceRejected: boolean): MatchClassification {
  if (experienceRejected) return "reject";
  if (score >= 85) return "excellent";
  if (score >= 70) return "strong";
  if (score >= 50) return "review";
  return "reject";
}

export function createDeterministicMatcher(preferences: JobPreferences): JobMatcher {
  return {
    async evaluate(job): Promise<JobMatch> {
      const reasons: string[] = [];
      const strengths: string[] = [];
      const gaps: string[] = [];
      let score = roleScore(job, preferences);
      if (score >= 28) reasons.push("Role closely matches your target roles");

      const location = job.location.toLowerCase();
      const locationMatch = job.remoteType === "remote" || preferences.locations.some((item) => location.includes(item.toLowerCase()));
      if (locationMatch) { score += 15; reasons.push("Location fits your preferences"); }

      if (preferences.workModes.includes(job.remoteType)) { score += 10; reasons.push("Work mode is suitable"); }
      if (preferences.employmentTypes.includes(job.employmentType)) { score += 10; reasons.push("Employment type is suitable"); }

      const jobText = `${job.title} ${job.description} ${job.skills.join(" ")}`.toLowerCase();
      const signals = TECHNICAL_SIGNALS.filter((skill) => jobText.includes(skill));
      score += Math.min(20, signals.length * 4);
      strengths.push(...signals.slice(0, 6).map((skill) => skill === "ai" ? "AI" : skill === "llm" ? "LLM" : skill));

      const experienceRejected = job.experienceMin !== undefined && job.experienceMin > preferences.yearsOfExperience + preferences.maxExperienceStretch;
      if (experienceRejected) {
        score = Math.min(score, 45);
        gaps.push(`Requires ${job.experienceMin}+ years of experience`);
      } else {
        score += 5;
        reasons.push("Experience requirement is within your configured range");
      }

      const boundedScore = Math.max(0, Math.min(100, score));
      return { job, score: boundedScore, classification: classification(boundedScore, experienceRejected), reasons, strengths, gaps };
    },
  };
}
