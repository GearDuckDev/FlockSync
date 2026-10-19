import { z } from "zod";
import { AttunementChainSchema } from "./attunements.js";
import { PlayerAvailabilitySchema } from "./availability.js";
import { PlayerGearSchema } from "./gear.js";
import { PlayerGearGoalsSchema } from "./gearGoals.js";
import { PlayerProfessionsSchema } from "./professions.js";
import { PlayerLockoutsSchema } from "./lockouts.js";
import { PlayerRoleSchema } from "./roles.js";

export const CharacterSchema = z.object({
  guid: z.string().min(1),
  name: z.string().min(1),
  realm: z.string().min(1),
  classId: z.number().int().nonnegative(),
  level: z.number().int().nonnegative(),
  mainCharacterGuid: z.string().min(1).optional(),
  mainCharacterName: z.string().trim().min(1).max(64).optional(),
  isActive: z.boolean(),
  role: PlayerRoleSchema,
  gear: PlayerGearSchema,
  availability: PlayerAvailabilitySchema.optional(),
  lockouts: PlayerLockoutsSchema.optional(),
  professions: PlayerProfessionsSchema.optional(),
  attunements: z.array(AttunementChainSchema).optional(),
  gearGoals: PlayerGearGoalsSchema.optional(),
  lastSeenAt: z.number().int().nonnegative()
}).strict();

export type Character = z.infer<typeof CharacterSchema>;
