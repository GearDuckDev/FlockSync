import { useMemo } from 'react';
import type { Character } from '@flocksync/shared-types';
import type { DashboardData } from './hooks/useDashboardData';
import { buildChainViews } from './lib/attunements';
import { AttunementFamilyRow } from './components/AttunementFamilyRow';

interface Props {
  data: DashboardData;
  canManage: boolean;
  onCreateTask: (character: Character, title: string) => void;
}

export const AttunementsPage = ({ data, canManage, onCreateTask }: Props): React.JSX.Element => {
  const views = useMemo(() => buildChainViews(data.roster), [data.roster]);

  if (views.length === 0) {
    return (
      <p className="rounded-md border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        No attunement data yet. Update the addon, /reload in game, then sync from the desktop app.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {views.map((chain) => {
        const attuned = chain.groups.filter((g) => g.attuned).reduce((n, g) => n + g.members.length, 0);
        const total = chain.groups.reduce((n, g) => n + g.members.length, 0);
        return (
          <section key={chain.chainId} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{chain.name}</h2>
              <div className="mt-1 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-emerald-500" style={{ width: `${total === 0 ? 0 : (attuned / total) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-400">{attuned} / {total} mains attuned · Alts stay under their main</p>
            </div>
            <ul className="grid gap-3 fold:grid-cols-2">
              {chain.groups.map((g) => (
                <li key={g.key} className={`rounded-lg border p-3 ${g.attuned ? 'border-emerald-900 bg-emerald-950/30' : 'border-slate-800 bg-slate-900'}`}>
                  <div className="mb-2 text-sm font-semibold">
                    {g.label} <span className="font-normal text-slate-500">· {g.members.length}</span>
                  </div>
                  <ul className="space-y-1">
                    {g.members.map((family) => (
                      <AttunementFamilyRow
                        key={family.key} family={family} chainName={chain.name}
                        canManage={canManage} onCreateTask={onCreateTask}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
