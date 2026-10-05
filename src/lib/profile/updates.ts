import {
  CareerPreferencesPatchSchema,
  CareerPreferencesSchema,
  CareerProfilePatchSchema,
  CareerProfileSchema,
  type CareerPreferences,
  type CareerPreferencesPatch,
  type CareerProfile,
  type CareerProfilePatch,
} from "./schemas";

function copyProfile(profile: CareerProfile): CareerProfile {
  return {
    ...profile,
    personal: { ...profile.personal },
    professional: { ...profile.professional, targetRoles: [...profile.professional.targetRoles] },
    skills: Object.fromEntries(
      Object.entries(profile.skills).map(([key, values]) => [key, [...values]]),
    ) as CareerProfile["skills"],
    experience: profile.experience.map((item) => ({
      ...item,
      responsibilities: [...item.responsibilities],
      achievements: [...item.achievements],
      technologies: [...item.technologies],
      evidenceIds: [...item.evidenceIds],
    })),
    projects: profile.projects.map((item) => ({
      ...item,
      technologies: [...item.technologies],
      evidenceIds: [...item.evidenceIds],
    })),
    education: profile.education.map((item) => ({ ...item, evidenceIds: [...item.evidenceIds] })),
    certifications: profile.certifications.map((item) => ({
      ...item,
      evidenceIds: [...item.evidenceIds],
    })),
    evidence: profile.evidence.map((item) => ({ ...item })),
    extractionWarnings: [...profile.extractionWarnings],
    resumeSource: profile.resumeSource ? { ...profile.resumeSource } : null,
  };
}

export function updateCareerProfile(
  current: CareerProfile,
  input: CareerProfilePatch,
  now: string,
): CareerProfile {
  const profile = copyProfile(CareerProfileSchema.parse(current));
  const patch = CareerProfilePatchSchema.parse(input);

  return CareerProfileSchema.parse({
    ...profile,
    status: "draft",
    approvedAt: null,
    updatedAt: now,
    personal: { ...profile.personal, ...patch.personal },
    professional: { ...profile.professional, ...patch.professional },
    skills: { ...profile.skills, ...patch.skills },
    experience: patch.experience ?? profile.experience,
    projects: patch.projects ?? profile.projects,
    education: patch.education ?? profile.education,
    certifications: patch.certifications ?? profile.certifications,
  });
}

export function approveCareerProfile(current: CareerProfile, now: string): CareerProfile {
  const profile = copyProfile(CareerProfileSchema.parse(current));
  return CareerProfileSchema.parse({ ...profile, status: "approved", approvedAt: now, updatedAt: now });
}

export function updateCareerPreferences(
  current: CareerPreferences,
  input: CareerPreferencesPatch,
): CareerPreferences {
  const preferences = CareerPreferencesSchema.parse(current);
  const patch = CareerPreferencesPatchSchema.parse(input);
  return CareerPreferencesSchema.parse({
    ...preferences,
    targetRoles: [...(patch.targetRoles ?? preferences.targetRoles)],
    locations: [...(patch.locations ?? preferences.locations)],
    workModes: [...(patch.workModes ?? preferences.workModes)],
    employmentTypes: [...(patch.employmentTypes ?? preferences.employmentTypes)],
  });
}
