import { useEffect, useMemo } from 'react';
import type { DashboardData } from './hooks/useDashboardData';
import { useEntityNames } from './hooks/useEntityNames';
import { collectWants, groupByItem, groupByNote } from './lib/goals';
import { parseItemLink } from './lib/wow';
import { loadItemTooltips, rescanItemTooltips } from './lib/wowhead';
import { GoalGroupCard } from './components/goals/GoalGroupCard';

export const GearGoalsPage = ({ data }: { data: DashboardData }): React.JSX.Element => {
  const wants = useMemo(() => collectWants(data.roster), [data.roster]);
  const byItem = useMemo(() => groupByItem(wants), [wants]);
  const byNote = useMemo(() => groupByNote(wants), [wants]);
  const nameOf = useEntityNames(useMemo(() => byItem.map((g) => ({ kind: 'item' as const, id: Number(g.key) })), [byItem]));

  useEffect(() => {
    void loadItemTooltips().then(rescanItemTooltips);
  }, [byItem, byNote]);

  if (wants.length === 0) {
    return (
      <p className="rounded-md border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        No gear goals yet. In game, open /fs → Professions &amp; Goals, add goals, then /reload and sync.
      </p>
    );
  }

  const linkName = (itemId: number): string | undefined => {
    const fromLink = wants.find((w) => w.itemId === itemId);
    const parsed = fromLink ? parseItemLink(fromLink.itemLink).name : undefined;
    return parsed && parsed !== 'Unknown item' ? parsed : undefined;
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 text-lg font-semibold">Dungeon Matcher · same item</h2>
        <p className="mb-3 text-sm text-slate-400">
          Players chasing the exact same item. Five or more makes a full group.
        </p>
        <ul className="grid gap-3 lg:grid-cols-2">
          {byItem.map((g) => {
            const id = Number(g.key);
            return <GoalGroupCard key={g.key} group={g} itemId={id} itemName={linkName(id) ?? nameOf({ kind: 'item', id })} />;
          })}
        </ul>
      </section>
      <section>
        <h2 className="mb-1 text-lg font-semibold">Dungeon Matcher · same run</h2>
        <p className="mb-3 text-sm text-slate-400">
          Goals whose notes share a keyword (for example “BRD” in “BRD Vault”), so you can pull a group for one run.
        </p>
        {byNote.length === 0
          ? <p className="text-sm text-slate-500">No shared note keywords yet.</p>
          : <ul className="grid gap-3 lg:grid-cols-2">{byNote.map((g) => <GoalGroupCard key={g.key} group={g} />)}</ul>}
      </section>
    </div>
  );
};
