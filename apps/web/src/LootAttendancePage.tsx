import { useMemo } from 'react';
import type { DashboardData } from './hooks/useDashboardData';
import { useLedger } from './hooks/useLedger';
import { summarizeAttendance } from './lib/attendance';
import { buildHumans } from './lib/humans';
import { AttendanceTable } from './components/ledger/AttendanceTable';
import { LootTable } from './components/ledger/LootTable';

export const LootAttendancePage = ({ data }: { data: DashboardData }): React.JSX.Element => {
  const { loot, attendance, loading } = useLedger(data.handleError);
  const humans = useMemo(() => buildHumans(data.roster), [data.roster]);
  const summary = useMemo(
    () => summarizeAttendance(humans, attendance, Math.floor(Date.now() / 1000)),
    [humans, attendance],
  );

  return (
    <div className="space-y-6">
      {loading && <p className="text-sm text-slate-400">Loading ledger…</p>}
      <section>
        <h2 className="mb-1 text-lg font-semibold">Attendance</h2>
        <p className="mb-3 text-sm text-slate-400">
          Boss-kill snapshots taken by officers. A player counts once per raid if their Main or any alt was in the group.
        </p>
        <AttendanceTable summary={summary} />
      </section>
      <section>
        <h2 className="mb-1 text-lg font-semibold">Loot history</h2>
        <p className="mb-3 text-sm text-slate-400">Epic and better drops recorded in raid instances.</p>
        <LootTable loot={loot} />
      </section>
    </div>
  );
};
