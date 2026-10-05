import { z } from "zod";

import { buildJobAliases } from "./identity";
import type { NormalizedJob } from "./schema";

const SeenStateSchema = z.object({
  version: z.literal(1),
  aliases: z.record(z.string(), z.iso.datetime()),
});

export type SeenJobState = z.infer<typeof SeenStateSchema>;

export interface SeenJobStore {
  hasAny(aliases: readonly string[]): Promise<boolean>;
  markSeen(aliases: readonly string[], seenAt: string): Promise<void>;
}

export interface SeenJobPersistence {
  read(): Promise<unknown | null>;
  write(state: SeenJobState): Promise<void>;
}

export class PersistentSeenJobStore implements SeenJobStore {
  constructor(private readonly persistence: SeenJobPersistence) {}

  private async readState(): Promise<SeenJobState> {
    const value = await this.persistence.read();
    return value === null ? { version: 1, aliases: {} } : SeenStateSchema.parse(value);
  }

  async hasAny(aliases: readonly string[]): Promise<boolean> {
    const state = await this.readState();
    return aliases.some((alias) => state.aliases[alias] !== undefined);
  }

  async markSeen(aliases: readonly string[], seenAt: string): Promise<void> {
    const state = await this.readState();
    const additions = Object.fromEntries(aliases.map((alias) => [alias, seenAt]));
    await this.persistence.write({ version: 1, aliases: { ...state.aliases, ...additions } });
  }
}

export class InMemorySeenJobStore implements SeenJobStore {
  private aliases: Readonly<Record<string, string>> = {};

  async hasAny(aliases: readonly string[]): Promise<boolean> {
    return aliases.some((alias) => this.aliases[alias] !== undefined);
  }

  async markSeen(aliases: readonly string[], seenAt: string): Promise<void> {
    this.aliases = { ...this.aliases, ...Object.fromEntries(aliases.map((alias) => [alias, seenAt])) };
  }
}

export async function suppressSeenJobs(
  jobs: readonly NormalizedJob[],
  store: SeenJobStore,
): Promise<{ unseen: readonly NormalizedJob[]; suppressed: readonly NormalizedJob[] }> {
  const checks = await Promise.all(
    jobs.map(async (job) => ({ job, seen: await store.hasAny(buildJobAliases(job)) })),
  );
  return checks.reduce(
    (result, check) =>
      check.seen
        ? { ...result, suppressed: [...result.suppressed, check.job] }
        : { ...result, unseen: [...result.unseen, check.job] },
    { unseen: [] as NormalizedJob[], suppressed: [] as NormalizedJob[] },
  );
}

