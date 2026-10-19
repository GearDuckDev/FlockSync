import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import type { RosterGroup } from '../lib/roster';
import { humanKey } from '../lib/humans';

interface Props {
  group: RosterGroup;
  alias: string | undefined;
  canManage: boolean;
  colSpan: number;
  /** Empty string clears the alias, reverting to the Main's name. */
  onSave: (key: string, alias: string) => void;
}

export const AliasHeaderRow = ({ group, alias, canManage, colSpan, onSave }: Props): React.JSX.Element => {
  const key = humanKey(group);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const title = alias ?? group.main.mainCharacterName ?? group.main.name;

  const commit = (): void => {
    onSave(key, value.trim());
    setEditing(false);
  };

  return (
    <tr className="border-t-2 border-slate-700 bg-slate-900/70">
      <td colSpan={colSpan} className="px-3 py-1.5">
        {editing ? (
          <span className="flex items-center gap-2">
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
              className="rounded-md border border-slate-600 bg-slate-950 px-2 py-0.5 text-sm"
            />
            <button onClick={commit} title="Save (empty resets to Main's name)"><Check size={14} className="text-emerald-300" /></button>
            <button onClick={() => setEditing(false)} title="Cancel"><X size={14} className="text-slate-400" /></button>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-200">{title}</span>
            {alias === undefined && <span className="text-xs text-slate-500">(default)</span>}
            {canManage && (
              <button
                onClick={() => {
                  setValue(alias ?? '');
                  setEditing(true);
                }}
                title="Set player alias"
                className="text-slate-500 hover:text-slate-200"
              >
                <Pencil size={12} />
              </button>
            )}
          </span>
        )}
      </td>
    </tr>
  );
};
