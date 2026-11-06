import { useState } from 'react';
import type { CharacterOwnershipCatalog } from '@flocksync/shared-types';

interface Props {
  catalog: CharacterOwnershipCatalog;
  busy: boolean;
  onChange: (guid: string, userId: string | null) => void;
}

export const CharacterOwnershipPanel = ({ catalog, busy, onChange }: Props): React.JSX.Element => {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const rows = catalog.characters.filter((character) => {
    const owner = catalog.ownerships.find((entry) => entry.characterGuid === character.guid);
    const username = catalog.users.find((entry) => entry.id === owner?.userId)?.username ?? '';
    return `${character.name} ${username}`.toLowerCase().includes(query);
  });
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Find a character or owner
        <input value={search} onChange={(event) => setSearch(event.target.value)} type="search"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2" />
      </label>
      {rows.length === 0 && <p className="text-sm text-slate-400">No matching synced characters.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((character) => {
          const owner = catalog.ownerships.find((entry) => entry.characterGuid === character.guid);
          return (
            <div key={character.guid} className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="font-semibold">{character.name}
                {!character.isActive && <span className="ml-2 text-xs text-slate-400">Inactive</span>}
              </div>
              <label className="block text-xs text-slate-400">
                Verified website owner for {character.name}
                <select value={owner?.userId ?? ''} disabled={busy}
                  onChange={(event) => onChange(character.guid, event.target.value || null)}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 disabled:opacity-50">
                  <option value="">Unlinked</option>
                  {catalog.users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
                </select>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
};
