import { useMemo, useState } from 'react';
import type { Character } from '@flocksync/shared-types';
import { purgeCharacter as apiPurge, removeAlias, saveAlias as apiSaveAlias, setCharacterStatus } from './lib/api';
import { computeStats, groupRoster } from './lib/roster';
import { useAuth } from './AuthContext';
import type { DashboardData } from './hooks/useDashboardData';
import { SummaryCards } from './components/SummaryCards';
import { RosterTable } from './components/RosterTable';
import { GearDrawer } from './components/GearDrawer';

interface Props {
  data: DashboardData;
  onCreateTask: (character: Character, title: string) => void;
  canManage: boolean;
}

export const RosterPage = ({ data, canManage, onCreateTask }: Props): React.JSX.Element => {
  const { token } = useAuth();
  const { roster, setRoster, handleError } = data;
  const [selectedGuid, setSelectedGuid] = useState<string | null>(null);
  const [busyGuid, setBusyGuid] = useState<string | null>(null);

  const toggle = async (c: Character): Promise<void> => {
    if (!token) return;
    setBusyGuid(c.guid);
    try {
      const updated = await setCharacterStatus(token, c.guid, !c.isActive);
      setRoster((prev) => prev.map((r) => (r.guid === updated.guid ? updated : r)));
    } catch (err) {
      handleError(err);
    } finally {
      setBusyGuid(null);
    }
  };

  const aliasMap = useMemo(() => new Map(data.aliases.map((a) => [a.key, a.alias])), [data.aliases]);

  const saveAlias = async (key: string, alias: string): Promise<void> => {
    if (!token) return;
    try {
      if (alias === '') {
        await removeAlias(token, key);
        data.setAliases((prev) => prev.filter((a) => a.key !== key));
      } else {
        const saved = await apiSaveAlias(token, key, alias);
        data.setAliases((prev) => [...prev.filter((a) => a.key !== key), saved]);
      }
    } catch (err) {
      handleError(err);
    }
  };

  const purge = async (c: Character): Promise<void> => {
    if (!token) return;
    const ok = window.confirm(`Permanently delete ${c.name} and all related records (loot, attendance, tasks, raid slots)? This cannot be undone.`);
    if (!ok) return;
    try {
      await apiPurge(token, c.guid);
      setSelectedGuid(null);
      await data.reload();
    } catch (err) {
      handleError(err);
    }
  };

  const groups = useMemo(() => groupRoster(roster), [roster]);
  const stats = useMemo(() => computeStats(roster, groups), [roster, groups]);
  const selected = roster.find((r) => r.guid === selectedGuid) ?? null;

  return (
    <div className="space-y-5">
      <SummaryCards stats={stats} />
      <RosterTable groups={groups} aliases={aliasMap} onSaveAlias={(k, a) => void saveAlias(k, a)} onPurge={(c) => void purge(c)} canManage={canManage} busyGuid={busyGuid} onSelect={(c) => setSelectedGuid(c.guid)} onToggle={(c) => void toggle(c)} onCreateTask={(c) => onCreateTask(c, `Review ${c.name}`)} />
      {selected && <GearDrawer character={selected} onClose={() => setSelectedGuid(null)} />}
    </div>
  );
};
