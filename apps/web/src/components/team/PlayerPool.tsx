import { useMemo, useState } from 'react';
import type { Character, RaidTeamInput } from '@flocksync/shared-types';
import { classInfo } from '../../lib/wow';
import { RoleBadge } from '../Badges';
import { CharFlags } from './CharFlags';

interface Props {
  roster: Character[];
  team: RaidTeamInput;
  armedGuid: string | null;
  disabled: boolean;
  onArm: (guid: string | null) => void;
  onBench: (guid: string) => void;
}

export const PlayerPool = ({ roster, team, armedGuid, disabled, onArm, onBench }: Props): React.JSX.Element => {
  const [query, setQuery] = useState('');
  const used = useMemo(
    () => new Set([...team.assignments.map((a) => a.characterGuid), ...team.benchGuids]),
    [team],
  );
  const pool = roster
    .filter((c) => c.isActive && !used.has(c.guid) && c.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex max-h-[34rem] flex-col rounded-xl border border-slate-800">
      <div className="border-b border-slate-800 p-2">
        <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Available Pool ({pool.length})</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search characters…"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
        />
        {!disabled && <div className="mt-1 text-[11px] text-slate-500">Click a character, then click a slot.</div>}
      </div>
      <ul className="overflow-y-auto">
        {pool.map((c) => {
          const info = classInfo(c.classId);
          return (
            <li
              key={c.guid}
              className={`flex items-center justify-between gap-2 border-b border-slate-900 px-2 py-1.5 text-sm ${armedGuid === c.guid ? 'bg-indigo-950' : 'hover:bg-slate-900'}`}
            >
              <button disabled={disabled} onClick={() => onArm(armedGuid === c.guid ? null : c.guid)} className="min-w-0 flex-1 text-left">
                <div className="truncate font-medium" style={{ color: info.color }}>{c.name}</div>
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <RoleBadge role={c.role.primaryRole} />
                  {c.mainCharacterName && <span className="text-slate-500">alt of {c.mainCharacterName}</span>}
                  <CharFlags character={c} team={team} />
                </div>
              </button>
              {!disabled && (
                <button onClick={() => onBench(c.guid)} className="rounded border border-slate-700 px-1.5 py-0.5 text-[11px] hover:bg-slate-800">
                  Bench
                </button>
              )}
            </li>
          );
        })}
        {pool.length === 0 && <li className="px-2 py-4 text-center text-sm text-slate-500">No characters available.</li>}
      </ul>
    </div>
  );
};
