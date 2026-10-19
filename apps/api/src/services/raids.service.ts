import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { RaidTeamSchema } from "@flocksync/shared-types";
import type { RaidTeam, RaidTeamInput } from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { raidTeams } from "../db/schema.js";

type RaidRow = typeof raidTeams.$inferSelect;

const toTeam = (row: RaidRow): RaidTeam => RaidTeamSchema.parse({
  id: row.id,
  name: row.name,
  teamType: row.teamType,
  instanceName: row.instanceName,
  raidSize: row.raidSize,
  scheduledDay: row.scheduledDay,
  startTime: row.startTime,
  endTime: row.endTime,
  timezone: row.timezone,
  targetTanks: row.targetTanks,
  targetHealers: row.targetHealers,
  targetDps: row.targetDps,
  assignments: JSON.parse(row.assignmentsJson) as unknown,
  benchGuids: JSON.parse(row.benchGuidsJson) as unknown,
  updatedAt: row.updatedAt
});

const toValues = (input: RaidTeamInput) => ({
  name: input.name,
  teamType: input.teamType,
  instanceName: input.instanceName,
  raidSize: input.raidSize,
  scheduledDay: input.scheduledDay,
  startTime: input.startTime,
  endTime: input.endTime,
  timezone: input.timezone,
  targetTanks: input.targetTanks,
  targetHealers: input.targetHealers,
  targetDps: input.targetDps,
  assignmentsJson: JSON.stringify(input.assignments),
  benchGuidsJson: JSON.stringify(input.benchGuids),
  updatedAt: Math.floor(Date.now() / 1000)
});

export const listRaidTeams = (): RaidTeam[] => db.select().from(raidTeams).all().map(toTeam);

export const createRaidTeam = (input: RaidTeamInput): RaidTeam => {
  const row = { id: randomUUID(), ...toValues(input) };
  db.insert(raidTeams).values(row).run();
  return toTeam(row);
};

export const updateRaidTeam = (id: string, input: RaidTeamInput): RaidTeam | undefined => {
  const result = db.update(raidTeams).set(toValues(input)).where(eq(raidTeams.id, id)).run();
  if (result.changes === 0) return undefined;
  const row = db.select().from(raidTeams).where(eq(raidTeams.id, id)).get();
  return row ? toTeam(row) : undefined;
};

export const deleteRaidTeam = (id: string): boolean =>
  db.delete(raidTeams).where(eq(raidTeams.id, id)).run().changes > 0;
