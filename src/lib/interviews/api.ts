import { assertSameOrigin, requireSession } from "@/lib/auth";
import { applicationRepository } from "@/lib/applications/repository";

import { createInterviewApi } from "./handlers";
import { interviewRepository } from "./repository";

export const interviewApi = createInterviewApi({
  authenticate: requireSession,
  assertMutationOrigin: assertSameOrigin,
  applications: applicationRepository,
  interviews: interviewRepository,
  now: () => new Date().toISOString(),
  id: () => crypto.randomUUID(),
});
