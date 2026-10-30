import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Character } from '@flocksync/shared-types';
import { SLOT_NAMES, classInfo, parseItemLink } from '../lib/wow';
import { loadItemTooltips, rescanItemTooltips } from '../lib/wowhead';
import { OffSpec, RoleBadge, StatusBadge } from './Badges';
import { WowheadLink } from './WowheadLink';

export const GearDrawer = ({ character, onClose }: { character: Character; onClose: () => void }): React.JSX.Element => {
  useEffect(() => {
    void loadItemTooltips().then(rescanItemTooltips);
  }, [character]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const info = classInfo(character.classId);
  const items = [...character.gear.items].sort((a, b) => a.slotId - b.slotId);

  return (
    <div
      className="fixed inset-0 z-20 flex justify-end bg-black/60 fold:sticky fold:top-4 fold:z-auto fold:block fold:bg-transparent lg:fixed lg:inset-0 lg:z-10 lg:flex lg:justify-end lg:bg-black/60"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-slate-800 bg-slate-900 p-4 fold:h-auto fold:max-h-[calc(100vh-2rem)] fold:max-w-none fold:rounded-xl fold:border lg:h-full lg:max-h-none lg:max-w-md lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l lg:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold" style={{ color: info.color }}>{character.name}</h2>
            <p className="text-sm text-slate-400">Level {character.level} {info.name} · {character.realm}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 hover:bg-slate-800 lg:p-1"><X size={18} /></button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <StatusBadge active={character.isActive} />
          <RoleBadge role={character.role.primaryRole} />
          {character.role.offSpecEnabled && <span className="flex items-center gap-1 text-slate-400">Off-spec: <OffSpec character={character} /></span>}
        </div>
        <p className="mt-1 text-xs text-slate-500">Gear updated {new Date(character.gear.updatedAt * 1000).toLocaleString()}</p>
        <ul className="mt-4 divide-y divide-slate-800 text-sm">
          {items.length === 0 && <li className="py-3 text-slate-500">No gear scanned.</li>}
          {items.map((item) => {
            const parsed = parseItemLink(item.itemLink);
            return (
              <li key={item.slotId} className="flex items-baseline justify-between gap-3 py-2">
                <span className="w-24 shrink-0 text-slate-500">{SLOT_NAMES[item.slotId] ?? `Slot ${item.slotId}`}</span>
                <WowheadLink
                  entity={{ kind: 'item', id: item.itemId }}
                  name={parsed.name}
                  color={parsed.color}
                  className="flex-1"
                />
                <span className="text-xs text-slate-600">#{item.itemId}</span>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
};
