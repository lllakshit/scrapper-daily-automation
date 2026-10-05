import { getJsonStore, type VersionedJsonStore, type VersionedRecord } from "@/lib/storage";

import {
  InterviewCollectionSchema,
  InterviewWorkspaceSchema,
  type InterviewCollection,
  type InterviewWorkspace,
} from "./schema";

const INTERVIEWS_KEY = "state/interviews";
const SCHEMA_VERSION = 1;
const EMPTY: InterviewCollection = { schemaVersion: 1, interviews: [] };

function singleRecord(
  record: VersionedRecord<InterviewCollection>,
  interview: InterviewWorkspace,
): VersionedRecord<InterviewWorkspace> {
  return { ...record, value: structuredClone(interview) };
}

export class StoredInterviewRepository {
  constructor(private readonly store: VersionedJsonStore = getJsonStore()) {}

  async list(): Promise<VersionedRecord<InterviewCollection>> {
    const record = await this.store.read<unknown>(INTERVIEWS_KEY, { schemaVersion: SCHEMA_VERSION });
    return record
      ? { ...record, value: InterviewCollectionSchema.parse(record.value) }
      : { schemaVersion: SCHEMA_VERSION, revision: 0, updatedAt: new Date(0).toISOString(), value: EMPTY };
  }

  async findById(id: string): Promise<VersionedRecord<InterviewWorkspace> | null> {
    const record = await this.list();
    const workspace = record.value.interviews.find((item) => item.id === id);
    return workspace ? singleRecord(record, workspace) : null;
  }

  async findByApplicationId(
    applicationId: string,
  ): Promise<VersionedRecord<InterviewWorkspace> | null> {
    const record = await this.list();
    const workspace = record.value.interviews.find((item) => item.applicationId === applicationId);
    return workspace ? singleRecord(record, workspace) : null;
  }

  async save(
    candidate: InterviewWorkspace,
    expectedRevision: number,
  ): Promise<VersionedRecord<InterviewCollection>> {
    const workspace = InterviewWorkspaceSchema.parse(candidate);
    const current = await this.list();
    const interviews = [
      ...current.value.interviews.filter(
        (item) => item.id !== workspace.id && item.applicationId !== workspace.applicationId,
      ),
      structuredClone(workspace),
    ];
    return this.store.write(
      INTERVIEWS_KEY,
      InterviewCollectionSchema.parse({ schemaVersion: 1, interviews }),
      { schemaVersion: SCHEMA_VERSION, expectedRevision },
    );
  }
}

export const interviewRepository = new StoredInterviewRepository();
