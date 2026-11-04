import { z } from "zod";

export const BackupVerificationSchema = z.object({
  verifiedAt: z.number().int().nonnegative(),
  filename: z.string().regex(/^flocksync-[A-Za-z0-9._-]+\.db$/),
  relativeDirectory: z.string().max(512),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();

export const BackupAttemptSchema = z.object({
  attemptedAt: z.number().int().nonnegative(),
  status: z.enum(["ok", "failed"])
}).strict();

export const BackupHealthSchema = z.object({
  status: z.enum(["healthy", "missing", "failed", "stale", "unavailable"]),
  lastVerifiedAt: z.number().int().nonnegative().nullable(),
  lastAttemptAt: z.number().int().nonnegative().nullable(),
  staleAfterSeconds: z.number().int().positive()
}).strict();

export type BackupVerification = z.infer<typeof BackupVerificationSchema>;
export type BackupAttempt = z.infer<typeof BackupAttemptSchema>;
export type BackupHealth = z.infer<typeof BackupHealthSchema>;
