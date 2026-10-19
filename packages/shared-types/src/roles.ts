import { z } from "zod";

export const RoleEnum = z.enum(["TANK", "HEALER", "DPS"]);

export type Role = z.infer<typeof RoleEnum>;

export const PlayerRoleSchema = z.object({
  primaryRole: RoleEnum,
  offSpecEnabled: z.boolean(),
  offSpecRole: RoleEnum.optional(),
  updatedAt: z.number().int().nonnegative()
}).strict();

export type PlayerRole = z.infer<typeof PlayerRoleSchema>;
