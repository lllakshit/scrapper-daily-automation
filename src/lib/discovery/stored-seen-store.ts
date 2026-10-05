import { getJsonStore } from "@/lib/storage";
import type { SeenJobStore, SeenJobState } from "@/lib/jobs/seen-store";

const KEY = "ledger/seen-jobs";
const SCHEMA_VERSION = 1;
const EMPTY: SeenJobState = { version: 1, aliases: {} };

export class StoredSeenJobStore implements SeenJobStore {
  async hasAny(aliases: readonly string[]): Promise<boolean> {
    const record = await getJsonStore().read<SeenJobState>(KEY, { schemaVersion: SCHEMA_VERSION });
    const state = record?.value ?? EMPTY;
    return aliases.some((alias) => state.aliases[alias] !== undefined);
  }

  async markSeen(aliases: readonly string[], seenAt: string): Promise<void> {
    await getJsonStore().update<SeenJobState>(KEY, { schemaVersion: SCHEMA_VERSION, initialValue: EMPTY }, (current) => ({
      version: 1,
      aliases: { ...current.aliases, ...Object.fromEntries(aliases.map((alias) => [alias, seenAt])) },
    }));
  }
}
