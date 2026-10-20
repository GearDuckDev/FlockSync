import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ServerReturnPayloadSchema } from '@flocksync/shared-types';
import { discoverSavedVariablesDirs, HELPER_FILE } from './discovery';
import { serializeServerReturnToLua } from './luaParser';
import { luaToJs, parseLuaAssignment } from './luaTable';
import type { SyncLogEvent } from '../shared/ipc';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const authorizeExistingHelper = async (file: string): Promise<boolean> => {
  const raw = luaToJs(parseLuaAssignment(await readFile(file, 'utf8'), 'FlockSyncHelperDB'));
  if (!isRecord(raw)) throw new Error('Helper database is not a table');
  const payload = ServerReturnPayloadSchema.parse({
    ...raw,
    isAuthorizedOfficer: true,
    culledCharacterGuids: raw.culledCharacterGuids ?? [],
    serverTimestamp: raw.serverTimestamp ?? 0,
  });
  if (raw.isAuthorizedOfficer === true) return false;
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, serializeServerReturnToLua(payload), {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporaryFile, file);
  } catch (error) {
    try {
      await unlink(temporaryFile);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Error && 'code' in cleanupError && cleanupError.code === 'ENOENT')) {
        throw cleanupError;
      }
    }
    throw error;
  }
  return true;
};

export const initializeOfficerHelpers = async (
  wowPath: string,
  onLog: (event: SyncLogEvent) => void,
): Promise<void> => {
  const source = serializeServerReturnToLua({
    isAuthorizedOfficer: true, culledCharacterGuids: [], serverTimestamp: 0,
  });
  for (const directory of discoverSavedVariablesDirs(wowPath)) {
    const file = join(directory, HELPER_FILE);
    try {
      // Exclusive creation preserves existing cull data and avoids a check/write race.
      try {
        await writeFile(file, source, { encoding: 'utf8', flag: 'wx' });
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EEXIST'
            && (await stat(file)).isFile()) {
          if (!await authorizeExistingHelper(file)) continue;
        } else {
          throw error;
        }
      }
      onLog({
        timestamp: Date.now(), status: 'SUCCESS', characterCount: 0,
        message: `Officer helper authorized: ${file}. Restart WoW or /reload to load it.`,
      });
    } catch (error) {
      onLog({
        timestamp: Date.now(), status: 'ERROR', characterCount: 0,
        message: `Cannot initialize officer helper ${file}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
};
