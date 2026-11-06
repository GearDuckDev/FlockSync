import { useState } from 'react';
import { useAuth } from './AuthContext';
import { useKillList } from './hooks/useKillList';
import { KillListCard } from './components/KillListCard';
import { mayChangeKill } from './lib/killList';

export const KillListPage = (): React.JSX.Element => {
  const { token, user } = useAuth();
  const data = useKillList(token);
  const [search, setSearch] = useState('');
  const canManage = user?.role === 'OFFICER' || user?.role === 'ADMIN';
  const query = search.trim().toLowerCase();
  const rows = data.entries.filter((entry) =>
    `${entry.name} ${entry.realm} ${entry.author} ${entry.note}`.toLowerCase().includes(query));
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Kill List</h2>
          <p className="text-sm text-slate-400">Published guild targets only. Add and publish targets in game; personal entries and drafts stay private.</p>
          <p className="text-sm text-slate-400">Officers/admins may edit or remove any entry. Members may change entries authored by their verified linked characters.</p>
        </div>
        <button disabled={data.loading || data.saving} onClick={() => void data.load()}
          className="rounded border border-slate-700 px-3 py-2 text-sm disabled:opacity-50">Refresh Kill List</button>
      </div>
      <p className="text-sm text-slate-400">Game delivery: collector logout &rarr; successful Desktop sync &rarr; login &rarr; automatic guild-rank officer relay. Changes are not immediate in game.</p>
      {data.error && <p role="alert" className="rounded bg-red-950 p-3 text-red-300">{data.error} Refresh before retrying.</p>}
      {data.notice && <p role="status" className="text-sm text-green-300">{data.notice}</p>}
      <label className="block text-sm">Search targets, authors or reasons
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
      </label>
      {data.loading && <p role="status">Refreshing shared entries and verified ownership...</p>}
      {!data.loading && !data.error && rows.length === 0 && <p className="text-slate-400">
        {data.entries.length ? 'No matching shared targets.' : 'No published targets have reached the server. Publish in game and let your collector sync.'}
      </p>}
      <div className="grid gap-3 lg:grid-cols-2">{rows.map((entry) =>
        <KillListCard key={`${entry.realm}\u001f${entry.name}`} entry={entry} observations={data.observations}
          editable={mayChangeKill(entry, canManage, data.owned)}
          disabled={data.loading || data.saving} change={data.change} />
      )}</div>
    </div>
  );
};
