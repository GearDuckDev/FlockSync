import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { characterGroupKey, groupCharacters, type CharacterOwnership, type SetGroupOwner } from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { characterOwnershipAudit, characterOwnerships, guildIdentity, groupOwnerships, playerAliases, users } from "../db/schema.js";
import { listRoster } from "./roster.service.js";

const scopeKey = (guild: { name: string; realm: string }): string => `${guild.realm}\u001f${guild.name}`;
export const ownershipGroups = () => {
  const guild = db.select().from(guildIdentity).get();
  if (!guild) return [];
  const aliases = new Map(db.select().from(playerAliases).all().map((row) => [row.key, row.alias]));
  const grants = db.select().from(groupOwnerships).where(eq(groupOwnerships.guildKey, scopeKey(guild))).all();
  const groups = new Map<string, { key: string; label: string; characterGuids: string[];
    userId: string | null; revision: string | null; updatedAt: number }>();
  for (const group of groupCharacters(listRoster(true).filter((c) => c.realm === guild.realm))) {
    const key = characterGroupKey(group);
    const grant = grants.find((entry) => entry.groupKey === key);
    const members = [group.main, ...group.alts].map((c) => c.guid);
    const existing = groups.get(key);
    if (existing) existing.characterGuids.push(...members);
    else groups.set(key, {
      key, label: aliases.get(key) ?? group.main.mainCharacterName ?? group.main.name,
      characterGuids: members, userId: grant?.userId ?? null,
      revision: grant?.revision ?? null, updatedAt: grant?.updatedAt ?? 0
    });
  }
  return [...groups.values()];
};

// Group grants follow the current synced roster, including future alts; aliases
// are display-only and never serve as identity keys.
export const effectiveOwnerships = (): CharacterOwnership[] => {
  const guild = db.select().from(guildIdentity).get();
  if (!guild) return [];
  const links = new Map(db.select().from(characterOwnerships).where(and(
    eq(characterOwnerships.guildName, guild.name), eq(characterOwnerships.guildRealm, guild.realm)
  )).all().map((row) => [row.characterGuid, {
    characterGuid: row.characterGuid, userId: row.userId, revision: row.revision, updatedAt: row.updatedAt
  }]));
  for (const group of ownershipGroups()) {
    if (!group.userId || !group.revision) continue;
    for (const characterGuid of group.characterGuids) links.set(characterGuid, {
      characterGuid, userId: group.userId, revision: group.revision, updatedAt: group.updatedAt
    });
  }
  return [...links.values()];
};

type Result = { ok: true } | { ok: false; status: 403 | 404 | 409; error: string };
export const setGroupOwner = (input: SetGroupOwner, actorId: string): Result =>
  db.transaction((tx): Result => {
    const actor = tx.select().from(users).where(eq(users.id, actorId)).get();
    if (!actor || (actor.role !== "ADMIN" && actor.role !== "OFFICER")) {
      return { ok: false, status: 403, error: "Only officers and admins can verify group ownership" };
    }
    const guild = tx.select().from(guildIdentity).get();
    const group = ownershipGroups().find((row) => row.key === input.groupKey);
    if (!guild || !group) return { ok: false, status: 404, error: "Group no longer exists. Refresh links" };
    const links = effectiveOwnerships();
    const state = (members: { characterGuid: string; revision: string | null }[]) =>
      JSON.stringify([...members].sort((a, b) => a.characterGuid.localeCompare(b.characterGuid)));
    const currentMembers = group.characterGuids.map((characterGuid) => ({
      characterGuid, revision: links.find((row) => row.characterGuid === characterGuid)?.revision ?? null
    }));
    if (group.revision !== input.expectedRevision || state(currentMembers) !== state(input.expectedMembers)) {
      return { ok: false, status: 409, error: "Group membership or ownership changed. Refresh and review before retrying" };
    }
    const target = input.userId === null ? null : tx.select().from(users).where(eq(users.id, input.userId)).get();
    if (input.userId !== null && !target) return { ok: false, status: 404, error: "Website user not found" };
    if (links.some((row) => group.characterGuids.includes(row.characterGuid)
      && row.userId !== input.userId) && target && !input.confirmReassignment) {
      return { ok: false, status: 409, error: "Confirm reassignment from existing owners first" };
    }
    const now = Math.floor(Date.now() / 1000);
    if (group.updatedAt >= now) return { ok: false, status: 409, error: "Group just changed. Wait one second and retry" };
    const roster = listRoster(true);
    for (const guid of group.characterGuids) {
      const previous = links.find((row) => row.characterGuid === guid);
      const oldUser = previous ? tx.select().from(users).where(eq(users.id, previous.userId)).get() : undefined;
      const character = roster.find((c) => c.guid === guid);
      if (!character) throw new Error("Group member disappeared during ownership transaction");
      tx.insert(characterOwnershipAudit).values({
        id: randomUUID(), characterGuid: guid, characterName: character.name,
        guildName: guild.name, guildRealm: guild.realm, previousUserId: previous?.userId ?? null,
        previousUsername: oldUser?.username ?? null, userId: target?.id ?? null,
        username: target?.username ?? null, actorId: actor.id, actorUsername: actor.username,
        changedAt: now, reason: !target ? "GROUP_REVOKED"
          : previous && previous.userId !== target.id ? "GROUP_REASSIGNED" : "GROUP_ASSIGNED"
      }).run();
      tx.delete(characterOwnerships).where(eq(characterOwnerships.characterGuid, guid)).run();
    }
    const key = scopeKey(guild);
    const condition = and(eq(groupOwnerships.guildKey, key), eq(groupOwnerships.groupKey, group.key));
    if (!target) tx.delete(groupOwnerships).where(condition).run();
    else {
      const row = { guildKey: key, groupKey: group.key, userId: target.id, revision: randomUUID(), updatedAt: now };
      tx.insert(groupOwnerships).values(row).onConflictDoUpdate({
        target: [groupOwnerships.guildKey, groupOwnerships.groupKey], set: row
      }).run();
    }
    return { ok: true };
  });
