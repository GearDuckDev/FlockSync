import { z } from "zod";

export const RaidLockoutSchema = z.object({
  instanceName: z.string().min(1),
  instanceId: z.union([z.number(), z.string().min(1)]),
  difficultyId: z.number().int().nonnegative().optional(),
  resetAt: z.number().int().nonnegative(),
  locked: z.boolean(),
  extended: z.boolean(),
  numEncounters: z.number().int().nonnegative(),
  completedEncounters: z.number().int().nonnegative()
}).strict();

export type RaidLockout = z.infer<typeof RaidLockoutSchema>;

export const PlayerLockoutsSchema = z.object({
  lockouts: z.array(RaidLockoutSchema),
  updatedAt: z.number().int().nonnegative()
}).strict();

export type PlayerLockouts = z.infer<typeof PlayerLockoutsSchema>;
