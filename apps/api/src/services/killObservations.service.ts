import { and, desc, eq, lt, ne } from "drizzle-orm";
import { KillObservationSchema, type KillObservation } from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { guildIdentity, killObservations, sharedKillTargets } from "../db/schema.js";
import { KillSyncConflict } from "./killList.service.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const RETENTION = 90 * 86400;
const guildKey = (guild: { name: string; realm: string }): string => `${guild.realm}\u001f${guild.name}`;
const targetKey = (entry: { name: string; realm: string }): string =>
  `${entry.realm.toLowerCase()}\u001f${entry.name.toLowerCase()}`;
const parse = (payload: string): KillObservation => KillObservationSchema.parse(JSON.parse(payload) as unknown);
export const upsertKillObservations = (
  tx: Transaction, incoming: KillObservation[], guild: { name: string; realm: string }, resetAt: number, now: number
): void => {
  const key = guildKey(guild);
  tx.delete(killObservations).where(and(eq(killObservations.guildKey, key),
    ne(killObservations.kind, "SIGHTING"), lt(killObservations.timestamp, now - RETENTION))).run();
  const existing = tx.select().from(killObservations).where(eq(killObservations.guildKey, key)).all();
  const targets = new Map(tx.select().from(sharedKillTargets).where(eq(sharedKillTargets.guildKey, key))
    .all().filter((row) => !row.deleted).map((row) => [row.targetKey, row.createdAt]));
  const byId = new Map<string, KillObservation>();
  const battleTimes = new Map<string, number[]>();
  const signature = (entry: KillObservation): string =>
    JSON.stringify([targetKey(entry), entry.kind, entry.actorGuid, entry.victimGuid]);
  const remember = (id: string, entry: KillObservation): void => {
    byId.set(id, entry);
    if (entry.kind !== "SIGHTING") {
      const key = signature(entry);
      const times = battleTimes.get(key) ?? [];
      times.push(entry.timestamp);
      battleTimes.set(key, times);
    }
  };
  for (const row of existing) {
    const entry = parse(row.payload);
    if (targets.get(targetKey(entry)) !== entry.targetCreatedAt) tx.delete(killObservations).where(and(
      eq(killObservations.guildKey, key), eq(killObservations.id, row.id)
    )).run();
    else remember(row.id, entry);
  }
  for (const entry of incoming) {
    if (entry.timestamp <= resetAt || (entry.kind !== "SIGHTING" && entry.timestamp < now - RETENTION)
      || targets.get(targetKey(entry)) !== entry.targetCreatedAt) continue;
    if (entry.realm !== guild.realm || entry.timestamp > now + 30) {
      throw new KillSyncConflict("Observation realm or clock does not match the collector");
    }
    const target = targetKey(entry);
    const id = entry.kind === "SIGHTING" ? `S:${target}` : entry.id;
    const old = byId.get(id);
    if (old) {
      if (entry.kind === "SIGHTING" && old.kind === "SIGHTING" && entry.timestamp <= old.timestamp) continue;
      if (entry.kind !== "SIGHTING") {
        if (JSON.stringify(old) !== JSON.stringify(entry)) {
          throw new KillSyncConflict("Battle event identity conflicts with an existing report");
        }
        continue;
      }
    }
    if (entry.kind !== "SIGHTING") {
      const duplicate = battleTimes.get(signature(entry))?.some((time) => Math.abs(time - entry.timestamp) <= 5);
      if (duplicate) continue;
    }
    tx.insert(killObservations).values({
      guildKey: key, id, targetKey: target, kind: entry.kind,
      timestamp: entry.timestamp, payload: JSON.stringify(entry)
    }).onConflictDoUpdate({ target: [killObservations.guildKey, killObservations.id],
      set: { timestamp: entry.timestamp, payload: JSON.stringify(entry) } }).run();
    remember(id, entry);
  }
  const battles = tx.select().from(killObservations).where(eq(killObservations.guildKey, key))
    .orderBy(desc(killObservations.timestamp), desc(killObservations.id)).all().filter((row) => row.kind !== "SIGHTING");
  for (const row of battles.slice(5000)) tx.delete(killObservations).where(and(
    eq(killObservations.guildKey, key), eq(killObservations.id, row.id)
  )).run();
};

export const listKillObservations = (): KillObservation[] => {
  const guild = db.select().from(guildIdentity).get();
  if (!guild) return [];
  return db.transaction((tx) => {
    upsertKillObservations(tx, [], guild, 0, Math.floor(Date.now() / 1000));
    return tx.select().from(killObservations).where(eq(killObservations.guildKey, guildKey(guild)))
      .orderBy(desc(killObservations.timestamp), desc(killObservations.id)).all().map((row) => parse(row.payload));
  });
};
