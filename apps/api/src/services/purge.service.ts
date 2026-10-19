import { eq } from "drizzle-orm";
import { RaidSlotAssignmentSchema } from "@flocksync/shared-types";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  attendance,
  characters,
  deletedCharacters,
  lootHistory,
  officerTasks,
  playerAliases,
  raidTeams
} from "../db/schema.js";

const parseArray = (text: string): unknown[] => {
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const GuidList = z.array(z.string());

/** Removes a character and every record that references it. Returns false if unknown. */
export const purgeCharacter = (guid: string): boolean =>
  db.transaction((tx) => {
    const existing = tx.select().from(characters).where(eq(characters.guid, guid)).get();
    if (!existing) return false;

    tx.insert(deletedCharacters).values({ guid, deletedAt: Math.floor(Date.now() / 1000) })
      .onConflictDoUpdate({ target: deletedCharacters.guid, set: { deletedAt: Math.floor(Date.now() / 1000) } })
      .run();

    // Alts linked to this main fall back to being unlinked orphans by name only.
    tx.update(characters).set({ mainCharacterGuid: null }).where(eq(characters.mainCharacterGuid, guid)).run();
    tx.delete(playerAliases).where(eq(playerAliases.key, guid)).run();
    tx.delete(lootHistory).where(eq(lootHistory.recipientGuid, guid)).run();
    tx.delete(officerTasks).where(eq(officerTasks.relatedCharacterGuid, guid)).run();

    for (const row of tx.select().from(attendance).all()) {
      const roster = GuidList.catch([]).parse(parseArray(row.rosterGuidsJson));
      const bench = GuidList.catch([]).parse(parseArray(row.benchGuidsJson));
      if (!roster.includes(guid) && !bench.includes(guid)) continue;
      tx.update(attendance).set({
        rosterGuidsJson: JSON.stringify(roster.filter((g) => g !== guid)),
        benchGuidsJson: JSON.stringify(bench.filter((g) => g !== guid))
      }).where(eq(attendance.id, row.id)).run();
    }

    for (const team of tx.select().from(raidTeams).all()) {
      const assignments = parseArray(team.assignmentsJson).filter((a) => {
        const parsed = RaidSlotAssignmentSchema.safeParse(a);
        return !(parsed.success && parsed.data.characterGuid === guid);
      });
      const bench = GuidList.catch([]).parse(parseArray(team.benchGuidsJson)).filter((g) => g !== guid);
      tx.update(raidTeams).set({
        assignmentsJson: JSON.stringify(assignments),
        benchGuidsJson: JSON.stringify(bench)
      }).where(eq(raidTeams.id, team.id)).run();
    }

    tx.delete(characters).where(eq(characters.guid, guid)).run();
    return true;
  });
