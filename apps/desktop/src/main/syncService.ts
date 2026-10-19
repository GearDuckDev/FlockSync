import { readFile, writeFile } from 'node:fs/promises';
import { apiSync } from './apiClient';
import { helperPathFor } from './discovery';
import { parseFlockSyncLua, serializeServerReturnToLua } from './luaParser';
import type { SyncLogEvent } from '../shared/ipc';

export interface SyncContext {
  isAuthorizedOfficer?: boolean;
  apiBaseUrl: string;
  token: string;
}

const log = (status: SyncLogEvent['status'], characterCount: number, message: string): SyncLogEvent => ({
  timestamp: Date.now(),
  status,
  characterCount,
  message,
});

/** Parse one SavedVariables file, push it to the API, and write the return payload next to it. */
export const syncFile = async (file: string, ctx: SyncContext): Promise<SyncLogEvent> => {
  let source: string;
  try {
    source = await readFile(file, 'utf8');
  } catch (err) {
    return log('ERROR', 0, `Cannot read ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }

  const parsed = parseFlockSyncLua(source);
  if (!parsed.ok) return log('ERROR', 0, parsed.error);
  const count = parsed.payload.characters.length;

  const res = await apiSync(ctx.apiBaseUrl, ctx.token, parsed.payload);
  if (!res.ok) return log('ERROR', count, res.error);

  try {
    await writeFile(helperPathFor(file), serializeServerReturnToLua(res.data), 'utf8');
  } catch (err) {
    return log('ERROR', count, `Synced, but failed to write helper file: ${err instanceof Error ? err.message : String(err)}`);
  }
  const culled = res.data.culledCharacterGuids.length;
  const { craftersIndex, upcomingRaids, goalMatches } = res.data;
  const missing = [
    craftersIndex === undefined ? 'craftersIndex' : undefined,
    upcomingRaids === undefined ? 'upcomingRaids' : undefined,
    goalMatches === undefined ? 'goalMatches' : undefined,
  ].filter((field) => field !== undefined);
  const snapshot = missing.length > 0
    ? `Server omitted snapshot fields (${missing.join(', ')}). Redeploy the API with the latest deployment package.`
    : `Snapshot: ${craftersIndex?.length} crafter recipes, ${upcomingRaids?.length} raid teams, ${goalMatches?.length} goal items.`;
  return log('SUCCESS', count, `Synced ${count} character(s); ${culled} culled. Helper file updated. ${snapshot}`);
};
