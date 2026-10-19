import { z } from "zod";

export const AttunementStepSchema = z.object({
  stepId: z.number().int().nonnegative(),
  questId: z.number().int().positive(),
  name: z.string().min(1),
  completed: z.boolean()
}).strict();

export type AttunementStep = z.infer<typeof AttunementStepSchema>;

export const AttunementChainSchema = z.object({
  chainId: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(AttunementStepSchema),
  isFullyAttuned: z.boolean(),
  updatedAt: z.number().int().nonnegative()
}).strict();

export type AttunementChain = z.infer<typeof AttunementChainSchema>;
