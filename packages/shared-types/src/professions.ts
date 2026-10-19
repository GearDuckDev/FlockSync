import { z } from "zod";

export const ProfessionSchema = z.object({
  name: z.string().min(1),
  level: z.number().int().nonnegative(),
  maxLevel: z.number().int().nonnegative(),
  recipes: z.array(z.number().int().positive()),
  acceptingRequests: z.boolean()
}).strict();

export type Profession = z.infer<typeof ProfessionSchema>;

export const PlayerProfessionsSchema = z.object({
  primary: z.array(ProfessionSchema),
  updatedAt: z.number().int().nonnegative()
}).strict();

export type PlayerProfessions = z.infer<typeof PlayerProfessionsSchema>;
