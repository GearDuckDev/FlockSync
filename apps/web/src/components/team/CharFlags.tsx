import { AlertTriangle, Lock } from 'lucide-react';
import type { Character, RaidTeamInput } from '@flocksync/shared-types';
import { dayStatus, formatReset, lockoutFor } from '../../lib/schedule';

type Context = Pick<RaidTeamInput, 'instanceName' | 'scheduledDay' | 'teamType'>;

/** Flags a character that is already saved to the raid or unavailable on the raid day. */
export const CharFlags = ({ character, team }: { character: Character; team: Context }): React.JSX.Element | null => {
  // Only raids use saved lockouts; dungeons and PvP have none.
  const lockout = team.teamType === 'RAID' ? lockoutFor(character, team.instanceName) : undefined;
  const status = dayStatus(character, team.scheduledDay);
  if (!lockout && status !== 'UNAVAILABLE' && status !== 'OCCASIONAL') return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {lockout && (
        <span
          title={`Locked to ${lockout.instanceName} (${lockout.completedEncounters}/${lockout.numEncounters}), resets in ${formatReset(lockout.resetAt)}`}
          className="inline-flex items-center gap-0.5 rounded bg-amber-950 px-1 text-[10px] font-semibold text-amber-300"
        >
          <Lock size={10} /> LOCKED
        </span>
      )}
      {status === 'UNAVAILABLE' && (
        <span title={`Marked unavailable on ${team.scheduledDay}`} className="inline-flex items-center gap-0.5 rounded bg-red-950 px-1 text-[10px] font-semibold text-red-300">
          <AlertTriangle size={10} /> NO {team.scheduledDay}
        </span>
      )}
      {status === 'OCCASIONAL' && (
        <span title={`Only occasionally available on ${team.scheduledDay}`} className="inline-flex items-center gap-0.5 rounded bg-yellow-950 px-1 text-[10px] font-semibold text-yellow-300">
          <AlertTriangle size={10} /> OCC {team.scheduledDay}
        </span>
      )}
    </span>
  );
};
