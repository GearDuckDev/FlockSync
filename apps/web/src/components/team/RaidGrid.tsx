import { X } from 'lucide-react';
import type { Character, RaidTeamInput, Role } from '@flocksync/shared-types';
import { groupCount } from '../../lib/teamBuilder';
import { groupLabel } from '../../lib/activities';
import { classInfo } from '../../lib/wow';
import { RoleBadge } from '../Badges';
import { CharFlags } from './CharFlags';

interface Props {
  team: RaidTeamInput;
  byGuid: Map<string, Character>;
  armedGuid: string | null;
  disabled: boolean;
  onPlace: (groupIndex: number, slotIndex: number) => void;
  onRemove: (guid: string) => void;
  onRole: (guid: string, role: Role) => void;
  onBenchArmed: () => void;
}

const SLOTS = [1, 2, 3, 4, 5];

export const RaidGrid = ({ team, byGuid, armedGuid, disabled, onPlace, onRemove, onRole, onBenchArmed }: Props): React.JSX.Element => {
  const groups = Array.from({ length: groupCount(team.raidSize) }, (_, i) => i + 1);
  const canPlace = !disabled && armedGuid !== null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g} className="rounded-xl border border-slate-800">
            <div className="border-b border-slate-800 bg-slate-900 px-2 py-1 text-xs font-semibold uppercase text-slate-400">{groupLabel(team.teamType, team.instanceName, g)}</div>
            {SLOTS.map((s) => {
              const a = team.assignments.find((x) => x.groupIndex === g && x.slotIndex === s);
              const c = a ? byGuid.get(a.characterGuid) : undefined;
              const alt = c?.role.offSpecEnabled && c.role.offSpecRole ? (a?.assignedRole === c.role.primaryRole ? c.role.offSpecRole : c.role.primaryRole) : undefined;
              return (
                <div
                  key={s}
                  onClick={() => canPlace && onPlace(g, s)}
                  className={`flex min-h-10 items-center justify-between gap-2 border-b border-slate-900 px-2 py-1 text-sm last:border-0 lg:min-h-9 ${canPlace ? 'cursor-pointer hover:bg-indigo-950' : ''}`}
                >
                  {a && c ? (
                    <>
                      <div className="min-w-0">
                        <div className="truncate font-medium" style={{ color: classInfo(c.classId).color }}>{c.name}</div>
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <RoleBadge role={a.assignedRole} />
                          <CharFlags character={c} team={team} />
                        </div>
                      </div>
                      {!disabled && (
                        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {alt && (
                            <button onClick={() => onRole(c.guid, alt)} title={`Switch to ${alt}`} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] hover:bg-slate-800 lg:px-1 lg:py-0">⇄ {alt}</button>
                          )}
                          <button onClick={() => onRemove(c.guid)} aria-label="Remove" className="p-1 text-slate-500 hover:text-red-400 lg:p-0"><X size={14} /></button>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-600">{canPlace ? 'Place here' : 'Empty'}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-2 py-1 text-xs font-semibold uppercase text-slate-400">
          <span>Standby / Bench ({team.benchGuids.length})</span>
          {canPlace && <button onClick={onBenchArmed} className="rounded border border-slate-600 px-1.5 normal-case hover:bg-slate-800">Bench selected</button>}
        </div>
        <div className="flex flex-wrap gap-2 p-2">
          {team.benchGuids.map((guid) => {
            const c = byGuid.get(guid);
            return (
              <span key={guid} className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs">
                <span style={{ color: c ? classInfo(c.classId).color : undefined }}>{c?.name ?? 'Unknown'}</span>
                {c && <CharFlags character={c} team={team} />}
                {!disabled && <button onClick={() => onRemove(guid)} aria-label="Remove" className="text-slate-500 hover:text-red-400"><X size={12} /></button>}
              </span>
            );
          })}
          {team.benchGuids.length === 0 && <span className="text-xs text-slate-600">No one on standby.</span>}
        </div>
      </div>
    </div>
  );
};
