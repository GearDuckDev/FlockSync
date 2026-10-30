import { Ban, Heart, Shield, Swords, Users, UserCheck, type LucideIcon } from 'lucide-react';
import type { RosterStats } from '../lib/roster';

const Card = ({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }): React.JSX.Element => (
  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 lg:p-4">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
      <Icon size={14} className="shrink-0" /> <span className="truncate">{label}</span>
    </div>
    <div className="mt-2 text-2xl font-bold">{children}</div>
  </div>
);

export const SummaryCards = ({ stats }: { stats: RosterStats }): React.JSX.Element => (
  <div className="grid grid-cols-2 gap-3 fold:grid-cols-4">
    <Card icon={UserCheck} label="Total Raiders (Mains)">{stats.uniqueMains}</Card>
    <Card icon={Users} label="Total Characters">{stats.totalCharacters}</Card>
    <Card icon={Swords} label="Tanks / Healers / DPS">
      <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg lg:gap-3 lg:text-xl">
        <span className="flex items-center gap-1 text-sky-300"><Shield size={16} />{stats.tanks}</span>
        <span className="flex items-center gap-1 text-emerald-300"><Heart size={16} />{stats.healers}</span>
        <span className="flex items-center gap-1 text-rose-300"><Swords size={16} />{stats.dps}</span>
      </span>
    </Card>
    <Card icon={Ban} label="Inactive / Culled">{stats.inactive}</Card>
  </div>
);
