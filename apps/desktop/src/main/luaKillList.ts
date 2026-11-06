import { GuildIdentitySchema } from '@flocksync/shared-types';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const fields = ['name', 'realm', 'note', 'author', 'authorGuid', 'actorGuid',
  'createdAt', 'updatedAt', 'deleted'] as const;

export const sharedKillsFromLua = (db: Record<string, unknown>): {
  sharedKillList?: unknown[]; sharedKillObservations?: unknown[]
} => {
  const guild = GuildIdentitySchema.safeParse(db.collectorGuild);
  if (!guild.success || !record(db.killListGuilds)) return {};
  const store = db.killListGuilds[`${guild.data.realm}\x1f${guild.data.name}`];
  if (!record(store)) return {};
  const entries = Object.values(store).filter((entry) => record(entry) && entry.sharedLive === true);
  const observationStore = record(db.killListObservationsGuilds)
    ? db.killListObservationsGuilds[`${guild.data.realm}\x1f${guild.data.name}`] : undefined;
  const active = entries.filter(record).filter((entry) => entry.deleted !== true);
  const observations = record(observationStore) ? Object.values(observationStore).filter((entry) =>
    record(entry) && active.some((target) => target.name === entry.name && target.realm === entry.realm
      && target.createdAt === entry.targetCreatedAt)).map((entry) => {
    if (!record(entry)) throw new Error('Invalid shared observation');
    return Object.fromEntries(['id', 'kind', 'name', 'realm', 'targetGuid', 'targetCreatedAt',
      'timestamp', 'zone', 'reporterGuid', 'reporter', 'actorGuid', 'actor', 'victimGuid', 'victim']
      .filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]]));
  }) : [];
  return { sharedKillObservations: observations, sharedKillList: entries.map((entry) => {
    if (!record(entry)) throw new Error('Invalid shared kill-list entry');
    return Object.fromEntries(fields.map((key) => [key, entry[key]]));
  }) };
};
