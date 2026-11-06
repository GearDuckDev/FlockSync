import { and, eq } from "drizzle-orm";
import {
  MAX_SHARED_KILL_ENTRIES, SharedKillEntrySchema, type SharedKillEntry
} from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { guildIdentity, sharedKillTargets, users } from "../db/schema.js";
import { readDatabaseAdminState } from "./databaseAdminState.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class KillSyncConflict extends Error {}
const guildKey = (guild: { name: string; realm: string }): string => `${guild.realm}\u001f${guild.name}`;
const targetKey = (name: string, realm: string): string => `${realm.toLowerCase()}\u001f${name.toLowerCase()}`;
const condition = (guild: { name: string; realm: string }, name: string, realm: string) =>
  and(eq(sharedKillTargets.guildKey, guildKey(guild)), eq(sharedKillTargets.targetKey, targetKey(name, realm)));
const entryOf = (row: typeof sharedKillTargets.$inferSelect): SharedKillEntry => {
  const { guildKey: _guild, targetKey: _target, ...entry } = row;
  return SharedKillEntrySchema.parse(entry);
};

export const listSharedKills = (includeDeleted = false): SharedKillEntry[] => {
  const guild = db.select().from(guildIdentity).get();
  if (!guild) return [];
  return db.select().from(sharedKillTargets).where(eq(sharedKillTargets.guildKey, guildKey(guild))).all()
    .filter((row) => includeDeleted || !row.deleted).map(entryOf);
};

type CreateMutation = { ok: true; entry: SharedKillEntry }
  | { ok: false; status: 403 | 404 | 409; error: string };
const formatKillName = (name: string): string =>
  name.replace(/(^|\s)(\S)/gu, (_match, prefix: string, initial: string) => `${prefix}${initial.toUpperCase()}`);

export const createSharedKill = async (
  userId: string, input: { name: string; note: string }
): Promise<CreateMutation> => {
  const { databaseResetAt } = await readDatabaseAdminState();
  return db.transaction((tx): CreateMutation => {
    const actor = tx.select().from(users).where(eq(users.id, userId)).get();
    const guild = tx.select().from(guildIdentity).get();
    if (!actor) return { ok: false, status: 403, error: "Account unavailable" };
    if (!guild) return { ok: false, status: 404, error: "Guild kill list unavailable" };
    const name = formatKillName(input.name);
    const old = tx.select().from(sharedKillTargets).where(condition(guild, name, guild.realm)).get();
    if (old && !old.deleted) return { ok: false, status: 409, error: "Target already exists" };
    const now = Math.max(Math.floor(Date.now() / 1000), databaseResetAt + 1);
    if (old && now <= old.updatedAt) {
      return { ok: false, status: 409, error: "Target was just removed. Wait one second and retry" };
    }
    if (!old && tx.select().from(sharedKillTargets).where(eq(sharedKillTargets.guildKey, guildKey(guild))).all().length
      >= MAX_SHARED_KILL_ENTRIES) {
      return { ok: false, status: 409, error: `Guild kill list is limited to ${MAX_SHARED_KILL_ENTRIES} targets` };
    }
    const entry = SharedKillEntrySchema.parse({
      name, realm: guild.realm, note: input.note, author: actor.username,
      authorGuid: actor.id, actorGuid: actor.id, createdAt: now, updatedAt: now, deleted: false
    });
    tx.insert(sharedKillTargets).values({
      ...entry, guildKey: guildKey(guild), targetKey: targetKey(name, guild.realm)
    }).onConflictDoUpdate({
      target: [sharedKillTargets.guildKey, sharedKillTargets.targetKey], set: entry
    }).run();
    return { ok: true, entry };
  });
};

// Only the authenticated officer upload path calls this; member authorship is
// attested by that collector's validated guild traffic, not by a web self-claim.
export const upsertSharedKills = (
  tx: Transaction, entries: SharedKillEntry[], guild: { name: string; realm: string },
  resetAt: number, now: number
): void => {
  let targetCount = tx.select().from(sharedKillTargets)
    .where(eq(sharedKillTargets.guildKey, guildKey(guild))).all().length;
  for (const entry of entries) {
    if (entry.updatedAt <= resetAt) continue;
    if (entry.realm !== guild.realm || entry.updatedAt > now + 30) {
      throw new Error("Kill-list entry is outside the collector guild, reset or clock boundary");
    }
    const old = tx.select().from(sharedKillTargets).where(condition(guild, entry.name, entry.realm)).get();
    if (old && entry.updatedAt <= old.updatedAt) {
      if (entry.updatedAt === old.updatedAt && (entry.note !== old.note || entry.deleted !== old.deleted
        || entry.authorGuid !== old.authorGuid || entry.actorGuid !== old.actorGuid
        || entry.createdAt !== old.createdAt)) {
        throw new KillSyncConflict("Equal-time kill-list conflict; retry the intended change in a later second");
      }
      continue;
    }
    if (old?.deleted && !entry.deleted && entry.createdAt <= old.updatedAt) {
      throw new KillSyncConflict("Removed targets require a new in-game addition, not an old edit");
    }
    if (old && !old.deleted && (entry.authorGuid !== old.authorGuid || entry.createdAt !== old.createdAt)
      && entry.createdAt <= old.updatedAt) {
      throw new KillSyncConflict("Kill-list author/creation identity cannot change on an active entry");
    }
    if (!old && targetCount >= MAX_SHARED_KILL_ENTRIES) {
      throw new KillSyncConflict(`Guild kill list is limited to ${MAX_SHARED_KILL_ENTRIES} targets`);
    }
    tx.insert(sharedKillTargets).values({
      ...entry, guildKey: guildKey(guild), targetKey: targetKey(entry.name, entry.realm)
    }).onConflictDoUpdate({
      target: [sharedKillTargets.guildKey, sharedKillTargets.targetKey], set: entry
    }).run();
    if (!old) targetCount++;
  }
};

type Mutation = { ok: true; entry: SharedKillEntry }
  | { ok: false; status: 403 | 404 | 409; error: string };
export const changeSharedKill = (
  userId: string, input: { name: string; realm: string; expectedUpdatedAt: number }, note?: string
): Mutation => db.transaction((tx): Mutation => {
  const actor = tx.select().from(users).where(eq(users.id, userId)).get();
  const guild = tx.select().from(guildIdentity).get();
  if (!actor) return { ok: false, status: 403, error: "Account unavailable" };
  if (!guild) return { ok: false, status: 404, error: "Guild kill list unavailable" };
  const old = tx.select().from(sharedKillTargets).where(condition(guild, input.name, input.realm)).get();
  if (!old || old.deleted) return { ok: false, status: 404, error: "Shared target not found" };
  const now = Math.floor(Date.now() / 1000);
  if (old.updatedAt !== input.expectedUpdatedAt || now <= old.updatedAt) {
    return { ok: false, status: 409, error: "Target changed or was just edited. Refresh, wait one second and retry" };
  }
  const entry = {
    ...entryOf(old), actorGuid: actor.id, note: note ?? "", deleted: note === undefined, updatedAt: now
  };
  tx.update(sharedKillTargets).set(entry).where(condition(guild, input.name, input.realm)).run();
  return { ok: true, entry };
});
