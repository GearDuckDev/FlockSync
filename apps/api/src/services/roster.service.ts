import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  AttunementChainSchema,
  CharacterSchema,
  PlayerAvailabilitySchema,
  PlayerGearSchema,
  PlayerGearGoalsSchema,
  PlayerLockoutsSchema,
  PlayerProfessionsSchema
} from "@flocksync/shared-types";
import type { Character, PlayerAvailability } from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { characters } from "../db/schema.js";

type CharacterRow = typeof characters.$inferSelect;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const parseAvailability = (row: CharacterRow): PlayerAvailability | undefined => {
  const parsed = PlayerAvailabilitySchema.safeParse(parseJson(row.availabilityJson));
  return parsed.success ? parsed.data : undefined;
};

/** Availability belongs to the human player: share the freshest one across a Main and its alts. */
const resolveAvailability = (rows: CharacterRow[]): Map<string, PlayerAvailability> => {
  const guidByName = new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.guid]));
  const ownerOf = (row: CharacterRow): string =>
    row.mainCharacterGuid
    ?? (row.mainCharacterName ? guidByName.get(row.mainCharacterName.trim().toLowerCase()) : undefined)
    ?? row.guid;

  const freshest = new Map<string, PlayerAvailability>();
  for (const row of rows) {
    const availability = parseAvailability(row);
    const owner = ownerOf(row);
    const current = freshest.get(owner);
    if (availability && (!current || availability.updatedAt > current.updatedAt)) {
      freshest.set(owner, availability);
    }
  }
  const resolved = new Map<string, PlayerAvailability>();
  for (const row of rows) {
    const shared = freshest.get(ownerOf(row));
    if (shared) resolved.set(row.guid, shared);
  }
  return resolved;
};

const lockoutsOf = (row: CharacterRow) => {
  const parsed = PlayerLockoutsSchema.safeParse(parseJson(row.lockoutsJson));
  return parsed.success ? { lockouts: parsed.data } : {};
};

const trackingOf = (row: CharacterRow) => {
  const professions = PlayerProfessionsSchema.safeParse(parseJson(row.professionsJson));
  const gearGoals = PlayerGearGoalsSchema.safeParse(parseJson(row.gearGoalsJson));
  const attunements = z.array(AttunementChainSchema).safeParse(parseJson(row.attunementsJson));
  return {
    ...(attunements.success ? { attunements: attunements.data } : {}),
    ...(professions.success ? { professions: professions.data } : {}),
    ...(gearGoals.success ? { gearGoals: gearGoals.data } : {})
  };
};

const toCharacter = (row: CharacterRow, availability?: PlayerAvailability): Character => CharacterSchema.parse({
  guid: row.guid,
  name: row.name,
  realm: row.realm,
  classId: row.classId,
  level: row.level,
  ...(row.mainCharacterGuid === null ? {} : { mainCharacterGuid: row.mainCharacterGuid }),
  ...(row.mainCharacterName === null ? {} : { mainCharacterName: row.mainCharacterName }),
  isActive: row.isActive,
  role: {
    primaryRole: row.primaryRole,
    offSpecEnabled: row.offSpecEnabled,
    ...(row.offSpecRole === null ? {} : { offSpecRole: row.offSpecRole }),
    updatedAt: row.roleUpdatedAt
  },
  gear: PlayerGearSchema.parse({
    items: JSON.parse(row.gearJson) as unknown,
    updatedAt: row.gearUpdatedAt
  }),
  ...(availability ? { availability } : {}),
  ...lockoutsOf(row),
  ...trackingOf(row),
  lastSeenAt: row.lastSeenAt
});

export const listRoster = (includeInactive: boolean): Character[] => {
  const rows = db.select().from(characters).all();
  const availability = resolveAvailability(rows);
  return rows
    .filter((row) => includeInactive || row.isActive)
    .map((row) => toCharacter(row, availability.get(row.guid)));
};

export const setCharacterActive = (guid: string, isActive: boolean): Character | undefined => {
  const result = db.update(characters).set({ isActive, autoStale: false }).where(eq(characters.guid, guid)).run();
  if (result.changes === 0) {
    return undefined;
  }
  return listRoster(true).find((character) => character.guid === guid);
};
