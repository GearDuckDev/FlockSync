import { useId, useState } from 'react';
import { ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import type { Character } from '@flocksync/shared-types';
import type { AttunementFamily, CharacterProgress } from '../lib/attunements';
import { ClassBadge } from './Badges';

interface Props {
  family: AttunementFamily;
  chainName: string;
  canManage: boolean;
  onCreateTask: (character: Character, title: string) => void;
}

const ProgressRow = ({ entry, chainName, canManage, onCreateTask }: Omit<Props, 'family'> & {
  entry: CharacterProgress;
}): React.JSX.Element => (
  <div className="flex flex-wrap items-center gap-2 text-sm">
    <span className="font-medium">{entry.character.name}</span>
    <ClassBadge character={entry.character} />
    <span className="text-xs text-slate-500">Lvl {entry.character.level}</span>
    {!entry.character.isActive && <span className="text-xs text-slate-500">Inactive</span>}
    <span className="text-xs text-slate-400" title={entry.label}>
      {entry.reported ? `${entry.completed}/${entry.total}` : 'No synced progress'}
    </span>
    {canManage && entry.reported && !entry.attuned && (
      <button
        onClick={() => onCreateTask(entry.character, `Help ${entry.character.name} with ${chainName}: ${entry.label}`)}
        className="ml-auto rounded-md border border-slate-700 px-2 py-0.5 text-xs hover:bg-slate-800"
      >
        Create task
      </button>
    )}
  </div>
);

export const AttunementFamilyRow = ({ family, ...rest }: Props): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const mainName = family.orphan
    ? family.main.character.mainCharacterName ?? 'Unknown main'
    : family.main.character.name;
  return (
    <li className="space-y-2">
      <div className="flex items-start gap-2">
        {family.alts.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={id}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} alts for ${mainName}`}
            onClick={() => setExpanded((value) => !value)}
            className="mt-0.5 rounded text-slate-400 hover:text-white focus-visible:outline"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase text-amber-300">
            Main{family.alts.length > 0 ? ` · ${family.alts.length} alt(s)` : ''}
          </span>
          {family.orphan
            ? <p className="text-sm">{mainName} <span className="text-xs text-slate-500">(not on roster)</span></p>
            : <ProgressRow entry={family.main} {...rest} />}
        </div>
      </div>
      {family.alts.length > 0 && (
        <ul id={id} hidden={!expanded} className="ml-6 space-y-2 border-l border-slate-700 pl-3">
          {family.alts.map((alt) => (
            <li key={alt.character.guid} className="flex items-start gap-2">
              <CornerDownRight size={14} className="mt-1 shrink-0 text-slate-500" aria-hidden="true" />
              <div className="min-w-0 flex-1"><ProgressRow entry={alt} {...rest} /></div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};
