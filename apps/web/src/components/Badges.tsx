import { Heart, Shield, Swords, type LucideIcon } from 'lucide-react';
import type { Character } from '@flocksync/shared-types';
import { classInfo } from '../lib/wow';

const ROLE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  TANK: { icon: Shield, color: 'text-sky-300' },
  HEALER: { icon: Heart, color: 'text-emerald-300' },
  DPS: { icon: Swords, color: 'text-rose-300' },
};

export const RoleBadge = ({ role }: { role: string | undefined }): React.JSX.Element => {
  const entry = role ? ROLE_ICONS[role] : undefined;
  if (!entry) return <span className="text-slate-600">—</span>;
  const Icon = entry.icon;
  return (
    <span className={`inline-flex items-center gap-1 ${entry.color}`}>
      <Icon size={14} /> {role}
    </span>
  );
};

export const OffSpec = ({ character }: { character: Character }): React.JSX.Element => {
  const { offSpecEnabled, offSpecRole } = character.role;
  if (!offSpecEnabled) return <span className="text-slate-600">—</span>;
  return offSpecRole ? <RoleBadge role={offSpecRole} /> : <span className="text-slate-500">Not set</span>;
};

export const ClassBadge = ({ character }: { character: Character }): React.JSX.Element => {
  const info = classInfo(character.classId);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: info.color }} />
      <span style={{ color: info.color }}>{info.name}</span>
    </span>
  );
};

export const StatusBadge = ({ active }: { active: boolean }): React.JSX.Element => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
    {active ? 'Active' : 'Culled'}
  </span>
);
