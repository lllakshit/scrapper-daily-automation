import { getJsonStore, type VersionedJsonStore, type VersionedRecord } from "@/lib/storage";

import {
  ApplicationCollectionSchema,
  ApplicationSchema,
  type Application,
  type ApplicationCollection,
} from "./schema";

const APPLICATIONS_KEY = "state/applications";
const SCHEMA_VERSION = 1;
const EMPTY: ApplicationCollection = { schemaVersion: 1, applications: [] };

export class DuplicateApplicationError extends Error {
  constructor() {
    super("An application already exists for this job");
    this.name = "DuplicateApplicationError";
  }
}

function singleRecord(
  record: VersionedRecord<ApplicationCollection>,
  application: Application,
): VersionedRecord<Application> {
  return { ...record, value: structuredClone(application) };
}

export class StoredApplicationRepository {
  constructor(private readonly store: VersionedJsonStore = getJsonStore()) {}

  async list(): Promise<VersionedRecord<ApplicationCollection>> {
    const record = await this.store.read<unknown>(APPLICATIONS_KEY, { schemaVersion: SCHEMA_VERSION });
    return record
      ? { ...record, value: ApplicationCollectionSchema.parse(record.value) }
      : { schemaVersion: SCHEMA_VERSION, revision: 0, updatedAt: new Date(0).toISOString(), value: EMPTY };
  }

  async findById(id: string): Promise<VersionedRecord<Application> | null> {
    const record = await this.list();
    const application = record.value.applications.find((item) => item.id === id);
    return application ? singleRecord(record, application) : null;
  }

  async save(
    candidate: Application,
    expectedRevision: number,
  ): Promise<VersionedRecord<ApplicationCollection>> {
    const application = ApplicationSchema.parse(candidate);
    const current = await this.list();
    const duplicate = current.value.applications.find(
      (item) => item.jobId === application.jobId && item.id !== application.id,
    );
    if (duplicate) throw new DuplicateApplicationError();
    const exists = current.value.applications.some(({ id }) => id === application.id);
    const applications = exists
      ? current.value.applications.map((item) =>
          item.id === application.id ? structuredClone(application) : item,
        )
      : [...current.value.applications, structuredClone(application)];
    const value = ApplicationCollectionSchema.parse({ schemaVersion: 1, applications });
    return this.store.write(APPLICATIONS_KEY, value, {
      schemaVersion: SCHEMA_VERSION,
      expectedRevision,
    });
  }
}

export const applicationRepository = new StoredApplicationRepository();
