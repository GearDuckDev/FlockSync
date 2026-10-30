import { useMemo, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import type { RaidTeamInput, Role } from '@flocksync/shared-types';
import { createRaid, deleteRaid, updateRaid } from './lib/api';
import { humanKeyByGuid, buildHumans } from './lib/humans';
import { emptyTeam, fitToSize, placeInSlot, placeOnBench, removeFromTeam } from './lib/teamBuilder';
import { classInfo } from './lib/wow';
import { useAuth } from './AuthContext';
import type { DashboardData } from './hooks/useDashboardData';
import { RoleBadge } from './components/Badges';
import { TeamSettings } from './components/team/TeamSettings';
import { PlayerPool } from './components/team/PlayerPool';
import { RaidGrid } from './components/team/RaidGrid';
import { CompositionPanel } from './components/team/CompositionPanel';

const toInput = (t: RaidTeamInput): RaidTeamInput => ({
  name: t.name, teamType: t.teamType, instanceName: t.instanceName, raidSize: t.raidSize, scheduledDay: t.scheduledDay,
  startTime: t.startTime, endTime: t.endTime, timezone: t.timezone, targetTanks: t.targetTanks,
  targetHealers: t.targetHealers, targetDps: t.targetDps, assignments: t.assignments, benchGuids: t.benchGuids,
});

export const TeamBuilderPage = ({ data, canManage }: { data: DashboardData; canManage: boolean }): React.JSX.Element => {
  const { token } = useAuth();
  const { roster, raids, setRaids, handleError } = data;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RaidTeamInput>(emptyTeam);
  const [armed, setArmed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byGuid = useMemo(() => new Map(roster.map((c) => [c.guid, c])), [roster]);
  const keyOf = useMemo(() => {
    const keys = humanKeyByGuid(buildHumans(roster));
    return (guid: string): string | undefined => keys.get(guid);
  }, [roster]);

  const apply = (result: { team: RaidTeamInput; swappedOut: string[] }): void => {
    setDraft(result.team);
    setArmed(null);
    const names = result.swappedOut.map((g) => byGuid.get(g)?.name ?? 'a character');
    setNotice(names.length ? `Same player already in this lineup — swapped out ${names.join(', ')}.` : null);
  };

  const load = (id: string | null): void => {
    const team = raids.find((r) => r.id === id);
    setSelectedId(team ? team.id : null);
    setDraft(team ? toInput(team) : emptyTeam());
    setArmed(null);
    setNotice(null);
  };

  const save = async (): Promise<void> => {
    if (!token) return;
    setBusy(true);
    try {
      const saved = selectedId ? await updateRaid(token, selectedId, draft) : await createRaid(token, draft);
      setRaids((prev) => (selectedId ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved]));
      setSelectedId(saved.id);
      setNotice('Lineup saved.');
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!token || !selectedId || !window.confirm(`Delete "${draft.name}"?`)) return;
    setBusy(true);
    try {
      await deleteRaid(token, selectedId);
      setRaids((prev) => prev.filter((r) => r.id !== selectedId));
      load(null);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const setRole = (guid: string, role: Role): void =>
    setDraft((d) => ({ ...d, assignments: d.assignments.map((a) => (a.characterGuid === guid ? { ...a, assignedRole: role } : a)) }));

  const armedChar = armed ? byGuid.get(armed) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedId ?? ''}
          onChange={(e) => load(e.target.value || null)}
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm fold:flex-none"
        >
          <option value="">{canManage ? '— New lineup —' : '— Select lineup —'}</option>
          {raids.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.raidSize}-man, {r.scheduledDay})</option>)}
        </select>
        {canManage && (
          <>
            <button onClick={() => load(null)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-sm hover:bg-slate-800 lg:px-2"><Plus size={14} /> New</button>
            <button disabled={busy} onClick={() => void save()} className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"><Save size={14} /> Save</button>
            <button disabled={busy || !selectedId} onClick={() => void remove()} className="flex items-center gap-1 rounded-md border border-red-900 px-2.5 py-1.5 text-sm text-red-300 hover:bg-red-950 disabled:opacity-40 lg:px-2"><Trash2 size={14} /> Delete</button>
          </>
        )}
        {!canManage && <span className="text-xs text-slate-500">Read-only: only Officers and Admins can edit lineups.</span>}
      </div>
      {notice && <div className="rounded-md bg-slate-900 px-3 py-2 text-sm text-slate-300">{notice}</div>}

      <TeamSettings team={draft} disabled={!canManage} onChange={(t) => setDraft(fitToSize(t))} />

      {armedChar && canManage && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-2 rounded-lg border border-indigo-500/60 bg-indigo-950/95 px-3 py-2 text-xs shadow-lg fold:hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-slate-300">Placing:</span>
            <strong className="truncate" style={{ color: classInfo(armedChar.classId).color }}>{armedChar.name}</strong>
            <RoleBadge role={armedChar.role.primaryRole} />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => apply(placeOnBench(draft, armedChar.guid, keyOf))}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 font-medium hover:bg-slate-800"
            >
              Bench
            </button>
            <button
              type="button"
              aria-label="Cancel selection"
              onClick={() => setArmed(null)}
              className="rounded p-1 text-slate-300 hover:bg-slate-800"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="grid items-start gap-4 fold:grid-cols-[15.5rem_minmax(0,1fr)] lg:grid-cols-[18rem_1fr]">
        <PlayerPool
          roster={roster}
          team={draft}
          armedGuid={armed}
          disabled={!canManage}
          onArm={setArmed}
          onBench={(guid) => apply(placeOnBench(draft, guid, keyOf))}
        />
        <div className="space-y-4">
          <CompositionPanel team={draft} byGuid={byGuid} />
          <RaidGrid
            team={draft}
            byGuid={byGuid}
            armedGuid={armed}
            disabled={!canManage}
            onPlace={(g, s) => armedChar && apply(placeInSlot(draft, armedChar.guid, armedChar.role.primaryRole, g, s, keyOf))}
            onRemove={(guid) => setDraft((d) => removeFromTeam(d, guid))}
            onRole={setRole}
            onBenchArmed={() => armed && apply(placeOnBench(draft, armed, keyOf))}
          />
        </div>
      </div>
    </div>
  );
};
