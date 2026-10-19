import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';
import type { Role } from '@flocksync/shared-types';
import type { DashboardData } from './hooks/useDashboardData';
import { buildCallouts, buildHeatmap, type Callout } from './lib/recruitment';
import { DAYS } from './lib/schedule';
import { RoleBadge } from './components/Badges';

const ROLES: Role[] = ['TANK', 'HEALER', 'DPS'];

const cellStyle = (regular: number, occasional: number): string => {
  if (regular === 0 && occasional === 0) return 'text-slate-600';
  return regular >= 3 ? 'bg-emerald-900/60' : regular >= 1 ? 'bg-emerald-950' : 'bg-yellow-950';
};

const SEVERITY: Record<Callout['severity'], { icon: typeof AlertTriangle; cls: string }> = {
  need: { icon: AlertTriangle, cls: 'border-red-900 bg-red-950/50 text-red-200' },
  fill: { icon: UserPlus, cls: 'border-yellow-900 bg-yellow-950/50 text-yellow-200' },
  ok: { icon: CheckCircle2, cls: 'border-emerald-900 bg-emerald-950/50 text-emerald-200' },
};

export const RecruitmentPage = ({ data }: { data: DashboardData }): React.JSX.Element => {
  const { heatmap, unset, humans } = useMemo(() => buildHeatmap(data.roster), [data.roster]);
  const callouts = useMemo(() => buildCallouts(data.raids, data.roster), [data.raids, data.roster]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Weekly Availability Heatmap</h2>
        <p className="text-sm text-slate-400">
          Unique players (Mains and their alts counted once): {humans}. {unset > 0 && `${unset} have not set availability yet.`}
          {' '}Cells show <span className="text-emerald-300">Regular</span> / <span className="text-yellow-300">Occasional</span>.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-center text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Role</th>
                {DAYS.map((d) => <th key={d} className="px-3 py-2">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((role) => (
                <tr key={role} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-left"><RoleBadge role={role} /></td>
                  {DAYS.map((d) => {
                    const cell = heatmap[role][d];
                    return (
                      <td key={d} className={`px-3 py-2 ${cellStyle(cell.regular, cell.occasional)}`}>
                        <span className="text-emerald-300">{cell.regular}</span> / <span className="text-yellow-300">{cell.occasional}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Recruitment Needs</h2>
        {callouts.length === 0 && <p className="text-sm text-slate-500">Create raid teams in the Team Builder to see recruitment gaps.</p>}
        {callouts.map((c) => {
          const { icon: Icon, cls } = SEVERITY[c.severity];
          return (
            <div key={c.teamId} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
              <Icon size={16} className="mt-0.5 shrink-0" /> <span>{c.text}</span>
            </div>
          );
        })}
      </section>
    </div>
  );
};
