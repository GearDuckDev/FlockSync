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
  const rows = catalog.groups.filter((group) => {
    const members = catalog.characters.filter((c) => group.characterGuids.includes(c.guid));
    const owners = catalog.ownerships.filter((link) => group.characterGuids.includes(link.characterGuid));
    const usernames = owners.map((link) => catalog.users.find((user) => user.id === link.userId)?.username ?? '');
    return `${group.label} ${members.map((c) => c.name).join(' ')} ${usernames.join(' ')}`.toLowerCase().includes(query);
  });
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Find a friendly name, character or owner
        <input value={search} onChange={(event) => setSearch(event.target.value)} type="search"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2" />
      </label>
      {rows.length === 0 && <p className="text-sm text-slate-400">No matching synced characters.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((group) => {
          const members = catalog.characters.filter((c) => group.characterGuids.includes(c.guid));
          return (
            <div key={group.key} className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="font-semibold">{group.label}</div>
              <ul className="space-y-1 text-sm">{members.map((character) => {
                const owner = catalog.ownerships.find((row) => row.characterGuid === character.guid);
                return <li key={character.guid}>{character.name}
                  {!character.isActive && <span className="ml-2 text-xs text-slate-400">Inactive</span>}
                  <span className="ml-2 text-xs text-slate-400">
                    {catalog.users.find((row) => row.id === owner?.userId)?.username ?? 'Unlinked'}
                  </span>
                </li>;
              })}</ul>
              <label className="block text-xs text-slate-400">
                Verified website owner for {group.label} (including future alts)
                <select value={group.userId ?? ''} disabled={busy}
                  onChange={(event) => onChange(group.key, event.target.value || null)}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 disabled:opacity-50">
                  <option value="">No group owner (review individual links above)</option>
                  {catalog.users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
                </select>
              </label>
              <button disabled={busy} onClick={() => onChange(group.key, null)}
                className="text-xs text-red-300 disabled:opacity-50">Revoke all group links</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
