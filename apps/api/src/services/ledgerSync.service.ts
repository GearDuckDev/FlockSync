import { inArray } from "drizzle-orm";
import type { AttendanceRecord, LootRecord } from "@flocksync/shared-types";
import { attendance, lootHistory } from "../db/schema.js";
import { db } from "../db/index.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const existingIds = (
  tx: Transaction,
  table: typeof lootHistory | typeof attendance,
  ids: string[]
): Set<string> => {
  if (ids.length === 0) return new Set();
  return new Set(tx.select({ id: table.id }).from(table).where(inArray(table.id, ids)).all().map((r) => r.id));
};

/** Inserts only records whose id is new; the permanent history is append-only. */
export const upsertLoot = (tx: Transaction, records: LootRecord[]): void => {
  const unique = [...new Map(records.map((r) => [r.id, r])).values()];
  const known = existingIds(tx, lootHistory, unique.map((r) => r.id));
  for (const r of unique) {
    if (known.has(r.id)) continue;
    tx.insert(lootHistory).values({
      id: r.id,
      itemId: r.itemId,
      itemLink: r.itemLink,
      recipientGuid: r.recipientGuid,
      recipientName: r.recipientName,
      instanceName: r.instanceName,
      bossName: r.bossName ?? null,
      timestamp: r.timestamp
    }).run();
  }
};

export const upsertAttendance = (tx: Transaction, records: AttendanceRecord[]): void => {
  const unique = [...new Map(records.map((r) => [r.id, r])).values()];
  const known = existingIds(tx, attendance, unique.map((r) => r.id));
  for (const r of unique) {
    if (known.has(r.id)) continue;
    tx.insert(attendance).values({
      id: r.id,
      instanceName: r.instanceName,
      timestamp: r.timestamp,
      rosterGuidsJson: JSON.stringify(r.rosterGuids),
      benchGuidsJson: JSON.stringify(r.benchGuids)
    }).run();
  }
};
