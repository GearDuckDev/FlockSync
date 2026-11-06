import { z } from "zod";
import { GuildIdentitySchema } from "./guild.js";

const IdSchema = z.string().min(1).max(128);
const EpochSchema = z.number().int().nonnegative();

export const CharacterOwnershipSchema = z.object({
  characterGuid: IdSchema,
  userId: IdSchema,
  revision: z.string().uuid(),
  updatedAt: EpochSchema
}).strict();
export type CharacterOwnership = z.infer<typeof CharacterOwnershipSchema>;

export const SetCharacterOwnerSchema = z.object({
  userId: IdSchema.nullable(),
  expectedRevision: z.string().uuid().nullable(),
  confirmReassignment: z.boolean()
}).strict();
export type SetCharacterOwner = z.infer<typeof SetCharacterOwnerSchema>;

export const SetGroupOwnerSchema = SetCharacterOwnerSchema.extend({
  groupKey: IdSchema,
  expectedMembers: z.array(z.object({
    characterGuid: IdSchema, revision: z.string().uuid().nullable()
  }).strict()).min(1).max(5000)
}).strict();
export type SetGroupOwner = z.infer<typeof SetGroupOwnerSchema>;

export const OwnershipGroupSchema = z.object({
  key: IdSchema, label: z.string().min(1), characterGuids: z.array(IdSchema),
  userId: IdSchema.nullable(), revision: z.string().uuid().nullable()
}).strict();

export const CharacterOwnershipAuditSchema = z.object({
  id: z.string().uuid(),
  characterGuid: IdSchema,
  characterName: z.string().min(1),
  previousUserId: IdSchema.nullable(),
  previousUsername: z.string().nullable(),
  userId: IdSchema.nullable(),
  username: z.string().nullable(),
  actorId: IdSchema,
  actorUsername: z.string().min(1),
  changedAt: EpochSchema,
  reason: z.enum(["ASSIGNED", "REASSIGNED", "REVOKED", "USER_DELETED", "CHARACTER_DELETED",
    "GROUP_ASSIGNED", "GROUP_REASSIGNED", "GROUP_REVOKED"])
}).strict();
export type CharacterOwnershipAudit = z.infer<typeof CharacterOwnershipAuditSchema>;

export const CharacterOwnershipCatalogSchema = z.object({
  guild: GuildIdentitySchema.nullable(),
  users: z.array(z.object({ id: IdSchema, username: z.string().min(1) }).strict()),
  characters: z.array(z.object({
    guid: IdSchema, name: z.string().min(1), realm: z.string().min(1), isActive: z.boolean()
  }).strict()),
  ownerships: z.array(CharacterOwnershipSchema),
  groups: z.array(OwnershipGroupSchema).default([]),
  audit: z.array(CharacterOwnershipAuditSchema)
}).strict();
export type CharacterOwnershipCatalog = z.infer<typeof CharacterOwnershipCatalogSchema>;
