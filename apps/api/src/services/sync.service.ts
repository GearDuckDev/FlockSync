import type {
  Character,
  OfficerSyncPayload,
  ServerReturnPayload
} from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { characters, deletedCharacters } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { upsertAttendance, upsertLoot } from "./ledgerSync.service.js";
import { buildGuildSnapshot } from "./snapshot.service.js";

const attunementsEpoch = (character: Character): number =>
  Math.max(0, ...(character.attunements ?? []).map((chain) => chain.updatedAt));

export const STALE_AFTER_SECONDS = 30 * 24 * 60 * 60;

const isStale = (lastSeenAt: number, now: number): boolean =>
  lastSeenAt < now - STALE_AFTER_SECONDS;

// The addon reports isActive=false for characters idle 30+ days; the server
// re-checks the age so only genuinely idle characters are auto-staled.
const reportsStale = (character: Character, now: number): boolean =>
  !character.isActive && isStale(character.lastSeenAt, now);

const toCharacterValues = (character: Character, officerUserId: string, now: number) => ({
  guid: character.guid,
  name: character.name,
  realm: character.realm,
  classId: character.classId,
  level: character.level,
  mainCharacterGuid: character.mainCharacterGuid ?? null,
  mainCharacterName: character.mainCharacterName ?? null,
  isActive: !reportsStale(character, now),
  autoStale: reportsStale(character, now),
  primaryRole: character.role.primaryRole,
  offSpecEnabled: character.role.offSpecEnabled,
  offSpecRole: character.role.offSpecRole ?? null,
  roleUpdatedAt: character.role.updatedAt,
  gearJson: JSON.stringify(character.gear.items),
  gearUpdatedAt: character.gear.updatedAt,
  lastSeenAt: character.lastSeenAt,
  availabilityJson: JSON.stringify(character.availability ?? null),
  availabilityUpdatedAt: character.availability?.updatedAt ?? 0,
  lockoutsJson: JSON.stringify(character.lockouts ?? null),
  lockoutsUpdatedAt: character.lockouts?.updatedAt ?? 0,
  professionsJson: JSON.stringify(character.professions ?? null),
  professionsUpdatedAt: character.professions?.updatedAt ?? 0,
  gearGoalsJson: JSON.stringify(character.gearGoals ?? null),
  gearGoalsUpdatedAt: character.gearGoals?.updatedAt ?? 0,
  attunementsJson: JSON.stringify(character.attunements ?? null),
  attunementsUpdatedAt: attunementsEpoch(character),
  updatedByOfficerId: officerUserId
});

export const processOfficerSync = (
  payload: OfficerSyncPayload,
  officerUserId: string
): ServerReturnPayload => {
  const now = Math.floor(Date.now() / 1000);
  db.transaction((transaction) => {
    const incomingCharacters = new Map<string, Character>();
    const tombstones = new Map(
      transaction.select().from(deletedCharacters).all().map((t) => [t.guid, t.deletedAt])
    );
    for (const character of [payload.officerCharacter, ...payload.characters]) {
      const deletedAt = tombstones.get(character.guid);
      if (deletedAt !== undefined && character.lastSeenAt <= deletedAt) continue;
      incomingCharacters.set(character.guid, character);
    }

    for (const character of incomingCharacters.values()) {
      const existing = transaction.select().from(characters)
        .where(eq(characters.guid, character.guid))
        .get();

      if (!existing) {
        transaction.insert(characters).values(toCharacterValues(character, officerUserId, now)).run();
        continue;
      }

      const updates: Partial<typeof characters.$inferInsert> = {};
      if (character.role.updatedAt > existing.roleUpdatedAt) {
        updates.primaryRole = character.role.primaryRole;
        updates.offSpecEnabled = character.role.offSpecEnabled;
        updates.offSpecRole = character.role.offSpecRole ?? null;
        updates.roleUpdatedAt = character.role.updatedAt;
      }
      if (character.gear.updatedAt > existing.gearUpdatedAt) {
        updates.gearJson = JSON.stringify(character.gear.items);
        updates.gearUpdatedAt = character.gear.updatedAt;
      }
      if (character.availability && character.availability.updatedAt > existing.availabilityUpdatedAt) {
        updates.availabilityJson = JSON.stringify(character.availability);
        updates.availabilityUpdatedAt = character.availability.updatedAt;
      }
      if (character.lockouts && character.lockouts.updatedAt > existing.lockoutsUpdatedAt) {
        updates.lockoutsJson = JSON.stringify(character.lockouts);
        updates.lockoutsUpdatedAt = character.lockouts.updatedAt;
      }
      if (character.professions && character.professions.updatedAt > existing.professionsUpdatedAt) {
        updates.professionsJson = JSON.stringify(character.professions);
        updates.professionsUpdatedAt = character.professions.updatedAt;
      }
      if (character.gearGoals && character.gearGoals.updatedAt > existing.gearGoalsUpdatedAt) {
        updates.gearGoalsJson = JSON.stringify(character.gearGoals);
        updates.gearGoalsUpdatedAt = character.gearGoals.updatedAt;
      }
      if (character.attunements && attunementsEpoch(character) > existing.attunementsUpdatedAt) {
        updates.attunementsJson = JSON.stringify(character.attunements);
        updates.attunementsUpdatedAt = attunementsEpoch(character);
      }
      if (character.lastSeenAt >= existing.lastSeenAt) {
        updates.level = character.level;
        updates.name = character.name;
        updates.realm = character.realm;
        updates.mainCharacterGuid = character.mainCharacterGuid ?? null;
        updates.mainCharacterName = character.mainCharacterName ?? null;
        updates.lastSeenAt = character.lastSeenAt;
      }
      // Manual culls (isActive=false, autoStale=false) are never changed here.
      if (existing.autoStale && character.lastSeenAt > existing.lastSeenAt
        && !isStale(character.lastSeenAt, now)) {
        updates.isActive = true;
        updates.autoStale = false;
      } else if (existing.isActive && reportsStale(character, now)
        && character.lastSeenAt >= existing.lastSeenAt) {
        updates.isActive = false;
        updates.autoStale = true;
      }

      if (Object.keys(updates).length > 0) {
        transaction.update(characters).set(updates)
          .where(eq(characters.guid, character.guid))
          .run();
      }
    }

    upsertLoot(transaction, payload.lootHistory ?? []);
    upsertAttendance(transaction, payload.attendanceHistory ?? []);
  });

  // Auto-staled characters are excluded: the addon revives them itself on login.
  const inactiveCharacters = db.select({ guid: characters.guid })
    .from(characters)
    .where(and(eq(characters.isActive, false), eq(characters.autoStale, false)))
    .all();

  return {
    isAuthorizedOfficer: true,
    culledCharacterGuids: inactiveCharacters.map((character) => character.guid),
    serverTimestamp: now,
    ...buildGuildSnapshot()
  };
};
