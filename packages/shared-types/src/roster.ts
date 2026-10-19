import { z } from "zod";

export const RosterQuerySchema = z.object({
  includeInactive: z.enum(["true", "false"]).optional()
}).strict();

export const RosterStatusUpdateSchema = z.object({
  isActive: z.boolean()
}).strict();

export type RosterQuery = z.infer<typeof RosterQuerySchema>;
export type RosterStatusUpdate = z.infer<typeof RosterStatusUpdateSchema>;
