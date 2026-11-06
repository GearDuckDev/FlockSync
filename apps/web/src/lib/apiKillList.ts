import { SharedKillEntrySchema, SharedKillListSchema, type SharedKillEntry } from '@flocksync/shared-types';
import { request } from './api';

export const fetchKillList = async (token: string): Promise<SharedKillEntry[]> =>
  SharedKillListSchema.parse(await request('/api/kill-list', {}, token));

export const changeKillEntry = async (
  token: string, entry: SharedKillEntry, note?: string
): Promise<SharedKillEntry> => SharedKillEntrySchema.parse(await request('/api/kill-list', {
  method: note === undefined ? 'DELETE' : 'PATCH',
  body: JSON.stringify({
    name: entry.name, realm: entry.realm, expectedUpdatedAt: entry.updatedAt,
    ...(note === undefined ? {} : { note })
  })
}, token));
