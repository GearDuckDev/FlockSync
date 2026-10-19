import { stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverSavedVariablesDirs, HELPER_FILE } from './discovery';
import { serializeServerReturnToLua } from './luaParser';
import type { SyncLogEvent } from '../shared/ipc';

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
            && (await stat(file)).isFile()) continue;
        throw error;
      }
      onLog({
        timestamp: Date.now(), status: 'SUCCESS', characterCount: 0,
        message: `Officer helper initialized: ${file}. Restart WoW or /reload to load it.`,
      });
    } catch (error) {
      onLog({
        timestamp: Date.now(), status: 'ERROR', characterCount: 0,
        message: `Cannot initialize officer helper ${file}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
};
