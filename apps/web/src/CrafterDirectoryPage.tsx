import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { DashboardData } from './hooks/useDashboardData';
import { useEntityNames } from './hooks/useEntityNames';
import { buildRecipeIndex, matchesRecipe, summarizeProfessions } from './lib/crafters';
import { loadItemTooltips, rescanItemTooltips } from './lib/wowhead';
import { CrafterChip } from './components/crafters/CrafterChip';
import { WowheadLink } from './components/WowheadLink';

const MAX_RESULTS = 40;

export const CrafterDirectoryPage = ({ data }: { data: DashboardData }): React.JSX.Element => {
  const [query, setQuery] = useState('');
  const index = useMemo(() => buildRecipeIndex(data.roster), [data.roster]);
  const professions = useMemo(() => summarizeProfessions(data.roster), [data.roster]);
  const nameOf = useEntityNames(useMemo(() => index.map((e) => e.entity), [index]));

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return index
      .filter((e) => matchesRecipe(e, nameOf(e.entity), query))
      .sort((a, b) =>
        b.crafters.filter((c) => c.accepting).length - a.crafters.filter((c) => c.accepting).length
        || (nameOf(a.entity) ?? '').localeCompare(nameOf(b.entity) ?? ''));
  }, [index, query, nameOf]);

  const shown = results.slice(0, MAX_RESULTS);
  useEffect(() => {
    void loadItemTooltips().then(rescanItemTooltips);
  }, [shown]);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
        <Search size={16} className="text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by recipe name, profession or item ID…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
        />
      </label>

      {professions.length === 0 ? (
        <p className="rounded-md border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
          No professions scanned yet. In game, open each profession window once, then /reload and sync.
        </p>
      ) : !query.trim() ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {professions.map((p) => (
            <button
              key={p.name}
              onClick={() => setQuery(p.name)}
              className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-left hover:border-indigo-500"
            >
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-slate-400">{p.crafters} crafter{p.crafters === 1 ? '' : 's'}</div>
              {p.accepting > 0 && <div className="text-xs text-emerald-300">{p.accepting} accepting requests</div>}
            </button>
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {results.length} recipe{results.length === 1 ? '' : 's'} found{results.length > MAX_RESULTS ? ` (showing ${MAX_RESULTS}; refine your search)` : ''}.
            Recipe names load from Wowhead, so name search improves as they arrive.
          </p>
          <ul className="space-y-3">
            {shown.map((entry) => (
              <li key={entry.key} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="mb-2 flex items-baseline gap-3">
                  <WowheadLink entity={entry.entity} name={nameOf(entry.entity)} />
                  <span className="text-xs text-slate-500">{entry.profession} · #{entry.entity.id}</span>
                </div>
                <ul className="space-y-1.5">
                  {entry.crafters.map((c) => <CrafterChip key={c.character.guid} crafter={c} />)}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
