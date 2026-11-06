import { GuildIdentitySchema } from '@flocksync/shared-types';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const fields = ['name', 'realm', 'note', 'author', 'authorGuid', 'actorGuid',
  'createdAt', 'updatedAt', 'deleted'] as const;

export const sharedKillsFromLua = (db: Record<string, unknown>): { sharedKillList?: unknown[] } => {
  const guild = GuildIdentitySchema.safeParse(db.collectorGuild);
  if (!guild.success || !record(db.killListGuilds)) return {};
  const store = db.killListGuilds[`${guild.data.realm}\x1f${guild.data.name}`];
  if (!record(store)) return {};
  const entries = Object.values(store).filter((entry) => record(entry) && entry.sharedLive === true);
  return { sharedKillList: entries.map((entry) => {
    if (!record(entry)) throw new Error('Invalid shared kill-list entry');
    return Object.fromEntries(fields.map((key) => [key, entry[key]]));
  }) };
};
