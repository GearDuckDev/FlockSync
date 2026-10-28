import { z } from "zod";

export const BackupDirectoryRequestSchema = z.object({
  relativeDirectory: z.string().max(512)
}).strict();

export const RestoreBackupRequestSchema = z.object({
  relativeDirectory: z.string().max(512).optional(),
  filename: z.string().min(1).max(255).optional()
}).strict();

export const BackupSchema = z.object({
  filename: z.string().min(1),
  relativeDirectory: z.string(),
  size: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative()
}).strict();

export const BackupCatalogSchema = z.object({
  backupRoot: z.string(),
  selectedDirectory: z.string(),
  directories: z.array(z.string()),
  backups: z.array(BackupSchema)
}).strict();

export const DatabaseAdminResultSchema = z.object({
  backup: BackupSchema.optional(),
  databaseResetAt: z.number().int().nonnegative()
}).strict();

export type Backup = z.infer<typeof BackupSchema>;
export type BackupCatalog = z.infer<typeof BackupCatalogSchema>;
export type DatabaseAdminResult = z.infer<typeof DatabaseAdminResultSchema>;
