import { z } from "zod";
import { AttendanceRecordSchema, LootRecordSchema } from "./ledger.js";
import { CharacterSchema } from "./player.js";
import { AddonReleaseCatalogSchema } from "./releases.js";
import { GuildIdentitySchema } from "./guild.js";

const CollectorGuildSchema = GuildIdentitySchema;

export const OfficerSyncPayloadSchema = z.object({
  addonVersion: z.string().min(1),
  officerCharacter: CharacterSchema,
  exportedAt: z.number().int().nonnegative(),
  collectorGuild: CollectorGuildSchema.optional(),
  includeHelperReleases: z.boolean().optional(),
  characters: z.array(CharacterSchema),
  lootHistory: z.array(LootRecordSchema).optional(),
  attendanceHistory: z.array(AttendanceRecordSchema).optional()
}).strict();

export type OfficerSyncPayload = z.infer<typeof OfficerSyncPayloadSchema>;

export const GuildCrafterSummarySchema = z.object({
  itemIdOrSpellId: z.number().int().positive(),
  characterGuid: z.string().min(1),
  characterName: z.string().min(1),
  mainCharacterName: z.string().min(1).optional(),
  classId: z.number().int().positive(),
  level: z.number().int().nonnegative()
}).strict();

export type GuildCrafterSummary = z.infer<typeof GuildCrafterSummarySchema>;

export const GuildUpcomingRaidSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  instanceName: z.string().min(1),
  scheduledDay: z.string().min(1),
  startTime: z.string().min(1),
  assignments: z.array(z.object({
    characterGuid: z.string().min(1),
    characterName: z.string().min(1),
    assignedRole: z.string().min(1),
    groupIndex: z.number().int().nonnegative(),
    slotIndex: z.number().int().nonnegative(),
    isBench: z.boolean().optional()
  }).strict())
}).strict();

export type GuildUpcomingRaidSummary = z.infer<typeof GuildUpcomingRaidSummarySchema>;

export const GuildGoalMatchSummarySchema = z.object({
  itemId: z.number().int().positive(),
  neededBy: z.array(z.object({
    characterGuid: z.string().min(1),
    characterName: z.string().min(1),
    classId: z.number().int().positive(),
    role: z.string().min(1).optional()
  }).strict())
}).strict();

export type GuildGoalMatchSummary = z.infer<typeof GuildGoalMatchSummarySchema>;

export const ServerReturnPayloadSchema = z.object({
  isAuthorizedOfficer: z.boolean().default(true),
  authorizedCollectorGuild: CollectorGuildSchema.optional(),
  culledCharacterGuids: z.array(z.string()),
  serverTimestamp: z.number().int().nonnegative(),
  databaseResetAt: z.number().int().nonnegative().optional(),
  craftersIndex: z.array(GuildCrafterSummarySchema).optional(),
  upcomingRaids: z.array(GuildUpcomingRaidSummarySchema).optional(),
  goalMatches: z.array(GuildGoalMatchSummarySchema).optional(),
  addonReleases: AddonReleaseCatalogSchema.optional(),
  helperReleases: AddonReleaseCatalogSchema.optional()
}).strict();

export type ServerReturnPayload = z.infer<typeof ServerReturnPayloadSchema>;
