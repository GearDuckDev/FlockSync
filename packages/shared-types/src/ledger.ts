import { z } from "zod";

export const LootRecordSchema = z.object({
  id: z.string().min(1).max(128),
  itemId: z.number().int().positive(),
  itemLink: z.string(),
  recipientGuid: z.string(),
  recipientName: z.string().min(1),
  instanceName: z.string().min(1),
  bossName: z.string().min(1).optional(),
  timestamp: z.number().int().nonnegative()
}).strict();

export type LootRecord = z.infer<typeof LootRecordSchema>;

export const AttendanceRecordSchema = z.object({
  id: z.string().min(1).max(128),
  instanceName: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  rosterGuids: z.array(z.string()),
  benchGuids: z.array(z.string())
}).strict();

export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;
