import { useState } from 'react';
import { Check, ClipboardPlus, CornerDownRight, Pencil, RotateCcw, Trash2, UserX, X } from 'lucide-react';
import type { Character } from '@flocksync/shared-types';
import type { RosterGroup } from '../lib/roster';
import { humanKey } from '../lib/humans';
import { classInfo } from '../lib/wow';
import { OffSpec, RoleBadge, StatusBadge } from './Badges';
import { AvailabilityBadge, LockoutBadges } from './TrackingBadges';

interface Props {
  groups: RosterGroup[];
  aliases: Map<string, string>;
  canManage: boolean;
  busyGuid: string | null;
  selectedGuid: string | null;
  onSelect: (c: Character) => void;
  onToggle: (c: Character) => void;
  onCreateTask: (c: Character) => void;
  onPurge: (c: Character) => void;
  onSaveAlias: (key: string, alias: string) => void;
}

interface CardProps extends Omit<Props, 'groups' | 'aliases' | 'onSaveAlias'> {
  character: Character;
  alt?: boolean;
  orphan?: boolean;
}

const CharacterCard = ({
  character: c, alt, orphan, canManage, busyGuid, selectedGuid, onSelect, onToggle, onCreateTask, onPurge,
}: CardProps): React.JSX.Element => {
  const info = classInfo(c.classId);
  const isSelected = selectedGuid === c.guid;
  return (
    <div
      className={`space-y-2 border-t border-slate-800/80 px-3 py-2.5 text-sm ${alt ? 'pl-5' : ''} ${
        isSelected ? 'bg-indigo-950/50' : ''
      } ${c.isActive ? '' : 'opacity-60'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelect(c)}
          className="flex min-w-0 items-center gap-1.5 text-left font-semibold hover:underline"
        >
          {alt && <CornerDownRight size={14} className="shrink-0 text-slate-500" />}
          <span className="truncate" style={{ color: info.color }}>{c.name}</span>
          {!alt && !orphan && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">Main</span>
          )}
          {orphan && <span className="text-xs font-normal text-slate-500">(alt of {c.mainCharacterName ?? 'unknown'})</span>}
        </button>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400">Lv {c.level} {info.name}</span>
          <StatusBadge active={c.isActive} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <RoleBadge role={c.role.primaryRole} />
        {c.role.offSpecEnabled && (
          <span className="inline-flex items-center gap-1 text-slate-400">Off: <OffSpec character={c} /></span>
        )}
        <button type="button" onClick={() => onSelect(c)} className="text-indigo-300 underline">
          {c.gear.items.length} gear items
        </button>
        <span className="text-slate-500">Seen {new Date(c.lastSeenAt * 1000).toLocaleDateString()}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <AvailabilityBadge character={c} />
        <LockoutBadges character={c} />
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => onCreateTask(c)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs hover:bg-slate-800"
          >
            <ClipboardPlus size={12} /> Task
          </button>
          <button
            type="button"
            disabled={busyGuid === c.guid}
            onClick={() => onToggle(c)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
          >
            {c.isActive ? <><UserX size={12} /> Cull</> : <><RotateCcw size={12} /> Restore</>}
          </button>
          <button
            type="button"
            onClick={() => onPurge(c)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-900 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const GroupCard = ({ group, alias, onSaveAlias, ...rest }: Omit<Props, 'groups' | 'aliases'> & {
  group: RosterGroup;
  alias: string | undefined;
}): React.JSX.Element => {
  const key = humanKey(group);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const label = alias ?? group.main.mainCharacterName ?? group.main.name;
  const commit = (): void => {
    onSaveAlias(key, value.trim());
    setEditing(false);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
      <div className="flex items-center justify-between gap-2 bg-slate-900/80 px-3 py-2">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={value}
              maxLength={40}
              placeholder={group.main.name}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
            />
            <button type="button" onClick={commit} aria-label="Save alias" className="p-1 text-emerald-300"><Check size={16} /></button>
            <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="p-1 text-slate-400"><X size={16} /></button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-bold text-indigo-200">{label}</span>
            {alias === undefined && <span className="text-xs text-slate-500">(default)</span>}
            {rest.canManage && (
              <button
                type="button"
                aria-label="Set player alias"
                onClick={() => {
                  setValue(alias ?? '');
                  setEditing(true);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
        )}
        {group.alts.length > 0 && (
          <span className="shrink-0 text-xs text-slate-500">{group.alts.length} alt{group.alts.length === 1 ? '' : 's'}</span>
        )}
      </div>
      <CharacterCard character={group.main} orphan={group.orphan} {...rest} />
      {group.alts.map((a) => (
        <CharacterCard key={a.guid} character={a} alt {...rest} />
      ))}
    </section>
  );
};

export const RosterMobileList = ({ groups, aliases, onSaveAlias, ...rest }: Props): React.JSX.Element => (
  <div className="space-y-3 lg:hidden">
    {groups.length === 0 && (
      <div className="rounded-xl border border-slate-800 px-3 py-6 text-center text-sm text-slate-500">
        No characters synced yet.
      </div>
    )}
    {groups.map((g) => (
      <GroupCard key={g.main.guid} group={g} alias={aliases.get(humanKey(g))} onSaveAlias={onSaveAlias} {...rest} />
    ))}
  </div>
);
