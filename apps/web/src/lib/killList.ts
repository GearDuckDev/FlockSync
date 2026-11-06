import type { SharedKillEntry } from '@flocksync/shared-types';

export const mayChangeKill = (
  entry: SharedKillEntry, canManage: boolean, ownedGuids: ReadonlySet<string>
): boolean => canManage || ownedGuids.has(entry.authorGuid);
