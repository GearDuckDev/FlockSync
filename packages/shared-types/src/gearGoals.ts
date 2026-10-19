import { z } from "zod";

export const GearGoalSchema = z.object({
  itemId: z.number().int().positive(),
  itemLink: z.string(),
  note: z.string().trim().max(80).optional()
}).strict();

export type GearGoal = z.infer<typeof GearGoalSchema>;

export const PlayerGearGoalsSchema = z.object({
  goals: z.array(GearGoalSchema).max(5),
  updatedAt: z.number().int().nonnegative()
}).strict();

export type PlayerGearGoals = z.infer<typeof PlayerGearGoalsSchema>;
