import { randomUUID } from "node:crypto";
import { and, asc, eq, lt } from "drizzle-orm";
import {
  LootSessionAuditSchema, LootSessionDraftSchema,
  type AuthUser, type LootSessionAudit, type LootSessionDraft,
  type LootSessionDraftInput, type LootSessionDraftUpdate, type LootSessionListQuery
} from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { lootSessionAudit, lootSessions } from "../db/schema.js";

type SessionRow = typeof lootSessions.$inferSelect;
type AuditRow = typeof lootSessionAudit.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type MutationResult =
  | { ok: true; session: LootSessionDraft }
  | { ok: false; status: 404 | 409; error: string };

const toSession = ({ tiersJson, ...row }: SessionRow): LootSessionDraft =>
  LootSessionDraftSchema.parse({ ...row, tiers: JSON.parse(tiersJson) as unknown });

const toAudit = ({ beforeJson, afterJson, revision: _revision, ...row }: AuditRow): LootSessionAudit =>
  LootSessionAuditSchema.parse({
    ...row,
    before: beforeJson === null ? null : JSON.parse(beforeJson) as unknown,
    after: JSON.parse(afterJson) as unknown
  });

const recordChange = (
  tx: Transaction, actor: AuthUser, before: LootSessionDraft | null,
  after: LootSessionDraft, reason: string
): void => {
  tx.insert(lootSessionAudit).values({
    id: randomUUID(), sessionId: after.id, revision: after.revision,
    actorId: actor.id, actorUsername: actor.username,
    action: before === null ? "CREATED" : "UPDATED", reason,
    beforeJson: before === null ? null : JSON.stringify(before),
    afterJson: JSON.stringify(after), timestamp: after.updatedAt
  }).run();
};

export const listLootSessions = (query: LootSessionListQuery): LootSessionDraft[] =>
  db.select().from(lootSessions)
    .orderBy(asc(lootSessions.scheduledAt), asc(lootSessions.id))
    .limit(query.limit).offset(query.offset).all().map(toSession);

export const getLootSession = (id: string): LootSessionDraft | undefined => {
  const row = db.select().from(lootSessions).where(eq(lootSessions.id, id)).get();
  return row ? toSession(row) : undefined;
};

export const getLootSessionHistory = (id: string): LootSessionAudit[] =>
  db.select().from(lootSessionAudit).where(eq(lootSessionAudit.sessionId, id))
    .orderBy(asc(lootSessionAudit.revision)).all().map(toAudit);

export const createLootSession = (input: LootSessionDraftInput, actor: AuthUser): LootSessionDraft =>
  db.transaction((tx) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const { tiers, ...fields } = input;
    const row: SessionRow = {
      ...fields, tiersJson: JSON.stringify(tiers), id: randomUUID(),
      status: "DRAFT", revision: 1, createdBy: actor.id,
      createdAt: timestamp, updatedAt: timestamp
    };
    const session = toSession(row);
    tx.insert(lootSessions).values(row).run();
    recordChange(tx, actor, null, session, "Draft created");
    return session;
  });

export const updateLootSession = (
  id: string, input: LootSessionDraftUpdate, actor: AuthUser
): MutationResult => db.transaction((tx) => {
  const row = tx.select().from(lootSessions).where(eq(lootSessions.id, id)).get();
  if (!row) return { ok: false, status: 404, error: "Loot session not found" };
  if (row.revision !== input.expectedRevision) {
    return { ok: false, status: 409, error: "Loot session changed. Reload it before saving." };
  }
  const timestamp = Math.floor(Date.now() / 1000);
  if (timestamp <= row.updatedAt) {
    return { ok: false, status: 409, error: "A newer server timestamp is required. Retry after one second." };
  }
  const { tiers, reason, expectedRevision: _expectedRevision, ...fields } = input;
  const next = {
    ...row, ...fields, tiersJson: JSON.stringify(tiers),
    revision: row.revision + 1, updatedAt: timestamp
  };
  const before = toSession(row);
  const session = toSession(next);
  const result = tx.update(lootSessions).set(next).where(and(
    eq(lootSessions.id, id), eq(lootSessions.revision, input.expectedRevision),
    lt(lootSessions.updatedAt, timestamp)
  )).run();
  if (result.changes === 0) {
    return { ok: false, status: 409, error: "Loot session changed. Reload it before saving." };
  }
  recordChange(tx, actor, before, session, reason);
  return { ok: true, session };
});
