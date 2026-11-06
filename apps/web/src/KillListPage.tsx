import { useState } from 'react';
import { useAuth } from './AuthContext';
import { useKillList } from './hooks/useKillList';
import { KillListCard } from './components/KillListCard';
import { KillListCreateForm } from './components/KillListCreateForm';

export const KillListPage = (): React.JSX.Element => {
  const { token } = useAuth();
  const data = useKillList(token);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const rows = data.entries.filter((entry) =>
    `${entry.name} ${entry.realm} ${entry.author} ${entry.note}`.toLowerCase().includes(query));
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Kill List</h2>
          <p className="text-sm text-slate-400">Shared guild targets only. Anyone signed in can add targets, edit reasons, or remove entries.</p>
        </div>
        <button disabled={data.loading || data.saving} onClick={() => void data.load()}
          className="rounded border border-slate-700 px-3 py-2 text-sm disabled:opacity-50">Refresh Kill List</button>
      </div>
      <p className="text-sm text-slate-400">Website changes reach the game after collector logout &rarr; successful Desktop sync &rarr; login &rarr; officer relay. In-game shared changes broadcast to online guildmates; offline catch-up uses that relay.</p>
      {data.error && <p role="alert" className="rounded bg-red-950 p-3 text-red-300">{data.error} Refresh before retrying.</p>}
      {data.notice && <p role="status" className="text-sm text-green-300">{data.notice}</p>}
      <label className="block text-sm">Search targets, authors or reasons
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
      </label>
      <KillListCreateForm disabled={data.loading || data.saving} onAdd={data.add} />
      {data.loading && <p role="status">Refreshing shared entries...</p>}
      {!data.loading && !data.error && rows.length === 0 && <p className="text-slate-400">
        {data.entries.length ? 'No matching shared targets.' : 'No shared targets yet. Add one here or in game.'}
      </p>}
      <div className="grid gap-3 lg:grid-cols-2">{rows.map((entry) =>
        <KillListCard key={`${entry.realm}\u001f${entry.name}`} entry={entry} observations={data.observations}
          disabled={data.loading || data.saving} change={data.change} />
      )}</div>
    </div>
  );
};
