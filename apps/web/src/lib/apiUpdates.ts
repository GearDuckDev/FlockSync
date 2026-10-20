import {
  ServerUpdateStatusSchema, type ServerUpdateStatus, type UpdateChannel
} from '@flocksync/shared-types';
import { request } from './api';

export const checkServerUpdates = async (token: string, channel: UpdateChannel): Promise<ServerUpdateStatus> =>
  ServerUpdateStatusSchema.parse(await request(`/api/updates/server?channel=${channel}`, {}, token));

export const fetchServerVersion = async (token: string): Promise<string> =>
  ServerUpdateStatusSchema.pick({ currentVersion: true }).parse(
    await request('/api/updates/server/version', {}, token)
  ).currentVersion;
