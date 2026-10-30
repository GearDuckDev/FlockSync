import { ClipboardPlus, CornerDownRight, RotateCcw, Trash2, UserX } from 'lucide-react';
import type { Character } from '@flocksync/shared-types';
import type { RosterGroup } from '../lib/roster';
import { humanKey } from '../lib/humans';
import { AliasHeaderRow } from './AliasHeaderRow';
import { ClassBadge, OffSpec, RoleBadge, StatusBadge } from './Badges';
import { AvailabilityBadge, LockoutBadges } from './TrackingBadges';

interface Props {
  groups: RosterGroup[];
  aliases: Map<string, string>;
  canManage: boolean;
  busyGuid: string | null;
  onSelect: (c: Character) => void;
  onToggle: (c: Character) => void;
  onCreateTask: (c: Character) => void;
  onPurge: (c: Character) => void;
  onSaveAlias: (key: string, alias: string) => void;
}

interface RowProps extends Omit<Props, 'groups' | 'aliases' | 'onSaveAlias'> {
  character: Character;
  alt?: boolean;
  orphan?: boolean;
}

const Row = ({ character: c, alt, orphan, canManage, busyGuid, onSelect, onToggle, onCreateTask, onPurge }: RowProps): React.JSX.Element => (
  <tr className={`border-t border-slate-800 hover:bg-slate-900 ${c.isActive ? '' : 'opacity-60'}`}>
    <td className="px-3 py-2">
      <button className={`flex items-center gap-2 text-left font-medium hover:underline ${alt ? 'pl-6' : ''}`} onClick={() => onSelect(c)}>
        {alt && <CornerDownRight size={14} className="text-slate-500" />}
        {c.name}
        {!alt && !orphan && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">Main</span>}
        {orphan && <span className="text-xs text-slate-500">(alt of {c.mainCharacterName ?? 'unknown'})</span>}
      </button>
    </td>
    <td className="px-3 py-2"><ClassBadge character={c} /></td>
    <td className="px-3 py-2">{c.level}</td>
    <td className="px-3 py-2"><RoleBadge role={c.role.primaryRole} /></td>
    <td className="px-3 py-2"><OffSpec character={c} /></td>
    <td className="px-3 py-2">{c.gear.items.length}</td>
    <td className="px-3 py-2"><LockoutBadges character={c} /></td>
    <td className="px-3 py-2"><AvailabilityBadge character={c} /></td>
    <td className="px-3 py-2 text-slate-400">{new Date(c.lastSeenAt * 1000).toLocaleString()}</td>
    <td className="px-3 py-2"><StatusBadge active={c.isActive} /></td>
    {canManage && (
      <td className="space-x-1 px-3 py-2 text-right">
        <button
          onClick={() => onCreateTask(c)}
          title="Create an officer task linked to this character"
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
        >
          <ClipboardPlus size={12} /> Task
        </button>
        <button
          disabled={busyGuid === c.guid}
          onClick={() => onToggle(c)}
          title={c.isActive ? 'Cull: hide from the active roster (can be restored)' : 'Restore: return to the active roster'}
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
        >
          {c.isActive ? <><UserX size={12} /> Cull</> : <><RotateCcw size={12} /> Restore</>}
        </button>
        <button
          onClick={() => onPurge(c)}
          title="Permanently delete this character and its records"
          className="inline-flex items-center gap-1 rounded-md border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950"
        >
          <Trash2 size={12} /> Delete
        </button>
      </td>
    )}
  </tr>
);

export const RosterTable = ({ groups, aliases, onSaveAlias, ...rest }: Props): React.JSX.Element => (
  <div className="hidden overflow-x-auto rounded-xl border border-slate-800 lg:block">
    <table className="w-full text-sm">
      <thead className="bg-slate-900 text-left text-xs uppercase text-slate-400">
        <tr>
          {['Character', 'Class', 'Lvl', 'Role', 'Off-Spec', 'Items', 'Lockouts', 'Availability', 'Last Seen', 'Status'].map((h) => (
            <th key={h} className="px-3 py-2">{h}</th>
          ))}
          {rest.canManage && <th className="px-3 py-2 text-right">Officer</th>}
        </tr>
      </thead>
      <tbody>
        {groups.length === 0 && (
          <tr><td colSpan={11} className="px-3 py-6 text-center text-slate-500">No characters synced yet.</td></tr>
        )}
        {groups.map((g) => (
          <GroupRows key={g.main.guid} group={g} aliases={aliases} onSaveAlias={onSaveAlias} {...rest} />
        ))}
      </tbody>
    </table>
  </div>
);

const GroupRows = ({ group, aliases, onSaveAlias, ...rest }: Omit<Props, 'groups'> & { group: RosterGroup }): React.JSX.Element => (
  <>
    <AliasHeaderRow group={group} alias={aliases.get(humanKey(group))} canManage={rest.canManage} colSpan={rest.canManage ? 11 : 10} onSave={onSaveAlias} />
    <Row character={group.main} orphan={group.orphan} {...rest} />
    {group.alts.map((a) => (
      <Row key={a.guid} character={a} alt {...rest} />
    ))}
  </>
);
