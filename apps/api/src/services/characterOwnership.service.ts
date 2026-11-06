import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  CharacterOwnershipCatalogSchema, CharacterOwnershipSchema,
  type CharacterOwnership, type CharacterOwnershipCatalog, type SetCharacterOwner
} from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { characterOwnershipAudit, characterOwnerships, characters, guildIdentity, users } from "../db/schema.js";
import { effectiveOwnerships, ownershipGroups } from "./groupOwnership.service.js";

type Result = { ok: true; ownership: CharacterOwnership | null }
  | { ok: false; status: 403 | 404 | 409; error: string };
const guildScope = (guild: { name: string; realm: string }) =>
  and(eq(characterOwnerships.guildName, guild.name), eq(characterOwnerships.guildRealm, guild.realm));
const publicOwnership = (row: typeof characterOwnerships.$inferSelect): CharacterOwnership =>
  CharacterOwnershipSchema.parse({
    characterGuid: row.characterGuid, userId: row.userId, revision: row.revision, updatedAt: row.updatedAt
  });

export const listOwnCharacters = (userId: string): CharacterOwnership[] => {
  const guild = db.select().from(guildIdentity).get();
  if (!guild) return [];
  return effectiveOwnerships().filter((row) => row.userId === userId);
};

export const getCharacterOwnershipCatalog = (): CharacterOwnershipCatalog => {
  const guild = db.select().from(guildIdentity).get();
  return CharacterOwnershipCatalogSchema.parse({
    guild: guild ? { name: guild.name, realm: guild.realm } : null,
    users: db.select({ id: users.id, username: users.username }).from(users).orderBy(asc(users.username)).all(),
    characters: guild ? db.select({
      guid: characters.guid, name: characters.name, realm: characters.realm, isActive: characters.isActive
    }).from(characters).where(eq(characters.realm, guild.realm)).orderBy(asc(characters.name)).all() : [],
    ownerships: effectiveOwnerships(),
    groups: ownershipGroups().map(({ updatedAt: _updated, ...group }) => group),
    audit: guild ? db.select({
      id: characterOwnershipAudit.id, characterGuid: characterOwnershipAudit.characterGuid,
      characterName: characterOwnershipAudit.characterName,
      previousUserId: characterOwnershipAudit.previousUserId,
      previousUsername: characterOwnershipAudit.previousUsername,
      userId: characterOwnershipAudit.userId, username: characterOwnershipAudit.username,
      actorId: characterOwnershipAudit.actorId, actorUsername: characterOwnershipAudit.actorUsername,
      changedAt: characterOwnershipAudit.changedAt, reason: characterOwnershipAudit.reason
    }).from(characterOwnershipAudit).where(and(
      eq(characterOwnershipAudit.guildName, guild.name), eq(characterOwnershipAudit.guildRealm, guild.realm)
    )).orderBy(desc(characterOwnershipAudit.changedAt), desc(characterOwnershipAudit.id)).limit(100).all() : []
  });
};

export const setCharacterOwner = (guid: string, input: SetCharacterOwner, actorId: string): Result =>
  db.transaction((tx): Result => {
    const actor = tx.select().from(users).where(eq(users.id, actorId)).get();
    if (!actor || (actor.role !== "ADMIN" && actor.role !== "OFFICER")) {
      return { ok: false, status: 403, error: "Only officers and admins can verify character ownership" };
    }
    const guild = tx.select().from(guildIdentity).get();
    if (!guild) return { ok: false, status: 409, error: "Sync the guild roster before linking characters" };
    const character = tx.select().from(characters).where(eq(characters.guid, guid)).get();
    if (!character || character.realm !== guild.realm) {
      return { ok: false, status: 404, error: "Character not found in this server's guild roster" };
    }
    if (ownershipGroups().some((group) => group.userId && group.characterGuids.includes(guid))) {
      return { ok: false, status: 409, error: "Character belongs to a verified friendly-name group. Change the group owner instead" };
    }
    const current = tx.select().from(characterOwnerships)
      .where(and(guildScope(guild), eq(characterOwnerships.characterGuid, guid))).get();
    if ((current?.revision ?? null) !== input.expectedRevision) {
      return { ok: false, status: 409, error: "Ownership changed. Refresh and review the current owner before retrying" };
    }
    const target = input.userId === null ? null : tx.select().from(users).where(eq(users.id, input.userId)).get();
    if (input.userId !== null && !target) return { ok: false, status: 404, error: "Website user not found" };
    if ((current?.userId ?? null) === input.userId) {
      return { ok: true, ownership: current ? publicOwnership(current) : null };
    }
    if (current && target && !input.confirmReassignment) {
      return { ok: false, status: 409, error: "Confirm reassignment from the existing owner first" };
    }
    const now = Math.floor(Date.now() / 1000);
    if (current && now <= current.updatedAt) {
      return { ok: false, status: 409, error: "Ownership just changed. Wait one second and retry" };
    }
    const previous = current ? tx.select().from(users).where(eq(users.id, current.userId)).get() : undefined;
    tx.insert(characterOwnershipAudit).values({
      id: randomUUID(), characterGuid: guid, characterName: character.name,
      guildName: guild.name, guildRealm: guild.realm,
      previousUserId: current?.userId ?? null, previousUsername: previous?.username ?? null,
      userId: target?.id ?? null, username: target?.username ?? null,
      actorId: actor.id, actorUsername: actor.username, changedAt: now,
      reason: !target ? "REVOKED" : current ? "REASSIGNED" : "ASSIGNED"
    }).run();
    if (!target) {
      tx.delete(characterOwnerships).where(eq(characterOwnerships.characterGuid, guid)).run();
      return { ok: true, ownership: null };
    }
    const row = {
      characterGuid: guid, userId: target.id, guildName: guild.name,
      guildRealm: guild.realm, revision: randomUUID(), updatedAt: now
    };
    tx.insert(characterOwnerships).values(row).onConflictDoUpdate({
      target: characterOwnerships.characterGuid, set: row
    }).run();
    return { ok: true, ownership: publicOwnership(row) };
  });
