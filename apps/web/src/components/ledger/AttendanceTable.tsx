import type { AttendanceSummary } from '../../lib/attendance';
import { WINDOWS } from '../../lib/attendance';

const pct = (n: number, total: number): string => (total === 0 ? '—' : `${Math.round((n / total) * 100)}%`);

const tone = (n: number, total: number): string => {
  if (total === 0) return 'text-slate-500';
  const p = n / total;
  return p >= 0.75 ? 'text-emerald-300' : p >= 0.5 ? 'text-amber-300' : 'text-rose-300';
};

export const AttendanceTable = ({ summary }: { summary: AttendanceSummary }): React.JSX.Element => (
  <>
    <div className="space-y-2 fold:hidden">
      {summary.rows.length === 0 && (
        <div className="rounded-xl border border-slate-800 px-3 py-6 text-center text-sm text-slate-500">
          No active players.
        </div>
      )}
      {summary.rows.map((r) => (
        <div key={r.key} className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm">
          <div>
            <span className="font-semibold">{r.name}</span>
            {r.alts.length > 0 && <span className="ml-1.5 text-xs text-slate-500">+ {r.alts.join(', ')}</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {WINDOWS.map((w) => (
              <div key={w} className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1.5">
                <div className="text-[11px] uppercase text-slate-400">{w}d ({summary.totals[w]})</div>
                <div className={`mt-0.5 text-sm font-semibold ${tone(r.attended[w]!, summary.totals[w]!)}`}>
                  {pct(r.attended[w]!, summary.totals[w]!)}
                </div>
                <div className="text-[10px] text-slate-500">{r.attended[w]}/{summary.totals[w]}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>

    <div className="hidden overflow-x-auto rounded-xl border border-slate-800 fold:block">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-left text-xs uppercase text-slate-400">
          <tr>
            <th className="px-3 py-2">Player (Main + alts)</th>
            {WINDOWS.map((w) => <th key={w} className="px-3 py-2">{w} days ({summary.totals[w]} raids)</th>)}
          </tr>
        </thead>
        <tbody>
          {summary.rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No active players.</td></tr>}
          {summary.rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-800 hover:bg-slate-900">
              <td className="px-3 py-2">
                <span className="font-medium">{r.name}</span>
                {r.alts.length > 0 && <span className="ml-2 text-xs text-slate-500">+ {r.alts.join(', ')}</span>}
              </td>
              {WINDOWS.map((w) => (
                <td key={w} className={`px-3 py-2 ${tone(r.attended[w]!, summary.totals[w]!)}`}>
                  {pct(r.attended[w]!, summary.totals[w]!)} <span className="text-xs text-slate-500">({r.attended[w]}/{summary.totals[w]})</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);
