import { desc } from "drizzle-orm";
import { AttendanceRecordSchema, LootRecordSchema } from "@flocksync/shared-types";
import type { AttendanceRecord, LootRecord } from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { attendance, lootHistory } from "../db/schema.js";

const parseGuids = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return [];
  }
};

export const listLoot = (limit: number): LootRecord[] =>
  db.select().from(lootHistory).orderBy(desc(lootHistory.timestamp)).limit(limit).all()
    .map((row) => LootRecordSchema.parse({
      id: row.id,
      itemId: row.itemId,
      itemLink: row.itemLink,
      recipientGuid: row.recipientGuid,
      recipientName: row.recipientName,
      instanceName: row.instanceName,
      ...(row.bossName === null ? {} : { bossName: row.bossName }),
      timestamp: row.timestamp
    }));

export const listAttendance = (limit: number): AttendanceRecord[] =>
  db.select().from(attendance).orderBy(desc(attendance.timestamp)).limit(limit).all()
    .map((row) => AttendanceRecordSchema.parse({
      id: row.id,
      instanceName: row.instanceName,
      timestamp: row.timestamp,
      rosterGuids: parseGuids(row.rosterGuidsJson),
      benchGuids: parseGuids(row.benchGuidsJson)
    }));
