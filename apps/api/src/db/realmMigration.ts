import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import { isServerRealm, KillObservationSchema, serverIdFromGuid } from "@flocksync/shared-types";
import { characters, guildIdentity, killObservations, sharedKillTargets } from "./schema.js";

export class RealmMigrationError extends Error {}

const SEP = "\u001f";
type Tx = Parameters<Parameters<ReturnType<typeof drizzle>["transaction"]>[0]>[0];
type Counts = { characters: number; guild: number; killTargets: number; observations: number };

const splitKey = (key: string): [string, string] | undefined => {
  const at = key.indexOf(SEP);
  return at < 0 ? undefined : [key.slice(0, at), key.slice(at + 1)];
};

// Characters carry their own server id; old labels map to a server only when unanimous.
const migrateCharacters = (tx: Tx, counts: Counts): Map<string, Set<string>> => {
  const labels = new Map<string, Set<string>>();
  for (const row of tx.select({ guid: characters.guid, realm: characters.realm }).from(characters).all()) {
    const server = serverIdFromGuid(row.guid);
    if (!server || row.realm === server) continue;
    if (!isServerRealm(row.realm)) labels.set(row.realm, (labels.get(row.realm) ?? new Set()).add(server));
    tx.update(characters).set({ realm: server }).where(eq(characters.guid, row.guid)).run();
    counts.characters++;
  }
  return labels;
};

const migrateKillTargets = (tx: Tx, realmFor: (label: string) => string | undefined, counts: Counts): void => {
  for (const row of tx.select().from(sharedKillTargets).all()) {
    const parts = splitKey(row.guildKey);
    if (!parts || (isServerRealm(parts[0]) && isServerRealm(row.realm))) continue;
    const guildRealm = realmFor(parts[0]);
    const realm = realmFor(row.realm);
    if (!guildRealm || !realm) continue;
    const guildKey = `${guildRealm}${SEP}${parts[1]}`;
    const targetKey = `${realm.toLowerCase()}${SEP}${row.name.toLowerCase()}`;
    const clash = tx.select().from(sharedKillTargets)
      .where(and(eq(sharedKillTargets.guildKey, guildKey), eq(sharedKillTargets.targetKey, targetKey))).get();
    tx.delete(sharedKillTargets)
      .where(and(eq(sharedKillTargets.guildKey, row.guildKey), eq(sharedKillTargets.targetKey, row.targetKey))).run();
    if (clash && clash.updatedAt >= row.updatedAt) continue;
    if (clash) tx.delete(sharedKillTargets)
      .where(and(eq(sharedKillTargets.guildKey, guildKey), eq(sharedKillTargets.targetKey, targetKey))).run();
    tx.insert(sharedKillTargets).values({ ...row, guildKey, targetKey, realm }).run();
    counts.killTargets++;
  }
};

const parseObservation = (payload: string): ReturnType<typeof KillObservationSchema.parse> | undefined => {
  try {
    const parsed = KillObservationSchema.safeParse(JSON.parse(payload) as unknown);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

const migrateObservations = (tx: Tx, realmFor: (label: string) => string | undefined, counts: Counts): void => {
  for (const row of tx.select().from(killObservations).all()) {
    const parts = splitKey(row.guildKey);
    const entry = parseObservation(row.payload);
    if (!parts || !entry || (isServerRealm(parts[0]) && isServerRealm(entry.realm))) continue;
    const guildRealm = realmFor(parts[0]);
    const realm = realmFor(entry.realm) ?? serverIdFromGuid(entry.targetGuid);
    if (!guildRealm || !realm) continue;
    const guildKey = `${guildRealm}${SEP}${parts[1]}`;
    const targetKey = `${realm.toLowerCase()}${SEP}${entry.name.toLowerCase()}`;
    const id = row.kind === "SIGHTING" ? `S:${targetKey}` : row.id;
    const clash = tx.select().from(killObservations)
      .where(and(eq(killObservations.guildKey, guildKey), eq(killObservations.id, id))).get();
    tx.delete(killObservations)
      .where(and(eq(killObservations.guildKey, row.guildKey), eq(killObservations.id, row.id))).run();
    if (clash && clash.timestamp >= row.timestamp) continue;
    if (clash) tx.delete(killObservations)
      .where(and(eq(killObservations.guildKey, guildKey), eq(killObservations.id, id))).run();
    tx.insert(killObservations).values({
      guildKey, id, targetKey, kind: row.kind, timestamp: row.timestamp,
      payload: JSON.stringify({ ...entry, realm })
    }).run();
    counts.observations++;
  }
};

// Idempotent: rows already keyed by numeric server ids are left untouched.
export const migrateRealmIdentity = (connection: Database.Database, guildServerId?: string): Counts => {
  const counts: Counts = { characters: 0, guild: 0, killTargets: 0, observations: 0 };
  drizzle(connection).transaction((tx) => {
    const labels = migrateCharacters(tx, counts);
    const unanimous = (label: string): string | undefined => {
      const servers = labels.get(label);
      return servers?.size === 1 ? [...servers][0] : undefined;
    };
    let guildLabel: string | undefined;
    let guildServer: string | undefined;
    const guild = tx.select().from(guildIdentity).get();
    if (guild && !isServerRealm(guild.realm)) {
      guildLabel = guild.realm;
      guildServer = guildServerId ?? unanimous(guild.realm);
      if (!guildServer) {
        throw new RealmMigrationError(`Stored guild realm matches ${labels.get(guild.realm)?.size ?? 0} server ids. `
          + "Set GUILD_SERVER_ID to the guild's numeric server id (the number after \"Player-\" in any member GUID) "
          + "and restart; the database was not changed.");
      }
      tx.update(guildIdentity).set({ realm: guildServer }).where(eq(guildIdentity.id, guild.id)).run();
      counts.guild++;
    }
    const realmFor = (label: string): string | undefined => isServerRealm(label) ? label
      : label === guildLabel ? guildServer : unanimous(label);
    migrateKillTargets(tx, realmFor, counts);
    migrateObservations(tx, realmFor, counts);
  });
  return counts;
};
