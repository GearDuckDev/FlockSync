import { useEffect, useState } from 'react';
import type { SyncLogEvent } from '../shared/ipc';

const MAX_ENTRIES = 100;

export const ActivityLog = (): React.JSX.Element => {
  const [entries, setEntries] = useState<SyncLogEvent[]>([]);

  useEffect(
    () => window.flocksync.onSyncLog((e) => setEntries((prev) => [e, ...prev].slice(0, MAX_ENTRIES))),
    [],
  );

  return (
    <section className="card">
      <h2>Activity Log</h2>
      {entries.length === 0 ? (
        <p className="muted">No sync activity yet. Type /reload in game or click Sync Now.</p>
      ) : (
        <ul className="log">
          {entries.map((e, i) => (
            <li key={`${e.timestamp}-${i}`} className={e.status === 'SUCCESS' ? 'ok' : 'bad'}>
              <span className="time">{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span className="badge">{e.status}</span>
              <span className="count">{e.characterCount} chars</span>
              <span className="msg">{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
