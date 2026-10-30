import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  const [collapsed, setCollapsed] = useState(false);
  const used = useMemo(
    () => new Set([...team.assignments.map((a) => a.characterGuid), ...team.benchGuids]),
    [team],
  );
  const pool = roster
    .filter((c) => c.isActive && !used.has(c.guid) && c.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex max-h-72 flex-col rounded-xl border border-slate-800 fold:sticky fold:top-4 fold:max-h-[34rem] lg:static">
      <div className="border-b border-slate-800 p-2">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase text-slate-400">Available Pool ({pool.length})</div>
          <button
            type="button"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-800 fold:hidden"
          >
            {collapsed ? 'Show' : 'Hide'}
            <ChevronDown size={13} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          </button>
        </div>
        <div className={collapsed ? 'hidden fold:block' : ''}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search characters…"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          />
          {!disabled && <div className="mt-1 text-[11px] text-slate-500">Select a character, then tap or click a slot.</div>}
        </div>
      </div>
      <ul className={`overflow-y-auto ${collapsed ? 'hidden fold:block' : ''}`}>
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
