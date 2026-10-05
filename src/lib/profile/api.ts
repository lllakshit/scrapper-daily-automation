import { assertSameOrigin, requireSession } from "@/lib/auth";

import { createProfileApi } from "./handlers";
import { profileRepository } from "./repository";
import { extractResume } from "./resume";
import { resumeArtifactStore } from "./resume-artifacts";

export const profileApi = createProfileApi({
  authenticate: requireSession,
  assertMutationOrigin: assertSameOrigin,
  repository: profileRepository,
  now: () => new Date().toISOString(),
  extract: extractResume,
  resumeArtifacts: resumeArtifactStore,
});
