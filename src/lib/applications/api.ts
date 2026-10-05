import { assertSameOrigin, requireSession } from "@/lib/auth";
import { profileRepository } from "@/lib/profile/repository";

import { createApplicationApi } from "./handlers";
import { applicationRepository } from "./repository";

export const applicationApi = createApplicationApi({
  authenticate: requireSession,
  assertMutationOrigin: assertSameOrigin,
  applications: applicationRepository,
  readProfile: () => profileRepository.readProfile(),
  now: () => new Date().toISOString(),
  id: () => crypto.randomUUID(),
});
