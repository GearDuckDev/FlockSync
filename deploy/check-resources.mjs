import { stat, statfs } from "node:fs/promises";
import { dirname } from "node:path";

// Run in the API container via stdin; relative imports resolve from /app.
const run = async () => {
  const { databasePath } = await import("./dist/db/index.js");
  const { env } = await import("./dist/config/env.js");
  const { readBackupHealth } = await import("./dist/services/backupHealth.js");
  const minimum = Number(process.env.RESOURCE_MIN_FREE_BYTES ?? 1073741824);
  const percent = Number(process.env.RESOURCE_MIN_FREE_PERCENT ?? 10);
  if (!Number.isSafeInteger(minimum) || minimum < 0
    || !Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error("Invalid resource check disk thresholds");
  }
  const disk = async (path) => {
    const info = await statfs(path);
    const freeBytes = info.bavail * info.bsize;
    const totalBytes = info.blocks * info.bsize;
    const freePercent = totalBytes > 0 ? freeBytes * 100 / totalBytes : 0;
    return { freeBytes, freePercent: Math.round(freePercent * 10) / 10,
      pressure: freeBytes < minimum || freePercent < percent };
  };
  const optionalSize = async (path) => {
    try { return (await stat(path)).size; } catch (error) {
      if (error.code === "ENOENT") return 0;
      throw error;
    }
  };
  const data = await disk(dirname(databasePath));
  const backupStorage = await disk(env.BACKUP_DIRECTORY);
  const backup = await readBackupHealth();
  const degraded = data.pressure || backupStorage.pressure || backup.status !== "healthy";
  console.log(JSON.stringify({
    event: degraded ? "resource_check_degraded" : "resource_check_ok",
    data, backupStorage, databaseBytes: (await stat(databasePath)).size,
    walBytes: await optionalSize(`${databasePath}-wal`), backup
  }));
  process.exitCode = degraded ? 2 : 0;
};

try { await run(); } catch (error) {
  console.error(JSON.stringify({
    event: "resource_check_failed",
    message: error instanceof Error ? error.message : "Unknown resource check error"
  }));
  process.exitCode = 1;
}
