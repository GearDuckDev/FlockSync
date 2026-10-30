import { Calendar, Clock } from 'lucide-react';
import type { Character } from '@flocksync/shared-types';
import { activeLockouts, availabilityDays, formatReset } from '../lib/schedule';
import { InfoTip } from './InfoTip';

export const LockoutBadges = ({ character }: { character: Character }): React.JSX.Element => {
  const lockouts = activeLockouts(character);
  if (lockouts.length === 0) return <span className="text-slate-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {lockouts.map((l) => (
        <InfoTip
          key={`${l.instanceId}-${l.difficultyId ?? 0}`}
          text={`${l.completedEncounters}/${l.numEncounters} bosses — resets in ${formatReset(l.resetAt)}`}
          className="inline-flex items-center gap-1 rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-300"
        >
          <Clock size={11} /> {l.instanceName} {l.completedEncounters}/{l.numEncounters}
        </InfoTip>
      ))}
    </div>
  );
};

export const AvailabilityBadge = ({ character }: { character: Character }): React.JSX.Element => {
  if (!character.availability) return <span className="text-slate-600">Not set</span>;
  const { regular, occasional } = availabilityDays(character);
  return (
    <InfoTip text={`Timezone: ${character.availability.timezone}`} className="block space-y-0.5 text-xs">
      <div className="flex items-center gap-1 text-emerald-300">
        <Calendar size={11} /> {regular.length ? regular.join(' ') : '—'}
      </div>
      {occasional.length > 0 && <div className="pl-4 text-yellow-300">~ {occasional.join(' ')}</div>}
    </InfoTip>
  );
};
