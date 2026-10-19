import { classInfo, parseItemLink } from '../../lib/wow';
import type { GoalGroup } from '../../lib/goals';
import { RoleBadge } from '../Badges';
import { WowheadLink } from '../WowheadLink';

interface Props {
  group: GoalGroup;
  /** Wowhead-resolved name for the item this group is about, if any. */
  itemName?: string | undefined;
  itemId?: number | undefined;
}

export const GoalGroupCard = ({ group, itemName, itemId }: Props): React.JSX.Element => (
  <li className="rounded-lg border border-slate-800 bg-slate-950 p-3">
    <div className="mb-2 flex items-baseline gap-3">
      {itemId !== undefined
        ? <WowheadLink entity={{ kind: 'item', id: itemId }} name={itemName} />
        : <span className="font-semibold text-indigo-300">{group.title}</span>}
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${group.size >= 5 ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-800 text-slate-300'}`}>
        {group.size} player{group.size === 1 ? '' : 's'}{group.size >= 5 ? ' · full group' : ''}
      </span>
    </div>
    <ul className="space-y-1.5">
      {group.wants.map((w) => {
        const info = classInfo(w.character.classId);
        const goalName = itemId === undefined ? parseItemLink(w.itemLink).name : undefined;
        return (
          <li key={`${w.character.guid}:${w.itemId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm">
            <span className="font-semibold" style={{ color: info.color }}>{w.character.name}</span>
            <span className="text-xs text-slate-500">Lv {w.character.level} {info.name}</span>
            <RoleBadge role={w.character.role.primaryRole} />
            {itemId === undefined && (
              <WowheadLink entity={{ kind: 'item', id: w.itemId }} name={goalName === 'Unknown item' ? undefined : goalName} />
            )}
            {w.note && <span className="ml-auto text-xs italic text-slate-400">“{w.note}”</span>}
          </li>
        );
      })}
    </ul>
  </li>
);
