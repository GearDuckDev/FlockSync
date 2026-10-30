import { useState } from 'react';
import { ChevronDown, LayoutGrid } from 'lucide-react';

export type Tab =
  | 'roster'
  | 'teams'
  | 'recruitment'
  | 'crafters'
  | 'goals'
  | 'attunements'
  | 'ledger'
  | 'tasks'
  | 'admin'
  | 'theme';

export type Access = 'officer' | 'admin';

export interface TabItem {
  id: Tab;
  label: string;
  access?: Access;
}

export const TABS: TabItem[] = [
  { id: 'roster', label: 'Roster & Gear' },
  { id: 'teams', label: 'Team Builder (10/20/40)' },
  { id: 'recruitment', label: 'Availability & Recruitment' },
  { id: 'crafters', label: 'Crafter Directory' },
  { id: 'goals', label: 'Gear Goals' },
  { id: 'attunements', label: 'Attunements' },
  { id: 'ledger', label: 'Loot & Attendance' },
  { id: 'tasks', label: 'Officer Tasks', access: 'officer' },
  { id: 'admin', label: 'Admin Settings', access: 'admin' },
  { id: 'theme', label: 'Theme Settings' },
];

interface Props {
  tabs: TabItem[];
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
}

export const DashboardNav = ({ tabs, activeTab, onSelect }: Props): React.JSX.Element => {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentLabel = tabs.find((t) => t.id === activeTab)?.label ?? 'Navigation';

  const choose = (id: Tab): void => {
    onSelect(id);
    setMenuOpen(false);
  };

  return (
    <>
      {/* Compact phones / folded outer screen (< 600px): single-line section picker + 2-col grid drawer */}
      <div className="space-y-2 fold:hidden">
        <button
          type="button"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-semibold"
        >
          <span className="flex items-center gap-2 truncate">
            <LayoutGrid size={16} className="shrink-0 text-indigo-400" />
            <span className="truncate">{currentLabel}</span>
          </span>
          <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <nav aria-label="Sections" className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-slate-900/95 p-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => choose(t.id)}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium ${
                  activeTab === t.id
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Unfolded foldable & medium tablets (600px - 1023px): single-row horizontal scrollable tab strip */}
      <nav aria-label="Sections" className="hidden overflow-x-auto border-b border-slate-800 fold:flex lg:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium ${
              activeTab === t.id ? 'border-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Desktop & large tablets (>= 1024px): original tab bar unchanged */}
      <nav aria-label="Sections" className="hidden flex-wrap gap-1 border-b border-slate-800 lg:flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === t.id ? 'border-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
};
