import { useState } from 'react';
import type { KillObservation, SharedKillEntry } from '@flocksync/shared-types';

export const observationDate = (epoch: number): string => {
  const date = new Date(epoch * 1000);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const KillObservationHistory = ({ entry, observations }: {
  entry: SharedKillEntry; observations: KillObservation[]
}): React.JSX.Element => {
  const [limit, setLimit] = useState(20);
  const rows = observations.filter((row) => row.name.toLowerCase() === entry.name.toLowerCase()
    && row.realm.toLowerCase() === entry.realm.toLowerCase() && row.targetCreatedAt === entry.createdAt)
    .sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
  const seen = rows.find((row) => row.kind === 'SIGHTING');
  const battles = rows.filter((row) => row.kind !== 'SIGHTING');
  return <section className="space-y-2 break-words text-xs text-slate-400">
    <p>{seen ? `Last seen: ${seen.zone} · ${observationDate(seen.timestamp)} · Reported by ${seen.reporter}`
      : 'No sighting reported yet.'}</p>
    <details>
      <summary className="cursor-pointer">Battle history ({battles.length})</summary>
      <p className="my-2">Latest 90 days; up to 5,000 guild events. Only readable killing-blow evidence is attributed. Times use your local timezone.</p>
      {battles.length === 0 && <p>No verified battles reported.</p>}
      <ol className="space-y-2">{battles.slice(0, limit).map((row) => <li key={row.id}
        className="rounded border border-slate-800 p-2">
        <p>{observationDate(row.timestamp)} · {row.kind === 'KILL' ? 'Enemy defeated' : 'Guild/party player killed'}</p>
        <p>{row.actor} &rarr; {row.victim}</p><p>{row.zone} · Reporter: {row.reporter}</p>
      </li>)}</ol>
      {battles.length > limit && <button className="mt-2 underline"
        onClick={() => setLimit((value) => value + 20)}>Show 20 more battles</button>}
    </details>
  </section>;
};
