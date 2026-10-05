import { ArbeitnowAdapter, RemotiveAdapter } from "@/lib/scrapers";
import { profileRepository } from "@/lib/profile/repository";
import { getJsonStore } from "@/lib/storage";
import { createDeterministicMatcher } from "@/lib/matching";
import { configuredAiProvider, createAiJobMatcher } from "@/lib/ai";
import { buildJobAliases } from "@/lib/jobs/identity";
import type { JobPreferences } from "@/lib/jobs/schema";
import type { SeenJobState, SeenJobStore } from "@/lib/jobs/seen-store";
import { runJobScan, sanitizeScanOpportunities, type JobScanResult } from "./scan";

const DISCOVERY_STATE_KEY = "discovery/state";
const EMPTY_SEEN_STATE: SeenJobState = { version: 1, aliases: {} };

export interface DiscoveryState {
  readonly latest: JobScanResult | null;
  readonly seen: SeenJobState;
}

const EMPTY_DISCOVERY_STATE: DiscoveryState = { latest: null, seen: EMPTY_SEEN_STATE };

class SnapshotSeenJobStore implements SeenJobStore {
  constructor(private readonly aliases: Readonly<Record<string, string>>) {}

  async hasAny(aliases: readonly string[]): Promise<boolean> {
    return aliases.some((alias) => this.aliases[alias] !== undefined);
  }

  async markSeen(): Promise<void> {
    // The durable ledger is updated together with the visible queue below.
  }
}

export function mergeDiscoveryState(
  current: Readonly<DiscoveryState>,
  candidate: JobScanResult,
): DiscoveryState {
  const newlyVisible = candidate.opportunities.filter(({ job }) =>
    buildJobAliases(job).every((alias) => current.seen.aliases[alias] === undefined),
  );
  const opportunities = sanitizeScanOpportunities([
    ...(current.latest?.opportunities ?? []),
    ...newlyVisible,
  ]);
  const additions = Object.fromEntries(
    newlyVisible.flatMap(({ job }) => buildJobAliases(job).map((alias) => [alias, candidate.completedAt])),
  );

  return {
    latest: {
      ...candidate,
      opportunities,
      statistics: { ...candidate.statistics, surfaced: newlyVisible.length },
    },
    seen: {
      version: 1,
      aliases: { ...current.seen.aliases, ...additions },
    },
  };
}

export class ScanSetupError extends Error {}

export async function runConfiguredScan(): Promise<JobScanResult> {
  const [profileRecord, preferencesRecord] = await Promise.all([
    profileRepository.readProfile(),
    profileRepository.readPreferences(),
  ]);
  if (!profileRecord || profileRecord.value.status !== "approved") {
    throw new ScanSetupError("Approve your career profile before scanning");
  }
  if (!preferencesRecord) {
    throw new ScanSetupError("Save your career preferences before scanning");
  }
  const profile = profileRecord.value;
  const preferences = preferencesRecord.value;
  const jobPreferences: JobPreferences = {
    targetRoles: preferences.targetRoles,
    locations: preferences.locations,
    workModes: preferences.workModes.map((mode) => mode === "on-site" ? "onsite" : mode),
    employmentTypes: preferences.employmentTypes,
    yearsOfExperience: profile.professional.yearsOfExperience ?? 0,
    maxExperienceStretch: 2,
    excludedTerms: ["unpaid", "commission only"],
    minimumSalary: preferences.preferredMinimumSalary ?? undefined,
    salaryCurrency: preferences.salaryCurrency,
  };
  const aiProvider = configuredAiProvider();
  const state = (await getJsonStore().read<DiscoveryState>(DISCOVERY_STATE_KEY, { schemaVersion: 1 }))?.value ?? EMPTY_DISCOVERY_STATE;
  const result = await runJobScan({
    adapters: [new RemotiveAdapter(), new ArbeitnowAdapter({ maxPages: 2 })],
    preferences: jobPreferences,
    matcher: aiProvider
      ? createAiJobMatcher(aiProvider, profile)
      : createDeterministicMatcher(jobPreferences),
    seenStore: new SnapshotSeenJobStore(state.seen.aliases),
    markSurfacedAsSeen: false,
  });
  const committed = await getJsonStore().update<DiscoveryState>(
    DISCOVERY_STATE_KEY,
    { schemaVersion: 1, initialValue: EMPTY_DISCOVERY_STATE },
    (current) => mergeDiscoveryState(current, result),
  );
  return committed.value.latest!;
}

export async function readLatestScan(): Promise<JobScanResult | null> {
  const scan = (await getJsonStore().read<DiscoveryState>(DISCOVERY_STATE_KEY, { schemaVersion: 1 }))?.value.latest ?? null;
  return scan ? { ...scan, opportunities: sanitizeScanOpportunities(scan.opportunities) } : null;
}

export async function dismissOpportunity(jobId: string): Promise<void> {
  await getJsonStore().update<DiscoveryState>(
    DISCOVERY_STATE_KEY,
    { schemaVersion: 1, initialValue: EMPTY_DISCOVERY_STATE },
    (current) => current.latest ? {
      ...current,
      latest: {
        ...current.latest,
        opportunities: current.latest.opportunities.filter(({ job }) => job.id !== jobId),
      },
    } : current,
  );
}
