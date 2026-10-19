import { z } from "zod";
import { DayOfWeekEnum, TimeOfDaySchema } from "./availability.js";
import { RoleEnum } from "./roles.js";

export const TeamTypeEnum = z.enum(["PVP", "DUNGEON", "RAID"]);
export type TeamType = z.infer<typeof TeamTypeEnum>;

// Raids and PvP use fixed sizes; dungeon teams can be any number of 5-man parties.
export const RaidSizeEnum = z.number().int().min(5).max(200).multipleOf(5);
export type RaidSize = z.infer<typeof RaidSizeEnum>;

export const RaidSlotAssignmentSchema = z.object({
  groupIndex: z.number().int().min(1).max(40),
  slotIndex: z.number().int().min(1).max(5),
  characterGuid: z.string().min(1),
  assignedRole: RoleEnum,
  isBench: z.boolean().optional()
}).strict();

export type RaidSlotAssignment = z.infer<typeof RaidSlotAssignmentSchema>;

const raidTeamFields = {
  name: z.string().trim().min(1).max(80),
  teamType: TeamTypeEnum.default("RAID"),
  instanceName: z.string().trim().min(1).max(80),
  raidSize: RaidSizeEnum,
  scheduledDay: DayOfWeekEnum,
  startTime: TimeOfDaySchema,
  endTime: TimeOfDaySchema,
  timezone: z.string().min(1).max(64),
  targetTanks: z.number().int().min(0).max(200),
  targetHealers: z.number().int().min(0).max(200),
  targetDps: z.number().int().min(0).max(200),
  assignments: z.array(RaidSlotAssignmentSchema).max(200),
  benchGuids: z.array(z.string().min(1)).max(300)
};

export const RaidTeamInputSchema = z.object(raidTeamFields).strict();
export type RaidTeamInput = z.infer<typeof RaidTeamInputSchema>;

export const RaidTeamSchema = z.object({
  id: z.string().min(1),
  ...raidTeamFields,
  updatedAt: z.number().int().nonnegative()
}).strict();

export type RaidTeam = z.infer<typeof RaidTeamSchema>;
