import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  BackupAttemptSchema, BackupHealthSchema, BackupVerificationSchema,
  type Backup, type BackupAttempt, type BackupHealth, type BackupVerification
} from "@flocksync/shared-types";
import { databasePath } from "../db/index.js";
import { readDatabaseAdminState, resolveBackupDirectory, resolveBackupFile } from "./databaseAdminState.js";

const statePath = (source: "api" | "scheduled", kind: "success" | "attempt") =>
  join(dirname(databasePath), `backup-health-${source}-${kind}.json`);
const staleAfterSeconds = 36 * 60 * 60;

const atomicWrite = async (path: string, value: unknown): Promise<void> => {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value), { flag: "wx", mode: 0o644 });
    await rename(temporary, path);
  } finally {
    try { await unlink(temporary); } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
};

const digest = async (path: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
};

export const recordBackupFailure = async (): Promise<void> => {
  await atomicWrite(statePath("api", "attempt"), BackupAttemptSchema.parse({
    attemptedAt: Math.floor(Date.now() / 1000), status: "failed"
  }));
};

export const recordVerifiedBackup = async (backup: Backup): Promise<void> => {
  const path = await resolveBackupFile(backup.relativeDirectory, backup.filename);
  const verifiedAt = Math.floor(Date.now() / 1000);
  await atomicWrite(statePath("api", "success"), BackupVerificationSchema.parse({
    filename: backup.filename, relativeDirectory: backup.relativeDirectory,
    size: backup.size, verifiedAt, sha256: await digest(path)
  }));
  await atomicWrite(statePath("api", "attempt"), { attemptedAt: verifiedAt, status: "ok" });
};

const readOptionalJson = async (path: string): Promise<unknown> => {
  try { return JSON.parse(await readFile(path, "utf8")) as unknown; } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
};

export const readBackupHealth = async (): Promise<BackupHealth> => {
  const { backupDirectory } = await readDatabaseAdminState();
  await resolveBackupDirectory(backupDirectory);
  const successes: BackupVerification[] = [];
  const attempts: BackupAttempt[] = [];
  for (const source of ["api", "scheduled"] as const) {
    const success = await readOptionalJson(statePath(source, "success"));
    const attempt = await readOptionalJson(statePath(source, "attempt"));
    if (success !== null) {
      const verified = BackupVerificationSchema.parse(success);
      if (verified.relativeDirectory === backupDirectory) successes.push(verified);
    }
    if (attempt !== null) attempts.push(BackupAttemptSchema.parse(attempt));
  }
  const latest = successes.sort((a, b) => b.verifiedAt - a.verifiedAt)[0];
  const attempt = attempts.sort((a, b) => b.attemptedAt - a.attemptedAt
    || Number(b.status === "failed") - Number(a.status === "failed"))[0];
  const now = Math.floor(Date.now() / 1000);
  if ((latest && latest.verifiedAt > now) || (attempt && attempt.attemptedAt > now)) {
    throw new Error("Backup evidence contains future timestamps");
  }
  const result = (status: BackupHealth["status"]) => BackupHealthSchema.parse({
    status, lastVerifiedAt: latest?.verifiedAt ?? null,
    lastAttemptAt: attempt?.attemptedAt ?? null, staleAfterSeconds
  });
  if (attempt?.status === "failed" && attempt.attemptedAt >= (latest?.verifiedAt ?? 0)) {
    return result("failed");
  }
  if (!latest) return result("missing");
  const file = await resolveBackupFile(latest.relativeDirectory, latest.filename);
  if (await digest(file) !== latest.sha256) throw new Error("Verified backup no longer matches its recorded digest");
  return result(now - latest.verifiedAt > staleAfterSeconds ? "stale" : "healthy");
};
