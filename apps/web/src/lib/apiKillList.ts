import {
  KillCreateRequestSchema, SharedKillEntrySchema, SharedKillListSchema, type SharedKillEntry
} from '@flocksync/shared-types';
import { request } from './api';
import { KillObservationsSchema, type KillObservation } from '@flocksync/shared-types';

export const fetchKillObservations = async (token: string): Promise<KillObservation[]> =>
  KillObservationsSchema.parse(await request('/api/kill-list/observations', {}, token));

export const fetchKillList = async (token: string): Promise<SharedKillEntry[]> =>
  SharedKillListSchema.parse(await request('/api/kill-list', {}, token));

export const createKillEntry = async (
  token: string, name: string, note: string
): Promise<SharedKillEntry> => SharedKillEntrySchema.parse(await request('/api/kill-list', {
  method: 'POST', body: JSON.stringify(KillCreateRequestSchema.parse({ name, note }))
}, token));

export const changeKillEntry = async (
  token: string, entry: SharedKillEntry, note?: string
): Promise<SharedKillEntry> => SharedKillEntrySchema.parse(await request('/api/kill-list', {
  method: note === undefined ? 'DELETE' : 'PATCH',
  body: JSON.stringify({
    name: entry.name, realm: entry.realm, expectedUpdatedAt: entry.updatedAt,
    ...(note === undefined ? {} : { note })
  })
}, token));
