import { eq } from "drizzle-orm";
import {
  PlayerProfessionsSchema,
  PlayerGearGoalsSchema,
  type GuildCrafterSummary,
  type GuildGoalMatchSummary,
  type GuildUpcomingRaidSummary
} from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { characters } from "../db/schema.js";
import { listRaidTeams } from "./raids.service.js";

export const buildGuildSnapshot = () => {
  const active = db.select().from(characters).where(eq(characters.isActive, true)).all();
  const byGuid = new Map(active.map((character) => [character.guid, character]));
  const craftersIndex: GuildCrafterSummary[] = [];
  const goals = new Map<number, GuildGoalMatchSummary>();

  for (const character of active) {
    const professions = PlayerProfessionsSchema.nullable().parse(
      JSON.parse(character.professionsJson) as unknown
    );
    const recipes = new Set((professions?.primary ?? [])
      .filter((profession) => profession.acceptingRequests)
      .flatMap((profession) => profession.recipes));
    const mainName = character.mainCharacterName
      ?? (character.mainCharacterGuid ? byGuid.get(character.mainCharacterGuid)?.name : undefined);
    for (const recipe of recipes) {
      craftersIndex.push({
        itemIdOrSpellId: recipe,
        characterGuid: character.guid,
        characterName: character.name,
        ...(mainName ? { mainCharacterName: mainName } : {}),
        classId: character.classId,
        level: character.level
      });
    }

    const gearGoals = PlayerGearGoalsSchema.nullable().parse(
      JSON.parse(character.gearGoalsJson) as unknown
    );
    for (const itemId of new Set((gearGoals?.goals ?? []).map((goal) => goal.itemId))) {
      const match = goals.get(itemId) ?? { itemId, neededBy: [] };
      match.neededBy.push({
        characterGuid: character.guid,
        characterName: character.name,
        classId: character.classId,
        role: character.primaryRole
      });
      goals.set(itemId, match);
    }
  }

  // All stored schedules recur weekly, so each RAID team occurs within 14 days.
  const upcomingRaids: GuildUpcomingRaidSummary[] = listRaidTeams()
    .filter((team) => team.teamType === "RAID")
    .map((team) => {
      const assignments: GuildUpcomingRaidSummary["assignments"] = team.assignments.flatMap((slot) => {
        const character = byGuid.get(slot.characterGuid);
        return character ? [{ ...slot, characterName: character.name }] : [];
      });
      const assigned = new Set(assignments.map((slot) => slot.characterGuid));
      for (const guid of new Set(team.benchGuids)) {
        const character = byGuid.get(guid);
        if (!character || assigned.has(guid)) continue;
        assignments.push({
          characterGuid: guid,
          characterName: character.name,
          assignedRole: character.primaryRole,
          groupIndex: 0,
          slotIndex: 0,
          isBench: true
        });
      }
      return {
        id: team.id, name: team.name, instanceName: team.instanceName,
        scheduledDay: team.scheduledDay, startTime: team.startTime, assignments
      };
    });

  return { craftersIndex, upcomingRaids, goalMatches: [...goals.values()] };
};
