import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import { isServerRealm, KillObservationSchema, serverIdFromGuid } from "@flocksync/shared-types";
import { characters, guildIdentity, killObservations, sharedKillTargets } from "./schema.js";

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

// Guilds are identified by name; realms in pre-1.2.1 keys are dropped.
const guildKeyOf = (key: string): string => splitKey(key)?.[1] ?? key;

const migrateKillTargets = (tx: Tx, realmFor: (label: string) => string | undefined, counts: Counts): void => {
  for (const row of tx.select().from(sharedKillTargets).all()) {
    const guildKey = guildKeyOf(row.guildKey);
    const realm = realmFor(row.realm) ?? row.realm;
    const targetKey = `${realm.toLowerCase()}${SEP}${row.name.toLowerCase()}`;
    if (guildKey === row.guildKey && targetKey === row.targetKey && realm === row.realm) continue;
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
    const entry = parseObservation(row.payload);
    if (!entry) continue;
    const guildKey = guildKeyOf(row.guildKey);
    // Must map exactly like the observation's kill target so the two keys stay linked.
    const realm = realmFor(entry.realm) ?? entry.realm;
    const targetKey = `${realm.toLowerCase()}${SEP}${entry.name.toLowerCase()}`;
    const id = row.kind === "SIGHTING" ? `S:${targetKey}` : row.id;
    if (guildKey === row.guildKey && id === row.id && targetKey === row.targetKey && realm === entry.realm) continue;
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

// Idempotent. A label shared by several servers (a connected realm) stays a
// label: the addon matches such kill targets by name on any server.
export const migrateRealmIdentity = (connection: Database.Database, guildServerId?: string): Counts => {
  const counts: Counts = { characters: 0, guild: 0, killTargets: 0, observations: 0 };
  drizzle(connection).transaction((tx) => {
    const labels = migrateCharacters(tx, counts);
    const unanimous = (label: string): string | undefined => {
      const servers = labels.get(label);
      return servers?.size === 1 ? [...servers][0] : undefined;
    };
    const guild = tx.select().from(guildIdentity).get();
    const guildServer = guild && !isServerRealm(guild.realm) ? guildServerId ?? unanimous(guild.realm) : undefined;
    if (guild && guildServer) {
      tx.update(guildIdentity).set({ realm: guildServer }).where(eq(guildIdentity.id, guild.id)).run();
      counts.guild++;
    }
    const realmFor = (label: string): string | undefined => isServerRealm(label) ? label : unanimous(label);
    migrateKillTargets(tx, realmFor, counts);
    migrateObservations(tx, realmFor, counts);
  });
  return counts;
};
