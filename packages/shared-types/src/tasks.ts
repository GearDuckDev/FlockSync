import { z } from "zod";

export const TaskStatusEnum = z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const OfficerTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  assignedOfficerId: z.string().min(1).optional(),
  relatedCharacterGuid: z.string().min(1).optional(),
  status: TaskStatusEnum,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative()
}).strict();

export type OfficerTask = z.infer<typeof OfficerTaskSchema>;

export const OfficerTaskInputSchema = z.object({
  title: OfficerTaskSchema.shape.title,
  description: OfficerTaskSchema.shape.description,
  assignedOfficerId: OfficerTaskSchema.shape.assignedOfficerId,
  relatedCharacterGuid: OfficerTaskSchema.shape.relatedCharacterGuid,
  status: TaskStatusEnum.default("OPEN")
}).strict();

export type OfficerTaskInput = z.infer<typeof OfficerTaskInputSchema>;
