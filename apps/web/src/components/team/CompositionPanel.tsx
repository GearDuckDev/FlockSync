import type { Character, RaidTeamInput } from '@flocksync/shared-types';
import {
  TRACKED_CLASS_IDS, className, computeComposition, isCovered, missingUtilities, utilitiesFor, utilityClasses,
  type Composition, type Utility,
} from '../../lib/composition';
import { instanceInfo } from '../../lib/activities';
import { classInfo } from '../../lib/wow';

const Counter = ({ label, have, target }: { label: string; have: number; target: number }): React.JSX.Element => (
  <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-center">
    <div className="text-xs uppercase text-slate-400">{label}</div>
    <div className={`text-lg font-bold ${have === target ? 'text-emerald-300' : have > target ? 'text-red-300' : 'text-yellow-300'}`}>
      {have} / {target}
    </div>
  </div>
);

const Counters = ({ comp, team }: { comp: Composition; team: RaidTeamInput }): React.JSX.Element => (
  <div className="grid grid-cols-3 gap-2">
    <Counter label="Tanks" have={comp.tanks} target={team.targetTanks} />
    <Counter label="Healers" have={comp.healers} target={team.targetHealers} />
    <Counter label="DPS" have={comp.dps} target={team.targetDps} />
  </div>
);

const Classes = ({ comp }: { comp: Composition }): React.JSX.Element => (
  <div>
    <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Class Distribution</div>
    <div className="flex flex-wrap gap-1.5">
      {TRACKED_CLASS_IDS.map((id) => (
        <span key={id} className="rounded-md bg-slate-900 px-2 py-0.5 text-xs" style={{ color: classInfo(id).color }}>
          {className(id)} {comp.classes.get(id) ?? 0}
        </span>
      ))}
    </div>
  </div>
);

const UtilityList = ({ title, list, comp }: { title: string; list: Utility[]; comp: Composition }): React.JSX.Element => (
  <div>
    <div className="mb-1 text-xs font-semibold uppercase text-slate-400">{title}</div>
    <ul className="grid gap-1 text-xs sm:grid-cols-2">
      {list.map((u) => {
        const covered = isCovered(u, comp.classes);
        return (
          <li key={u.label} className={covered ? 'text-emerald-300' : 'text-red-300'}>
            {covered ? '✔' : '✘'} {u.label} <span className="text-slate-500">({utilityClasses(u)})</span>
          </li>
        );
      })}
    </ul>
  </div>
);

/** Dungeon parties are separate 5-man groups, so each is counted on its own. */
const DungeonParties = ({ team, byGuid }: { team: RaidTeamInput; byGuid: Map<string, Character> }): React.JSX.Element => {
  const parties = team.raidSize / 5;
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Per-Party Composition & Buffs</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: parties }, (_, i) => i + 1).map((g) => {
          const comp = computeComposition(team, byGuid, g);
          const total = comp.tanks + comp.healers + comp.dps;
          const missing = missingUtilities(comp.classes).map((u) => u.label);
          return (
            <div key={g} className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs">
              <div className="mb-1 flex justify-between font-semibold">
                <span>Party {g}</span>
                <span className={total === 5 ? 'text-emerald-300' : 'text-yellow-300'}>{total}/5</span>
              </div>
              <div className="text-slate-300">T {comp.tanks}/1 · H {comp.healers}/1 · DPS {comp.dps}/3</div>
              <div className={total === 0 ? 'text-slate-600' : missing.length ? 'text-red-300' : 'text-emerald-300'}>
                {total === 0 ? 'Empty' : missing.length ? `Missing: ${missing.join(', ')}` : 'All buffs covered'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CompositionPanel = ({ team, byGuid }: { team: RaidTeamInput; byGuid: Map<string, Character> }): React.JSX.Element => {
  const comp = computeComposition(team, byGuid);
  const description = team.teamType === 'PVP' ? instanceInfo('PVP', team.instanceName)?.description : undefined;
  return (
    <div className="space-y-3 rounded-xl border border-slate-800 p-3">
      {description && <p className="text-sm text-indigo-200">{description}</p>}
      <Counters comp={comp} team={team} />
      <Classes comp={comp} />
      {team.teamType === 'DUNGEON' && <DungeonParties team={team} byGuid={byGuid} />}
      {team.teamType === 'RAID' && <UtilityList title="Raid Buffs & Utility" list={utilitiesFor('RAID')} comp={comp} />}
      {team.teamType === 'PVP' && <UtilityList title="PvP Utility" list={utilitiesFor('PVP')} comp={comp} />}
    </div>
  );
};
