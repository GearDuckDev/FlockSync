import { z } from "zod";

export const DayOfWeekEnum = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
export type DayOfWeek = z.infer<typeof DayOfWeekEnum>;

export const AvailabilityCommitmentEnum = z.enum(["REGULAR", "OCCASIONAL", "UNAVAILABLE"]);
export type AvailabilityCommitment = z.infer<typeof AvailabilityCommitmentEnum>;

export const TimeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm");

export const DayScheduleSchema = z.object({
  day: DayOfWeekEnum,
  status: AvailabilityCommitmentEnum,
  startTime: TimeOfDaySchema,
  endTime: TimeOfDaySchema
}).strict();

export type DaySchedule = z.infer<typeof DayScheduleSchema>;

export const PlayerAvailabilitySchema = z.object({
  timezone: z.string().min(1).max(64),
  notes: z.string().max(500).optional(),
  schedule: z.array(DayScheduleSchema).max(7),
  updatedAt: z.number().int().nonnegative()
}).strict();

export type PlayerAvailability = z.infer<typeof PlayerAvailabilitySchema>;
