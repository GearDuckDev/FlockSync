import type { DayOfWeek, RaidTeamInput, TeamType } from '@flocksync/shared-types';
import { ACTIVITIES, MAX_PARTIES, TIMEZONES, defaultTargets, defaultsFor, sizesFor } from '../../lib/activities';
import { DAYS } from '../../lib/schedule';

interface Props {
  team: RaidTeamInput;
  disabled: boolean;
  onChange: (team: RaidTeamInput) => void;
}

const field = 'w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm disabled:opacity-60';

const Labeled = ({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element => (
  <label className="block text-xs text-slate-400">
    {label}
    {children}
  </label>
);

const withCurrent = (options: string[], current: string): string[] =>
  options.includes(current) ? options : [current, ...options];

export const TeamSettings = ({ team, disabled, onChange }: Props): React.JSX.Element => {
  const num = (key: 'targetTanks' | 'targetHealers' | 'targetDps', value: string): void =>
    onChange({ ...team, [key]: Math.max(0, Math.min(200, Number(value) || 0)) });

  const sizes = sizesFor(team.teamType, team.instanceName);
  const instances = withCurrent(ACTIVITIES[team.teamType].instances.map((i) => i.name), team.instanceName);

  const changeType = (teamType: TeamType): void => onChange({ ...team, teamType, ...defaultsFor(teamType) });

  const changeInstance = (instanceName: string): void => {
    const allowed = sizesFor(team.teamType, instanceName);
    const raidSize = allowed.includes(team.raidSize) ? team.raidSize : (allowed[0] ?? team.raidSize);
    const targets = raidSize === team.raidSize ? {} : defaultTargets(team.teamType, raidSize);
    onChange({ ...team, instanceName, raidSize, ...targets });
  };

  const changeSize = (raidSize: number): void =>
    onChange({ ...team, raidSize, ...defaultTargets(team.teamType, raidSize) });

  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 p-3 sm:grid-cols-4">
      <Labeled label="Team name">
        <input className={field} disabled={disabled} value={team.name} onChange={(e) => onChange({ ...team, name: e.target.value })} />
      </Labeled>
      <Labeled label="Team type">
        <select className={field} disabled={disabled} value={team.teamType} onChange={(e) => changeType(e.target.value as TeamType)}>
          {(Object.keys(ACTIVITIES) as TeamType[]).map((t) => <option key={t} value={t}>{ACTIVITIES[t].label}</option>)}
        </select>
      </Labeled>
      <Labeled label={team.teamType === 'PVP' ? 'Battleground' : 'Instance'}>
        <select className={field} disabled={disabled} value={team.instanceName} onChange={(e) => changeInstance(e.target.value)}>
          {instances.map((i) => <option key={i}>{i}</option>)}
        </select>
      </Labeled>
      {team.teamType === 'DUNGEON' ? (
        <Labeled label="Parties of 5">
          <input
            type="number"
            min={1}
            max={MAX_PARTIES}
            className={field}
            disabled={disabled}
            value={team.raidSize / 5}
            onChange={(e) => changeSize(Math.max(1, Math.min(MAX_PARTIES, Math.floor(Number(e.target.value)) || 1)) * 5)}
          />
        </Labeled>
      ) : (
        <Labeled label="Size">
          <select className={field} disabled={disabled || sizes.length === 1} value={team.raidSize} onChange={(e) => changeSize(Number(e.target.value))}>
            {sizes.map((s) => <option key={s} value={s}>{`${s}-man (${s / 5} group${s > 5 ? 's' : ''})`}</option>)}
          </select>
        </Labeled>
      )}
      <Labeled label="Day">
        <select className={field} disabled={disabled} value={team.scheduledDay} onChange={(e) => onChange({ ...team, scheduledDay: e.target.value as DayOfWeek })}>
          {DAYS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </Labeled>
      <Labeled label="Start">
        <input type="time" className={field} disabled={disabled} value={team.startTime} onChange={(e) => onChange({ ...team, startTime: e.target.value })} />
      </Labeled>
      <Labeled label="End">
        <input type="time" className={field} disabled={disabled} value={team.endTime} onChange={(e) => onChange({ ...team, endTime: e.target.value })} />
      </Labeled>
      <Labeled label="Timezone">
        <select className={field} disabled={disabled} value={team.timezone} onChange={(e) => onChange({ ...team, timezone: e.target.value })}>
          {withCurrent(TIMEZONES, team.timezone).map((z) => <option key={z}>{z}</option>)}
        </select>
      </Labeled>
      <div className="col-span-2 grid grid-cols-3 gap-1 sm:col-span-4">
        <Labeled label="Target tanks"><input type="number" className={field} disabled={disabled} value={team.targetTanks} onChange={(e) => num('targetTanks', e.target.value)} /></Labeled>
        <Labeled label="Target healers"><input type="number" className={field} disabled={disabled} value={team.targetHealers} onChange={(e) => num('targetHealers', e.target.value)} /></Labeled>
        <Labeled label="Target DPS"><input type="number" className={field} disabled={disabled} value={team.targetDps} onChange={(e) => num('targetDps', e.target.value)} /></Labeled>
      </div>
    </div>
  );
};
