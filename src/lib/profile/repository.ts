import { getJsonStore, type VersionedRecord } from "../storage";

import type { ProfileRepository } from "./handlers";
import {
  CareerPreferencesSchema,
  CareerProfileSchema,
  type CareerPreferences,
  type CareerProfile,
} from "./schemas";

const PROFILE_KEY = "state/career-profile";
const PREFERENCES_KEY = "state/preferences";
const SCHEMA_VERSION = 1;

function validatedRecord<T>(record: VersionedRecord<unknown>, value: T): VersionedRecord<T> {
  return { ...record, value };
}

export class StoredProfileRepository implements ProfileRepository {
  async readProfile(): Promise<VersionedRecord<CareerProfile> | null> {
    const record = await getJsonStore().read<unknown>(PROFILE_KEY, { schemaVersion: SCHEMA_VERSION });
    return record ? validatedRecord(record, CareerProfileSchema.parse(record.value)) : null;
  }

  async writeProfile(
    value: CareerProfile,
    expectedRevision: number,
  ): Promise<VersionedRecord<CareerProfile>> {
    return getJsonStore().write(PROFILE_KEY, CareerProfileSchema.parse(value), {
      schemaVersion: SCHEMA_VERSION,
      expectedRevision,
    });
  }

  async readPreferences(): Promise<VersionedRecord<CareerPreferences> | null> {
    const record = await getJsonStore().read<unknown>(PREFERENCES_KEY, {
      schemaVersion: SCHEMA_VERSION,
    });
    return record ? validatedRecord(record, CareerPreferencesSchema.parse(record.value)) : null;
  }

  async writePreferences(
    value: CareerPreferences,
    expectedRevision: number,
  ): Promise<VersionedRecord<CareerPreferences>> {
    return getJsonStore().write(PREFERENCES_KEY, CareerPreferencesSchema.parse(value), {
      schemaVersion: SCHEMA_VERSION,
      expectedRevision,
    });
  }
}

export const profileRepository = new StoredProfileRepository();
